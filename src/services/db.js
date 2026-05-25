import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'canvas_ai.sqlite');

let dbInstance;
let migrationPromise;

const defaultState = {
  panX: 0,
  panY: 0,
  zoom: 1,
  cards: {},
  connections: {},
};

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeNumber = (value, fallback) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const normalizeState = (state) => {
  if (!isRecord(state)) return { ...defaultState };
  return {
    panX: normalizeNumber(state.panX, 0),
    panY: normalizeNumber(state.panY, 0),
    zoom: normalizeNumber(state.zoom, 1),
    cards: isRecord(state.cards) ? state.cards : {},
    connections: isRecord(state.connections) ? state.connections : {},
  };
};

const safeParseJson = (value) => {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const ensureSchema = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_setting (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_config (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      api_key_enc TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      temperature REAL,
      max_tokens INTEGER,
      path TEXT NOT NULL,
      header_name TEXT NOT NULL,
      header_prefix TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS canvas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pan_x REAL NOT NULL,
      pan_y REAL NOT NULL,
      zoom REAL NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS card (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      position_x REAL NOT NULL,
      position_y REAL NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      collapsed INTEGER NOT NULL,
      expanded_width REAL,
      expanded_height REAL,
      file_type TEXT,
      angle REAL,
      group_id TEXT,
      group_title TEXT,
      group_child_ids TEXT,
      group_auto_resize INTEGER,
      FOREIGN KEY(canvas_id) REFERENCES canvas(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS connection (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      start_card_id TEXT NOT NULL,
      end_card_id TEXT NOT NULL,
      start_x REAL NOT NULL,
      start_y REAL NOT NULL,
      end_x REAL NOT NULL,
      end_y REAL NOT NULL,
      FOREIGN KEY(canvas_id) REFERENCES canvas(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_card_canvas ON card(canvas_id);
    CREATE INDEX IF NOT EXISTS idx_connection_canvas ON connection(canvas_id);
  `);
};

const initDb = async () => {
  if (dbInstance) return dbInstance;
  await fs.mkdir(dataDir, { recursive: true });
  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  ensureSchema(dbInstance);
  ensureCardColumns(dbInstance);
  return dbInstance;
};

function ensureCardColumns(db) {
  const columns = db.prepare('PRAGMA table_info(card)').all().map((row) => row.name);
  const addColumn = (name, definition) => {
    if (columns.includes(name)) return;
    db.exec(`ALTER TABLE card ADD COLUMN ${definition}`);
  };

  addColumn('group_id', 'group_id TEXT');
  addColumn('group_title', 'group_title TEXT');
  addColumn('group_child_ids', 'group_child_ids TEXT');
  addColumn('group_auto_resize', 'group_auto_resize INTEGER');
}

const getTableColumns = (db, tableName) => {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return rows.map((row) => row.name);
};

const insertCards = (db, canvasId, cards) => {
  const insertCard = db.prepare(`
    INSERT INTO card (
      id, canvas_id, type, content,
      position_x, position_y, width, height,
      collapsed, expanded_width, expanded_height,
      file_type, angle,
      group_id, group_title, group_child_ids, group_auto_resize
    ) VALUES (
      @id, @canvasId, @type, @content,
      @positionX, @positionY, @width, @height,
      @collapsed, @expandedWidth, @expandedHeight,
      @fileType, @angle,
      @groupId, @groupTitle, @groupChildIds, @groupAutoResize
    )
  `);

  Object.entries(cards || {}).forEach(([key, card]) => {
    if (!isRecord(card)) return;
    const id = typeof card.id === 'string' && card.id.trim() ? card.id : key;
    const position = isRecord(card.position) ? card.position : {};
    const size = isRecord(card.size) ? card.size : {};
    const expandedSize = isRecord(card.expandedSize) ? card.expandedSize : null;
    const groupChildIds = Array.isArray(card.childIds) ? JSON.stringify(card.childIds) : null;
    const groupAutoResize = typeof card.autoResize === 'boolean' ? (card.autoResize ? 1 : 0) : null;

    insertCard.run({
      id,
      canvasId,
      type: typeof card.type === 'string' ? card.type : 'text',
      content: typeof card.content === 'string' ? card.content : '',
      positionX: normalizeNumber(position.x, 0),
      positionY: normalizeNumber(position.y, 0),
      width: normalizeNumber(size.width, 0),
      height: normalizeNumber(size.height, 0),
      collapsed: card.collapsed ? 1 : 0,
      expandedWidth: expandedSize ? normalizeNumber(expandedSize.width, null) : null,
      expandedHeight: expandedSize ? normalizeNumber(expandedSize.height, null) : null,
      fileType: typeof card.fileType === 'string' ? card.fileType : null,
      angle: normalizeNumber(card.angle, null),
      groupId: typeof card.groupId === 'string' ? card.groupId : null,
      groupTitle: typeof card.title === 'string' ? card.title : null,
      groupChildIds,
      groupAutoResize,
    });
  });
};

const insertConnections = (db, canvasId, connections) => {
  const insertConnection = db.prepare(`
    INSERT INTO connection (
      id, canvas_id, start_card_id, end_card_id,
      start_x, start_y, end_x, end_y
    ) VALUES (
      @id, @canvasId, @startCardId, @endCardId,
      @startX, @startY, @endX, @endY
    )
  `);

  Object.entries(connections || {}).forEach(([key, connection]) => {
    if (!isRecord(connection)) return;
    const id = typeof connection.id === 'string' && connection.id.trim() ? connection.id : key;
    const startPoint = isRecord(connection.startPoint) ? connection.startPoint : {};
    const endPoint = isRecord(connection.endPoint) ? connection.endPoint : {};

    insertConnection.run({
      id,
      canvasId,
      startCardId: typeof connection.startCardId === 'string' ? connection.startCardId : '',
      endCardId: typeof connection.endCardId === 'string' ? connection.endCardId : '',
      startX: normalizeNumber(startPoint.x, 0),
      startY: normalizeNumber(startPoint.y, 0),
      endX: normalizeNumber(endPoint.x, 0),
      endY: normalizeNumber(endPoint.y, 0),
    });
  });
};

export const getDb = async () => {
  return initDb();
};

export const ensureMigrated = async () => {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    const db = await initDb();
    const canvasColumns = getTableColumns(db, 'canvas');
    const hasStateJson = canvasColumns.includes('state_json');

    if (hasStateJson) {
      const rows = db.prepare('SELECT id, name, updated_at, state_json FROM canvas').all();
      db.pragma('foreign_keys = OFF');
      const migrateCanvas = db.transaction(() => {
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
        db.exec('DELETE FROM card');
        db.exec('DELETE FROM connection');

        const insertCanvas = db.prepare(`
          INSERT INTO canvas_new (id, name, pan_x, pan_y, zoom, updated_at)
          VALUES (@id, @name, @panX, @panY, @zoom, @updatedAt)
        `);

        rows.forEach((row) => {
          const state = normalizeState(safeParseJson(row.state_json));
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

      migrateCanvas();
      db.pragma('foreign_keys = ON');
    }

  })();

  return migrationPromise;
};
