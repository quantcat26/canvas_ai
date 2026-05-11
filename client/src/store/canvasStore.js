import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

const useCanvasStore = create((set, get) => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  cards: {},
  connections: {},
  selectedCardIds: [],
  selectedConnectionIds: [],
  isConnectingMode: false,

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

  addCard: (card) => {
    const id = uuidv4();
    set((state) => ({
      cards: {
        ...state.cards,
        [id]: { ...card, id },
      },
    }));
    return id;
  },

  updateCard: (cardId, updates) => set((state) => ({
    cards: {
      ...state.cards,
      [cardId]: { ...state.cards[cardId], ...updates },
    },
  })),

  removeCard: (cardId) => set((state) => {
    const { [cardId]: _, ...remainingCards } = state.cards;

    const remainingConnections = { ...state.connections };
    Object.keys(remainingConnections).forEach((connectionId) => {
      const connection = remainingConnections[connectionId];
      if (connection.startCardId === cardId || connection.endCardId === cardId) {
        delete remainingConnections[connectionId];
      }
    });

    return {
      cards: remainingCards,
      connections: remainingConnections,
      selectedCardIds: state.selectedCardIds.filter((id) => id !== cardId),
    };
  }),

  selectCards: (cardIds) => set({ selectedCardIds: cardIds }),

  addConnection: (connection) => {
    const id = uuidv4();
    set((state) => ({
      connections: {
        ...state.connections,
        [id]: { ...connection, id },
      },
    }));
    return id;
  },

  updateConnection: (connectionId, updates) => set((state) => ({
    connections: {
      ...state.connections,
      [connectionId]: { ...state.connections[connectionId], ...updates },
    },
  })),

  removeConnection: (connectionId) => set((state) => {
    const { [connectionId]: _, ...remainingConnections } = state.connections;
    return {
      connections: remainingConnections,
      selectedConnectionIds: state.selectedConnectionIds.filter((id) => id !== connectionId),
    };
  }),

  selectConnections: (connectionIds) => set({ selectedConnectionIds: connectionIds }),

  clearSelection: () => set({ selectedCardIds: [], selectedConnectionIds: [] }),

  hydrate: (state) => set(() => ({
    ...state,
    selectedCardIds: [],
    selectedConnectionIds: [],
  })),
}));

export default useCanvasStore;
