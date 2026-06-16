/**
 * Canvas state migration from legacy state_json column to normalized columns.
 */

import { normalizeCanvasState, safeParseJson } from '../../utils/serialization.js';
import { insertCards, insertConnections, deleteCanvasContents } from './repositories.js';
import { getTableColumns } from './schema.js';

const hasStateJsonColumn = (db) => {
  const columns = getTableColumns(db, 'canvas');
  return columns.includes('state_json');
};

export const runCanvasMigration = (db) => {
  if (!hasStateJsonColumn(db)) return;

  const rows = db.prepare('SELECT id, name, updated_at, state_json FROM canvas').all();

  db.pragma('foreign_keys = OFF');

  const migrate = db.transaction(() => {
    db.exec('DROP TABLE IF EXISTS canvas_new');
    db.exec(`
      CREATE TABLE canvas_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pan_x REAL NOT NULL,
        pan_y REAL NOT NULL,
        zoom REAL NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    deleteCanvasContents(db, '*');
    db.exec('DELETE FROM card');
    db.exec('DELETE FROM connection');

    const insertCanvas = db.prepare(`
      INSERT INTO canvas_new (id, name, pan_x, pan_y, zoom, updated_at)
      VALUES (@id, @name, @panX, @panY, @zoom, @updatedAt)
    `);

    rows.forEach((row) => {
      const state = normalizeCanvasState(safeParseJson(row.state_json));
      const canvasId = String(row.id || '');

      insertCanvas.run({
        id: canvasId,
        name: String(row.name || 'Untitled Canvas'),
        panX: state.panX,
        panY: state.panY,
        zoom: state.zoom,
        updatedAt: row.updated_at || new Date().toISOString(),
      });

      insertCards(db, canvasId, state.cards);
      insertConnections(db, canvasId, state.connections);
    });

    db.exec('DROP TABLE canvas');
    db.exec('ALTER TABLE canvas_new RENAME TO canvas');
  });

  migrate();
  db.pragma('foreign_keys = ON');
};
