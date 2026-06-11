/**
 * Canvas utility helpers extracted from canvasStore.js.
 * Keeps the Zustand store focused on state management.
 */

/**
 * Creates a deep clone of a JSON-serializable snapshot.
 */
export const cloneSnapshot = (snapshot) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(snapshot);
  }
  return JSON.parse(JSON.stringify(snapshot));
};

const getCardZIndex = (card) => (typeof card?.zIndex === 'number' ? card.zIndex : 0);

/**
 * Returns the next z-index value for a new card in the given cards record.
 */
export const getNextZIndex = (cards) => {
  const values = Object.values(cards);
  if (values.length === 0) return 0;
  return Math.max(...values.map(getCardZIndex)) + 1;
};

/**
 * Reorders the specified cardIds to the top (highest z-index) within the cards record.
 * Returns a new cards object with updated z-indices.
 */
export const reorderCardsToFront = (cards, cardIds) => {
  if (!cardIds || cardIds.length === 0) return cards;

  const reorderableIds = new Set(
    cardIds.filter((id) => {
      const card = cards[id];
      if (!card) return false;
      if (card.type !== 'group') return true;
      return Boolean(card.collapsed);
    }),
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
