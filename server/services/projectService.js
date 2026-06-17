import { v4 as uuidv4 } from 'uuid';
import { ensureMigrated, getDb } from './db.js';

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const trimToNull = (value) => (typeof value === 'string' && value.trim()) ? value.trim() : null;

class ProjectService {
  async list() {
    await ensureMigrated();
    const db = await getDb();
    const projects = db.prepare(`
      SELECT p.id, p.name, p.folder_id, p.sort_order, p.created_at, p.updated_at,
        (SELECT COUNT(*) FROM canvas c WHERE c.id = p.id) AS canvas_count
      FROM project p
      ORDER BY p.sort_order ASC, p.name ASC
    `).all();
    return projects.map((row) => ({
      id: row.id,
      name: row.name,
      folderId: row.folder_id || null,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      canvasCount: row.canvas_count,
    }));
  }

  async create(name, folderId = null, id = null) {
    await ensureMigrated();
    const db = await getDb();
    const resolvedId = id || uuidv4();
    const now = new Date().toISOString();
    const resolvedName = trimToNull(name) || 'Untitled Project';
    const maxOrder = db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
      FROM project
      WHERE folder_id IS ? 
    `).get(folderId || null).next_order;

    db.prepare(`
      INSERT INTO project (id, name, folder_id, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(resolvedId, resolvedName, folderId || null, maxOrder, now, now);

    return {
      id: resolvedId,
      name: resolvedName,
      folderId: folderId || null,
      sortOrder: maxOrder,
      createdAt: now,
      updatedAt: now,
      canvasCount: 0,
    };
  }

  async update(id, payload) {
    await ensureMigrated();
    const db = await getDb();
    const existing = db.prepare('SELECT id FROM project WHERE id = ?').get(id);
    if (!existing) return null;

    const fields = [];
    const values = [];

    if (payload.name !== undefined) {
      fields.push('name = ?');
      values.push(trimToNull(payload.name) || 'Untitled Project');
    }
    if (payload.folderId !== undefined) {
      fields.push('folder_id = ?');
      values.push(payload.folderId || null);
    }
    if (payload.sortOrder !== undefined) {
      fields.push('sort_order = ?');
      values.push(payload.sortOrder);
    }

    if (fields.length === 0) {
      const row = db.prepare('SELECT * FROM project WHERE id = ?').get(id);
      return this._format(row);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE project SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const row = db.prepare('SELECT * FROM project WHERE id = ?').get(id);
    return this._format(row);
  }

  async delete(id) {
    await ensureMigrated();
    const db = await getDb();
    const existing = db.prepare('SELECT id FROM project WHERE id = ?').get(id);
    if (!existing) return false;
    db.prepare('DELETE FROM project WHERE id = ?').run(id);
    return true;
  }

  async listFolders() {
    await ensureMigrated();
    const db = await getDb();
    const folders = db.prepare(`
      SELECT f.id, f.name, f.parent_folder_id, f.sort_order, f.created_at, f.updated_at
      FROM canvas_folder f
      ORDER BY f.sort_order ASC, f.name ASC
    `).all();
    return folders.map((row) => ({
      id: row.id,
      name: row.name,
      parentFolderId: row.parent_folder_id || null,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createFolder(name, parentFolderId = null) {
    await ensureMigrated();
    const db = await getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const resolvedName = trimToNull(name) || 'New Folder';
    const maxOrder = db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
      FROM canvas_folder
      WHERE parent_folder_id IS ?
    `).get(parentFolderId || null).next_order;

    db.prepare(`
      INSERT INTO canvas_folder (id, name, parent_folder_id, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, resolvedName, parentFolderId || null, maxOrder, now, now);

    return {
      id,
      name: resolvedName,
      parentFolderId: parentFolderId || null,
      sortOrder: maxOrder,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateFolder(id, payload) {
    await ensureMigrated();
    const db = await getDb();
    const existing = db.prepare('SELECT id FROM canvas_folder WHERE id = ?').get(id);
    if (!existing) return null;

    const fields = [];
    const values = [];

    if (payload.name !== undefined) {
      fields.push('name = ?');
      values.push(trimToNull(payload.name) || 'New Folder');
    }
    if (payload.parentFolderId !== undefined) {
      fields.push('parent_folder_id = ?');
      values.push(payload.parentFolderId || null);
    }
    if (payload.sortOrder !== undefined) {
      fields.push('sort_order = ?');
      values.push(payload.sortOrder);
    }

    if (fields.length === 0) {
      const row = db.prepare('SELECT * FROM canvas_folder WHERE id = ?').get(id);
      return this._formatFolder(row);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE canvas_folder SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const row = db.prepare('SELECT * FROM canvas_folder WHERE id = ?').get(id);
    return this._formatFolder(row);
  }

  async deleteFolder(id) {
    await ensureMigrated();
    const db = await getDb();
    const existing = db.prepare('SELECT id FROM canvas_folder WHERE id = ?').get(id);
    if (!existing) return false;

    // Move projects under this folder to root
    db.prepare('UPDATE project SET folder_id = NULL WHERE folder_id = ?').run(id);
    // Move sub-folders to parent
    const subFolders = db.prepare('SELECT id, parent_folder_id FROM canvas_folder WHERE parent_folder_id = ?').all(id);
    const parentId = existing.parent_folder_id || null;
    subFolders.forEach((f) => {
      db.prepare('UPDATE canvas_folder SET parent_folder_id = ? WHERE id = ?').run(parentId, f.id);
    });

    db.prepare('DELETE FROM canvas_folder WHERE id = ?').run(id);
    return true;
  }

  async getTree() {
    await ensureMigrated();
    const db = await getDb();
    const folders = db.prepare(`SELECT id, name, parent_folder_id, sort_order FROM canvas_folder ORDER BY sort_order ASC, name ASC`).all();
    const projects = db.prepare(`
      SELECT p.id, p.name, p.folder_id, p.sort_order,
        (SELECT COUNT(*) FROM canvas c WHERE c.id = p.id) AS canvas_count
      FROM project p
      ORDER BY p.sort_order ASC, p.name ASC
    `).all();

    return {
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        parentFolderId: f.parent_folder_id || null,
        sortOrder: f.sort_order,
      })),
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        folderId: p.folder_id || null,
        sortOrder: p.sort_order,
        canvasCount: p.canvas_count,
      })),
    };
  }

  _format(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      folderId: row.folder_id || null,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  _formatFolder(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      parentFolderId: row.parent_folder_id || null,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default new ProjectService();
