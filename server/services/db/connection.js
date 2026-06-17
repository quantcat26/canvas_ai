/**
 * Database connection management.
 * Provides a singleton SQLite connection with schema initialization.
 */

import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

import { ensureSchema, ensureCardColumns, ensureAiConfigColumns } from './schema.js';
import { runCanvasMigration } from './migrations.js';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'canvas_ai.sqlite');

let dbInstance = null;
let migrationPromise = null;

export const getDb = async () => {
  if (dbInstance) return dbInstance;
  await fs.mkdir(dataDir, { recursive: true });
  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  ensureSchema(dbInstance);
  ensureCardColumns(dbInstance);
  ensureAiConfigColumns(dbInstance);
  return dbInstance;
};

export const ensureMigrated = async () => {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    const db = await getDb();
    runCanvasMigration(db);
  })();

  return migrationPromise;
};

export const closeDb = () => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    migrationPromise = null;
  }
};
