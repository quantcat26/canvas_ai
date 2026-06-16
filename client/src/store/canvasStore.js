import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { cloneSnapshot, getNextZIndex, reorderCardsToFront } from '../utils/canvasHelpers.js';

const HISTORY_LIMIT = 100;

const useCanvasStore = create((set, get) => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  cards: {},
  connections: {},
  selectedCardIds: [],
  selectedConnectionIds: [],
  aiSelectedCardIds: [],
  isConnectingMode: false,
  history: [],
  future: [],

  // ---- Zoom & Pan ----

  zoomIn: () => set((state) => ({ zoom: state.zoom * 1.2 })),
  zoomOut: () => set((state) => ({ zoom: state.zoom / 1.2 })),
  setZoom: (zoom) => set({ zoom }),
  setPan: (panX, panY) => set({ panX, panY }),
  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),

  resetZoom: () => {
    get().animateZoom(1, 300);
  },
  resetPosition: () => {
    get().animatePan(0, 0, 300);
  },

  animateZoom: (targetZoom, duration) => {
    const { zoom: startZoom, panX: startX, panY: startY } = get();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const centerXInCanvas = (viewportWidth / 2 - startX) / startZoom;
    const centerYInCanvas = (viewportHeight / 2 - startY) / startZoom;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - (1 - progress) * (1 - progress);

      set({
        zoom: startZoom + (targetZoom - startZoom) * ease,
        panX: viewportWidth / 2 - centerXInCanvas * (startZoom + (targetZoom - startZoom) * ease),
        panY: viewportHeight / 2 - centerYInCanvas * (startZoom + (targetZoom - startZoom) * ease),
      });

      if (progress < 1) requestAnimationFrame(animate);
    };

    animate();
  },

  animatePan: (targetX, targetY, duration) => {
    const { panX: startX, panY: startY } = get();
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - (1 - progress) * (1 - progress);

      set({
        panX: startX + (targetX - startX) * ease,
        panY: startY + (targetY - startY) * ease,
      });

      if (progress < 1) requestAnimationFrame(animate);
    };

    animate();
  },

  // ---- History (undo/redo) ----

  toggleConnectingMode: () => set((state) => ({ isConnectingMode: !state.isConnectingMode })),

  recordHistory: () => {
    const { history, cards, connections } = get();
    const snapshot = cloneSnapshot({ cards, connections });
    set({
      history: [...history, snapshot].slice(-HISTORY_LIMIT),
      future: [],
    });
  },

  undo: () => {
    const { history, future, cards, connections } = get();
    if (history.length === 0) return;

    const previous = history[history.length - 1];
    const current = cloneSnapshot({ cards, connections });
    const restored = cloneSnapshot(previous);

    set({
      cards: restored.cards,
      connections: restored.connections,
      history: history.slice(0, -1),
      future: [...future, current],
      selectedCardIds: [],
      selectedConnectionIds: [],
      aiSelectedCardIds: [],
    });
  },

  redo: () => {
    const { history, future, cards, connections } = get();
    if (future.length === 0) return;

    const next = future[future.length - 1];
    const current = cloneSnapshot({ cards, connections });
    const restored = cloneSnapshot(next);

    set({
      cards: restored.cards,
      connections: restored.connections,
      future: future.slice(0, -1),
      history: [...history, current],
      selectedCardIds: [],
      selectedConnectionIds: [],
      aiSelectedCardIds: [],
    });
  },

  // ---- Card CRUD ----

  addCard: (card) => {
    get().recordHistory();
    const id = uuidv4();
    set((state) => ({
      cards: {
        ...state.cards,
        [id]: {
          ...card,
          id,
          type: card.type || 'text',
          zIndex: card.zIndex ?? getNextZIndex(state.cards),
        },
      },
    }));
    return id;
  },

  updateCard: (cardId, updates, options = {}) => {
    if (!options.skipHistory) get().recordHistory();

    set((state) => {
      const existing = state.cards[cardId];
      if (!existing) return {};

      return {
        cards: {
          ...state.cards,
          [cardId]: { ...existing, ...updates },
        },
      };
    });
  },

  updateCards: (updates, options = {}) => {
    if (!options.skipHistory) get().recordHistory();

    set((state) => {
      const nextCards = { ...state.cards };
      let changed = false;

      Object.entries(updates).forEach(([cardId, update]) => {
        if (nextCards[cardId]) {
          nextCards[cardId] = { ...nextCards[cardId], ...update };
          changed = true;
        }
      });

      return changed ? { cards: nextCards } : {};
    });
  },

  removeCard: (cardId, options = {}) => {
    if (!options.skipHistory) get().recordHistory();

    set((state) => {
      const removedCard = state.cards[cardId];
      const { [cardId]: _, ...remainingCards } = state.cards;
      let nextCards = remainingCards;

      // If removing a group, unlink its children
      if (removedCard?.type === 'group' && Array.isArray(removedCard.childIds)) {
        nextCards = { ...nextCards };
        removedCard.childIds.forEach((childId) => {
          if (nextCards[childId]) {
            nextCards[childId] = { ...nextCards[childId], groupId: null };
          }
        });
      }

      // If the removed card belonged to a group, remove it from the group's childIds
      if (removedCard?.groupId && state.cards[removedCard.groupId]) {
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

      // Remove orphaned connections
      const remainingConnections = { ...state.connections };
      Object.keys(remainingConnections).forEach((connId) => {
        const conn = remainingConnections[connId];
        if (conn.startCardId === cardId || conn.endCardId === cardId) {
          delete remainingConnections[connId];
        }
      });

      return {
        cards: nextCards,
        connections: remainingConnections,
        selectedCardIds: state.selectedCardIds.filter((id) => id !== cardId),
        aiSelectedCardIds: state.aiSelectedCardIds.filter((id) => id !== cardId),
      };
    });
  },

  // ---- Selection ----

  selectCards: (cardIds, options = {}) => set((state) => {
    if (!cardIds || cardIds.length === 0 || options.skipReorder) {
      return { selectedCardIds: cardIds };
    }

    const nextCards = reorderCardsToFront(state.cards, cardIds);
    if (nextCards === state.cards) {
      return { selectedCardIds: cardIds };
    }

    return { cards: nextCards, selectedCardIds: cardIds };
  }),

  clearSelection: () => set({ selectedCardIds: [], selectedConnectionIds: [] }),

  // ---- AI Selection (for context) ----

  toggleAiSelectedCard: (cardId) => set((state) => {
    const isSelected = state.aiSelectedCardIds.includes(cardId);
    const card = state.cards[cardId];

    const collectDescendants = (rootId, cards) => {
      const ids = new Set([rootId]);
      const root = cards[rootId];
      if (root?.type === 'group' && Array.isArray(root.childIds)) {
        const queue = [...root.childIds];
        while (queue.length > 0) {
          const childId = queue.shift();
          ids.add(childId);
          const child = cards[childId];
          if (child?.type === 'group' && Array.isArray(child.childIds)) {
            child.childIds.forEach((id) => {
              if (!ids.has(id)) queue.push(id);
            });
          }
        }
      }
      return ids;
    };

    if (isSelected) {
      const toRemove = collectDescendants(cardId, state.cards);
      return { aiSelectedCardIds: state.aiSelectedCardIds.filter((id) => !toRemove.has(id)) };
    }

    const toAdd = collectDescendants(cardId, state.cards);
    const newIds = [...toAdd].filter((id) => !state.aiSelectedCardIds.includes(id));
    return { aiSelectedCardIds: [...state.aiSelectedCardIds, ...newIds] };
  }),

  clearAiSelection: () => set({ aiSelectedCardIds: [] }),

  // ---- Connections ----

  addConnection: (connection) => {
    get().recordHistory();
    const id = uuidv4();
    set((state) => ({
      connections: { ...state.connections, [id]: { ...connection, id } },
    }));
    return id;
  },

  updateConnection: (connectionId, updates, options = {}) => {
    if (!options.skipHistory) get().recordHistory();
    set((state) => ({
      connections: {
        ...state.connections,
        [connectionId]: { ...state.connections[connectionId], ...updates },
      },
    }));
  },

  removeConnection: (connectionId, options = {}) => {
    if (!options.skipHistory) get().recordHistory();
    set((state) => {
      const { [connectionId]: _, ...rest } = state.connections;
      return {
        connections: rest,
        selectedConnectionIds: state.selectedConnectionIds.filter((id) => id !== connectionId),
      };
    });
  },

  selectConnections: (connectionIds) => set({ selectedConnectionIds: connectionIds }),

  // ---- Hydration (load from server) ----

  hydrate: (state) => set(() => ({
    ...state,
    selectedCardIds: [],
    selectedConnectionIds: [],
    aiSelectedCardIds: [],
    history: [],
    future: [],
  })),
}));

export default useCanvasStore;
