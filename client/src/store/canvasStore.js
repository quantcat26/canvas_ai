import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

const HISTORY_LIMIT = 100;

const cloneSnapshot = (snapshot) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(snapshot);
  }
  return JSON.parse(JSON.stringify(snapshot));
};

const getCardZIndex = (card) => (typeof card?.zIndex === 'number' ? card.zIndex : 0);

const getNextZIndex = (cards) => {
  const values = Object.values(cards);
  if (values.length === 0) return 0;
  const maxValue = Math.max(...values.map((card) => getCardZIndex(card)));
  return maxValue + 1;
};

const reorderCardsToFront = (cards, cardIds) => {
  if (!cardIds || cardIds.length === 0) return cards;

  const reorderableIds = new Set(
    cardIds.filter((id) => {
      const card = cards[id];
      if (!card) return false;
      if (card.type !== 'group') return true;
      return Boolean(card.collapsed);
    })
  );

  if (reorderableIds.size === 0) return cards;

  const ordered = Object.values(cards)
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      const diff = getCardZIndex(a.card) - getCardZIndex(b.card);
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map(({ card }) => card);

  const selected = [];
  const unselected = [];

  ordered.forEach((card) => {
    if (reorderableIds.has(card.id)) {
      selected.push(card);
    } else {
      unselected.push(card);
    }
  });

  const nextOrder = [...unselected, ...selected];
  const nextCards = { ...cards };

  nextOrder.forEach((card, index) => {
    if (getCardZIndex(card) !== index) {
      nextCards[card.id] = { ...card, zIndex: index };
    }
  });

  return nextCards;
};

