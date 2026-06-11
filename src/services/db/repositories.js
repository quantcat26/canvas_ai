/**
 * Card and connection repository functions.
 * Unified inserts used by both migration (db.js) and canvasService.js.
 */

import { isRecord, normalizeNumber, safeParseJson } from '../../utils/serialization.js';

/**
 * Inserts a batch of cards for a given canvas.
 */
export const insertCards = (db, canvasId, cards) => {
  const insertCard = db.prepare(`
    INSERT INTO card (
      id, canvas_id, type, content,
      url, video_id, preview_type, file_name,
      position_x, position_y, width, height,
      collapsed, expanded_width, expanded_height,
      file_type, angle,
      group_id, group_title, group_child_ids, group_auto_resize
    ) VALUES (
      @id, @canvasId, @type, @content,
      @url, @videoId, @previewType, @fileName,
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
      url: typeof card.url === 'string' ? card.url : null,
      videoId: typeof card.videoId === 'string' ? card.videoId : null,
      previewType: typeof card.previewType === 'string' ? card.previewType : null,
      fileName: typeof card.fileName === 'string' ? card.fileName : null,
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

/**
 * Inserts a batch of connections for a given canvas.
 */
export const insertConnections = (db, canvasId, connections) => {
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

/**
 * Reads all cards for a canvas and returns them as a record keyed by card id.
 */
export const readCards = (db, canvasId) => {
  const rows = db.prepare(`
    SELECT
      id, type, content,
      url, video_id, preview_type, file_name,
      position_x, position_y, width, height,
      collapsed, expanded_width, expanded_height,
      file_type, angle,
      group_id, group_title, group_child_ids, group_auto_resize
    FROM card
    WHERE canvas_id = ?
  `).all(canvasId);

  const cards = {};
  rows.forEach((card) => {
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
      url: card.url || undefined,
      videoId: card.video_id || undefined,
      previewType: card.preview_type || undefined,
      fileName: card.file_name || undefined,
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

  return cards;
};

/**
 * Reads all connections for a canvas and returns them as a record keyed by connection id.
 */
export const readConnections = (db, canvasId) => {
  const rows = db.prepare(`
    SELECT
      id, start_card_id, end_card_id,
      start_x, start_y, end_x, end_y
    FROM connection
    WHERE canvas_id = ?
  `).all(canvasId);

  const connections = {};
  rows.forEach((connection) => {
    connections[connection.id] = {
      id: connection.id,
      startCardId: connection.start_card_id,
      endCardId: connection.end_card_id,
      startPoint: { x: connection.start_x, y: connection.start_y },
      endPoint: { x: connection.end_x, y: connection.end_y },
    };
  });

  return connections;
};

/**
 * Deletes all cards and connections for a canvas (used before re-insert during upsert).
 */
export const deleteCanvasContents = (db, canvasId) => {
  db.prepare('DELETE FROM card WHERE canvas_id = ?').run(canvasId);
  db.prepare('DELETE FROM connection WHERE canvas_id = ?').run(canvasId);
};
