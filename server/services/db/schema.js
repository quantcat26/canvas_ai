/**
 * Database schema definitions and migration helpers.
 * Split from db.js to separate schema concerns from connection management.
 */

const SCHEMA_SQL = `
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
    allow_images INTEGER NOT NULL DEFAULT 0,
    allow_videos INTEGER NOT NULL DEFAULT 0,
    allow_pdfs INTEGER NOT NULL DEFAULT 0,
    allow_documents INTEGER NOT NULL DEFAULT 0,
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
    url TEXT,
    video_id TEXT,
    preview_type TEXT,
    file_name TEXT,
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

  CREATE TABLE IF NOT EXISTS project (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    folder_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS canvas_folder (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_folder_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

const INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_card_canvas ON card(canvas_id);
  CREATE INDEX IF NOT EXISTS idx_connection_canvas ON connection(canvas_id);
  CREATE INDEX IF NOT EXISTS idx_project_folder ON project(folder_id);
  CREATE INDEX IF NOT EXISTS idx_canvas_folder_parent ON canvas_folder(parent_folder_id);
`;

/**
 * Ensures all base tables and indexes exist.
 */
export const ensureSchema = (db) => {
  db.exec(SCHEMA_SQL);
  db.exec(INDEXES_SQL);
};

/**
 * Lazily adds missing columns to the card table for backward compatibility.
 */
export const ensureCardColumns = (db) => {
  const columns = db.prepare('PRAGMA table_info(card)').all().map((row) => row.name);
  const addColumn = (name, definition) => {
    if (columns.includes(name)) return;
    db.exec(`ALTER TABLE card ADD COLUMN ${name} ${definition}`);
  };

  addColumn('url', 'TEXT');
  addColumn('video_id', 'TEXT');
  addColumn('preview_type', 'TEXT');
  addColumn('file_name', 'TEXT');
  addColumn('group_id', 'TEXT');
  addColumn('group_title', 'TEXT');
  addColumn('group_child_ids', 'TEXT');
  addColumn('group_auto_resize', 'INTEGER');
};

/**
 * Lazily adds missing columns to the ai_config table.
 */
export const ensureAiConfigColumns = (db) => {
  const columns = db.prepare('PRAGMA table_info(ai_config)').all().map((row) => row.name);
  const addColumn = (name, definition) => {
    if (columns.includes(name)) return;
    db.exec(`ALTER TABLE ai_config ADD COLUMN ${name} ${definition}`);
  };

  addColumn('allow_images', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('allow_videos', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('allow_pdfs', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('allow_documents', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('header_name', 'TEXT NOT NULL DEFAULT \'Authorization\'');
  addColumn('header_prefix', 'TEXT NOT NULL DEFAULT \'Bearer \'');
  addColumn('system_prompt', 'TEXT NOT NULL DEFAULT \'\'');
};

/**
 * Returns the column names of a table.
 */
export const getTableColumns = (db, table) =>
  db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
