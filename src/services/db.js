/**
 * Backward-compatible re-export from db/ module.
 *
 * Previously all DB logic lived in this single file. It has been split into:
 *   db/connection.js  – singleton connection + migration orchestration
 *   db/schema.js      – table creation and column migration
 *   db/migrations.js  – canvas state_json → normalized columns
 *   db/repositories.js – card/connection CRUD helpers
 */

export {
  getDb,
  ensureMigrated,
  insertCards,
  insertConnections,
  readCards,
  readConnections,
  deleteCanvasContents,
} from './db/index.js';
