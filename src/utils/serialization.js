/**
 * Shared serialization and normalization helpers used across services and DB layer.
 * Centralized here to eliminate duplication between db.js and canvasService.js.
 */

export const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const normalizeNumber = (value, fallback) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const safeParseJson = (value) => {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const DEFAULT_CANVAS_STATE = Object.freeze({
  panX: 0,
  panY: 0,
  zoom: 1,
  cards: {},
  connections: {},
});

export const normalizeCanvasState = (state) => {
  if (!isRecord(state)) return { ...DEFAULT_CANVAS_STATE };
  return {
    panX: normalizeNumber(state.panX, 0),
    panY: normalizeNumber(state.panY, 0),
    zoom: normalizeNumber(state.zoom, 1),
    cards: isRecord(state.cards) ? state.cards : {},
    connections: isRecord(state.connections) ? state.connections : {},
  };
};
