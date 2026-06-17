import { v4 as uuidv4 } from 'uuid';
import { getDb, ensureMigrated, insertCards, insertConnections, readCards, readConnections, deleteCanvasContents } from './db.js';
import { normalizeCanvasState } from '../utils/serialization.js';

class CanvasService {
  async list() {
    await ensureMigrated();
    const db = await getDb();
    const rows = db.prepare(`
      SELECT
        id,
        name,
        updated_at,
        (SELECT COUNT(1) FROM card WHERE canvas_id = canvas.id) AS card_count,
        (SELECT COUNT(1) FROM connection WHERE canvas_id = canvas.id) AS connection_count
      FROM canvas
    `).all();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      updatedAt: row.updated_at,
      cardCount: row.card_count || 0,
      connectionCount: row.connection_count || 0,
    }));
  }

  async get(canvasId) {
    await ensureMigrated();
    const db = await getDb();

    const row = db.prepare(`
      SELECT id, name, pan_x, pan_y, zoom, updated_at
      FROM canvas
      WHERE id = ?
    `).get(canvasId);

    if (!row) return null;

    const cards = readCards(db, canvasId);
    const connections = readConnections(db, canvasId);

    return {
      id: row.id,
      name: row.name,
      updatedAt: row.updated_at,
      state: {
        panX: row.pan_x,
        panY: row.pan_y,
        zoom: row.zoom,
        cards,
        connections,
      },
    };
  }

  async create(name = 'Untitled Canvas', state, id = null) {
    await ensureMigrated();
    const db = await getDb();
    const resolvedId = id || uuidv4();
    const now = new Date().toISOString();
    const normalized = normalizeCanvasState(state);

    const execute = db.transaction(() => {
      db.prepare(`
        INSERT INTO canvas (id, name, pan_x, pan_y, zoom, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(resolvedId, name, normalized.panX, normalized.panY, normalized.zoom, now);

      insertCards(db, resolvedId, normalized.cards);
      insertConnections(db, resolvedId, normalized.connections);
    });

    execute();

    return {
      id: resolvedId,
      name,
      updatedAt: now,
      state: normalized,
    };
  }

  async upsert(canvasId, payload) {
    await ensureMigrated();
    const db = await getDb();
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT name FROM canvas WHERE id = ?').get(canvasId);
    const resolvedName = payload.name || existing?.name || 'Untitled Canvas';
    const normalized = normalizeCanvasState(payload.state);

    const execute = db.transaction(() => {
      db.prepare(`
        INSERT INTO canvas (id, name, pan_x, pan_y, zoom, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          pan_x = excluded.pan_x,
          pan_y = excluded.pan_y,
          zoom = excluded.zoom,
          updated_at = excluded.updated_at
      `).run(canvasId, resolvedName, normalized.panX, normalized.panY, normalized.zoom, now);

      deleteCanvasContents(db, canvasId);
      insertCards(db, canvasId, normalized.cards);
      insertConnections(db, canvasId, normalized.connections);
    });

    execute();

    return {
      id: canvasId,
      name: resolvedName,
      updatedAt: now,
      state: normalized,
    };
  }
}

export default new CanvasService();
