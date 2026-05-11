import canvasService from '../services/canvasService.js';
import { sendApiError } from '../utils/apiResponse.js';

const isObjectRecord = (value) => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const validateCanvasState = (state) => {
  if (!isObjectRecord(state)) return false;

  return (
    typeof state.panX === 'number' && Number.isFinite(state.panX) &&
    typeof state.panY === 'number' && Number.isFinite(state.panY) &&
    typeof state.zoom === 'number' && Number.isFinite(state.zoom) &&
    isObjectRecord(state.cards) &&
    isObjectRecord(state.connections)
  );
};

const parseName = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

class CanvasController {
  async list(req, res) {
    try {
      const items = await canvasService.list();
      res.json(items);
    } catch (error) {
      console.error('Failed to list canvases', error);
      sendApiError(res, 500, 'CANVAS_LIST_FAILED', 'Unable to retrieve the canvas list.');
    }
  }

  async get(req, res) {
    try {
      const { id } = req.params;
      const record = await canvasService.get(id);
      if (!record) {
        sendApiError(res, 404, 'CANVAS_NOT_FOUND', 'Canvas not found.');
        return;
      }
      res.json(record);
    } catch (error) {
      console.error('Failed to get canvas', error);
      sendApiError(res, 500, 'CANVAS_GET_FAILED', 'Unable to retrieve the canvas.');
    }
  }

  async create(req, res) {
    try {
      const body = isObjectRecord(req.body) ? req.body : {};
      const name = parseName(body.name);
      const state = body.state;

      if (state !== undefined && !validateCanvasState(state)) {
        sendApiError(res, 400, 'INVALID_CANVAS_STATE', 'Invalid state format; panX, panY, zoom, cards, and connections are required.');
        return;
      }

      const created = await canvasService.create(name, state);
      res.status(201).json(created);
    } catch (error) {
      console.error('Failed to create canvas', error);
      sendApiError(res, 500, 'CANVAS_CREATE_FAILED', 'Unable to create the canvas.');
    }
  }

  async save(req, res) {
    try {
      const { id } = req.params;
      const body = isObjectRecord(req.body) ? req.body : null;
      const name = parseName(body?.name);
      const state = body?.state;

      if (!id || id.trim().length === 0) {
        sendApiError(res, 400, 'INVALID_CANVAS_ID', 'Canvas ID cannot be empty.');
        return;
      }

      if (state === undefined) {
        sendApiError(res, 400, 'MISSING_CANVAS_STATE', 'The state field is required.');
        return;
      }

      if (!validateCanvasState(state)) {
        sendApiError(res, 400, 'INVALID_CANVAS_STATE', 'Invalid state format; panX, panY, zoom, cards, and connections are required.');
        return;
      }

      const saved = await canvasService.upsert(id, { name, state });
      res.json(saved);
    } catch (error) {
      console.error('Failed to save canvas', error);
      sendApiError(res, 500, 'CANVAS_SAVE_FAILED', 'Unable to save the canvas.');
    }
  }
}

export default new CanvasController();
