import { v4 as uuidv4 } from 'uuid';
import { ensureMigrated, getDb } from './db.js';

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

    return rows.map((row) => {
      return {
        id: row.id,
        name: row.name,
        updatedAt: row.updated_at,
        cardCount: row.card_count || 0,
        connectionCount: row.connection_count || 0,
      };
    });
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
    const cardRows = db.prepare(`
      SELECT
        id, type, content,
        position_x, position_y, width, height,
        collapsed, expanded_width, expanded_height,
        file_type, angle,
        group_id, group_title, group_child_ids, group_auto_resize
      FROM card
      WHERE canvas_id = ?
    `).all(canvasId);

    const connectionRows = db.prepare(`
      SELECT
        id, start_card_id, end_card_id,
        start_x, start_y, end_x, end_y
      FROM connection
      WHERE canvas_id = ?
    `).all(canvasId);

    const cards = {};
    cardRows.forEach((card) => {
      const childIds = safeParseJson(card.group_child_ids);
      const normalizedChildIds = Array.isArray(childIds) ? childIds : undefined;
      const groupId = typeof card.group_id === 'string' && card.group_id.trim().length > 0
        ? card.group_id
        : undefined;
      const autoResize = card.group_auto_resize === null || card.group_auto_resize === undefined
        ? undefined
        : Boolean(card.group_auto_resize);

      cards[card.id] = {
        id: card.id,
        type: card.type,
        content: card.content,
        position: { x: card.position_x, y: card.position_y },
        size: { width: card.width, height: card.height },
        collapsed: Boolean(card.collapsed),
        expandedSize: card.expanded_width !== null && card.expanded_height !== null
          ? { width: card.expanded_width, height: card.expanded_height }
          : undefined,
        fileType: card.file_type || undefined,
        angle: card.angle ?? undefined,
        groupId,
        title: typeof card.group_title === 'string' && card.group_title.length > 0
          ? card.group_title
          : undefined,
        childIds: normalizedChildIds,
        autoResize,
      };
    });

    const connections = {};
    connectionRows.forEach((connection) => {
      connections[connection.id] = {
        id: connection.id,
        startCardId: connection.start_card_id,
        endCardId: connection.end_card_id,
        startPoint: { x: connection.start_x, y: connection.start_y },
        endPoint: { x: connection.end_x, y: connection.end_y },
      };
    });

    const state = {
      panX: row.pan_x,
      panY: row.pan_y,
      zoom: row.zoom,
      cards,
      connections,
    };
    return {
      id: row.id,
      name: row.name,
      updatedAt: row.updated_at,
      state,
    };
  }

  async create(name = 'Untitled Canvas', state) {
    await ensureMigrated();
    const db = await getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const nextState = normalizeState(state);

    const insert = db.transaction(() => {
      db.prepare(`
        INSERT INTO canvas (id, name, pan_x, pan_y, zoom, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, name, nextState.panX, nextState.panY, nextState.zoom, now);

      insertCards(db, id, nextState.cards);
      insertConnections(db, id, nextState.connections);
    });

    insert();

    return {
      id,
      name,
      updatedAt: now,
      state: nextState,
    };
  }

  async upsert(canvasId, payload) {
    await ensureMigrated();
    const db = await getDb();
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT name FROM canvas WHERE id = ?').get(canvasId);
    const resolvedName = payload.name || existing?.name || 'Untitled Canvas';
    const nextState = normalizeState(payload.state);

    const upsert = db.transaction(() => {
      db.prepare(`
        INSERT INTO canvas (id, name, pan_x, pan_y, zoom, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          pan_x = excluded.pan_x,
          pan_y = excluded.pan_y,
          zoom = excluded.zoom,
          updated_at = excluded.updated_at
      `).run(canvasId, resolvedName, nextState.panX, nextState.panY, nextState.zoom, now);

      db.prepare('DELETE FROM card WHERE canvas_id = ?').run(canvasId);
      db.prepare('DELETE FROM connection WHERE canvas_id = ?').run(canvasId);

      insertCards(db, canvasId, nextState.cards);
      insertConnections(db, canvasId, nextState.connections);
    });

    upsert();

    return {
      id: canvasId,
      name: resolvedName,
      updatedAt: now,
      state: nextState,
    };
  }
}

export default new CanvasService();