const useCanvasStore = create((set, get) => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  cards: {},
  connections: {},
  selectedCardIds: [],
  selectedConnectionIds: [],
  isConnectingMode: false,
  history: [],
  future: [],

  zoomIn: () => set((state) => ({ zoom: state.zoom * 1.2 })),
  zoomOut: () => set((state) => ({ zoom: state.zoom / 1.2 })),
  setZoom: (zoom) => set({ zoom }),
  setPan: (panX, panY) => set({ panX, panY }),
  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),
  resetZoom: () => {
    const { animateZoom } = get();
    animateZoom(1, 300);
  },
  resetPosition: () => {
    const { animatePan } = get();
    animatePan(0, 0, 300);
  },

  animateZoom: (targetZoom, duration) => {
    const startZoom = get().zoom;
    const startX = get().panX;
    const startY = get().panY;
    const startTime = Date.now();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const centerXInCanvas = (viewportWidth / 2 - startX) / startZoom;
    const centerYInCanvas = (viewportHeight / 2 - startY) / startZoom;

    const animate = () => {
      const elapsedTime = Date.now() - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      const easeProgress = 1 - (1 - progress) * (1 - progress);

      const currentZoom = startZoom + (targetZoom - startZoom) * easeProgress;
      const newPanX = viewportWidth / 2 - centerXInCanvas * currentZoom;
      const newPanY = viewportHeight / 2 - centerYInCanvas * currentZoom;

      set({
        zoom: currentZoom,
        panX: newPanX,
        panY: newPanY,
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  },

  animatePan: (targetX, targetY, duration) => {
    const startX = get().panX;
    const startY = get().panY;
    const startTime = Date.now();

    const animate = () => {
      const elapsedTime = Date.now() - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      const easeProgress = 1 - (1 - progress) * (1 - progress);

      const currentX = startX + (targetX - startX) * easeProgress;
      const currentY = startY + (targetY - startY) * easeProgress;

      set({ panX: currentX, panY: currentY });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  },

  toggleConnectingMode: () => set((state) => ({ isConnectingMode: !state.isConnectingMode })),

  recordHistory: () => {
    const { history, cards, connections } = get();
    const snapshot = cloneSnapshot({ cards, connections });
    const nextHistory = [...history, snapshot].slice(-HISTORY_LIMIT);
    set({ history: nextHistory, future: [] });
  },

  undo: () => {
    const { history, future, cards, connections } = get();
    if (history.length === 0) return;

    const previous = history[history.length - 1];
    const currentSnapshot = cloneSnapshot({ cards, connections });
    const restored = cloneSnapshot(previous);

    set({
      cards: restored.cards,
      connections: restored.connections,
      history: history.slice(0, -1),
      future: [...future, currentSnapshot],
      selectedCardIds: [],
      selectedConnectionIds: [],
    });
  },

  redo: () => {
    const { history, future, cards, connections } = get();
    if (future.length === 0) return;

    const next = future[future.length - 1];
    const currentSnapshot = cloneSnapshot({ cards, connections });
    const restored = cloneSnapshot(next);

    set({
      cards: restored.cards,
      connections: restored.connections,
      history: [...history, currentSnapshot].slice(-HISTORY_LIMIT),
      future: future.slice(0, -1),
      selectedCardIds: [],
      selectedConnectionIds: [],
    });
  },

  addCard: (card, options = {}) => {
    if (!options.skipHistory) {
      get().recordHistory();
    }
    const id = uuidv4();
    set((state) => {
      const nextZIndex = typeof card.zIndex === 'number'
        ? card.zIndex
        : getNextZIndex(state.cards);
      return {
        cards: {
          ...state.cards,
          [id]: { ...card, id, zIndex: nextZIndex },
        },
      };
    });
    return id;
  },

  updateCard: (cardId, updates, options = {}) => {
    if (!options.skipHistory) {
      get().recordHistory();
    }

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: { ...state.cards[cardId], ...updates },
      },
    }));
  },

  removeCard: (cardId, options = {}) => {
    if (!options.skipHistory) {
      get().recordHistory();
    }
    set((state) => {
      const removedCard = state.cards[cardId];
      const { [cardId]: _, ...remainingCards } = state.cards;
      let nextCards = remainingCards;

      if (removedCard?.type === 'group' && Array.isArray(removedCard.childIds)) {
        nextCards = { ...nextCards };
        removedCard.childIds.forEach((childId) => {
          if (nextCards[childId]) {
            nextCards[childId] = {
              ...nextCards[childId],
              groupId: null,
            };
          }
        });
      } else if (removedCard?.groupId && state.cards[removedCard.groupId]) {
        const group = state.cards[removedCard.groupId];
        if (group?.type === 'group' && Array.isArray(group.childIds)) {
          nextCards = {
            ...nextCards,
            [group.id]: {
              ...group,
              childIds: group.childIds.filter((id) => id !== cardId),
            },
          };
        }
      }

      const remainingConnections = { ...state.connections };
      Object.keys(remainingConnections).forEach((connectionId) => {
        const connection = remainingConnections[connectionId];
        if (connection.startCardId === cardId || connection.endCardId === cardId) {
          delete remainingConnections[connectionId];
        }
      });

      return {
        cards: nextCards,
        connections: remainingConnections,
        selectedCardIds: state.selectedCardIds.filter((id) => id !== cardId),
      };
    });
  },

  selectCards: (cardIds, options = {}) => set((state) => {
    if (!cardIds || cardIds.length === 0 || options.skipReorder) {
      return { selectedCardIds: cardIds };
    }

    const nextCards = reorderCardsToFront(state.cards, cardIds);
    if (nextCards === state.cards) {
      return { selectedCardIds: cardIds };
    }

    return {
      cards: nextCards,
      selectedCardIds: cardIds,
    };
  }),

  addConnection: (connection) => {
    get().recordHistory();
    const id = uuidv4();
    set((state) => ({
      connections: {
        ...state.connections,
        [id]: { ...connection, id },
      },
    }));
    return id;
  },

  updateConnection: (connectionId, updates, options = {}) => {
    if (!options.skipHistory) {
      get().recordHistory();
    }

    set((state) => ({
      connections: {
        ...state.connections,
        [connectionId]: { ...state.connections[connectionId], ...updates },
      },
    }));
  },

  removeConnection: (connectionId, options = {}) => {
    if (!options.skipHistory) {
      get().recordHistory();
    }
    set((state) => {
    const { [connectionId]: _, ...remainingConnections } = state.connections;
    return {
      connections: remainingConnections,
      selectedConnectionIds: state.selectedConnectionIds.filter((id) => id !== connectionId),
    };
    });
  },

  selectConnections: (connectionIds) => set({ selectedConnectionIds: connectionIds }),

  clearSelection: () => set({ selectedCardIds: [], selectedConnectionIds: [] }),

  hydrate: (state) => set(() => ({
    ...state,
    selectedCardIds: [],
    selectedConnectionIds: [],
    history: [],
    future: [],
  })),
}));

export default useCanvasStore;
