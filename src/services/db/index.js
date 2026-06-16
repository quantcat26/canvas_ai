/**
 * Database module barrel export.
 * All consumers import from './db.js' which now re-exports from here.
 */

export { getDb, ensureMigrated, closeDb } from './connection.js';
export { insertCards, insertConnections, readCards, readConnections, deleteCanvasContents } from './repositories.js';
export { ensureSchema, ensureCardColumns, ensureAiConfigColumns, getTableColumns } from './schema.js';
