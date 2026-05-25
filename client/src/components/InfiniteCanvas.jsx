import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Text, Group, Image, Arrow } from 'react-konva';
import styles from './InfiniteCanvas.module.css';
import useCanvasStore from '../store/canvasStore.js';
import MarkdownCard from './MarkdownCard.jsx';
import ZoomControls from './ZoomControls.jsx';

const imageCache = new Map();
const RESIZE_EDGE_SENSITIVITY = 8;
const CARD_TEXT_FONT_SIZE = 14;
const CARD_TEXT_LINE_HEIGHT = 1.5;
const CARD_CONTENT_PADDING = 20;
const AUTO_RESIZE_MIN_HEIGHT = 160;
const AUTO_RESIZE_MAX_HEIGHT = 620;
const GROUP_PADDING = 20;
const COLLAPSED_CHILD_PREVIEW_RATIO = 0.3;
const COLLAPSED_GROUP_DRAG_RATIO = 0.7;

const textMeasureContext = typeof document !== 'undefined'
  ? document.createElement('canvas').getContext('2d')
  : null;

const measureTextWidth = (text) => {
  if (!textMeasureContext) return text.length * CARD_TEXT_FONT_SIZE * 0.6;
  textMeasureContext.font = `${CARD_TEXT_FONT_SIZE}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;
  return textMeasureContext.measureText(text).width;
};

const splitTextTokens = (text) => {
  return text.match(/\s+|[A-Za-z0-9]+(?:[._'\-][A-Za-z0-9]+)*|./g) || [];
};

const splitTokenByWidth = (token, maxWidth) => {
  const parts = [];
  let current = '';

  token.split('').forEach((char) => {
    const next = current + char;
    if (measureTextWidth(next) > maxWidth && current.length > 0) {
      parts.push(current);
      current = char;
      return;
    }
    current = next;
  });

  if (current.length > 0) {
    parts.push(current);
  }

  return parts;
};

const estimateTextCardHeight = (content, cardWidth) => {
  const availableWidth = Math.max(40, cardWidth - CARD_CONTENT_PADDING * 2);
  const lineHeightPx = CARD_TEXT_FONT_SIZE * CARD_TEXT_LINE_HEIGHT;
  const lines = (content || '').split('\n');
  let visualLineCount = 0;

  lines.forEach((line) => {
    if (!line) {
      visualLineCount += 1;
      return;
    }

    const tokens = splitTextTokens(line);
    let currentWidth = 0;
    let hasTokenInLine = false;

    tokens.forEach((token, tokenIndex) => {
      if (!token) return;

      const isWhitespace = /^\s+$/.test(token);
      if (isWhitespace) {
        if (!hasTokenInLine) {
          return;
        }

        const nextToken = tokens.slice(tokenIndex + 1).find((value) => !/^\s+$/.test(value));
        if (!nextToken) {
          return;
        }

        const spaceWidth = measureTextWidth(token);
        const nextTokenWidth = measureTextWidth(nextToken);
        if (currentWidth + spaceWidth + nextTokenWidth > availableWidth) {
          visualLineCount += 1;
          currentWidth = 0;
          hasTokenInLine = false;
          return;
        }

        currentWidth += spaceWidth;
        return;
      }

      let tokenParts = [token];
      if (measureTextWidth(token) > availableWidth) {
        tokenParts = splitTokenByWidth(token, availableWidth);
      }

      tokenParts.forEach((part) => {
        const partWidth = measureTextWidth(part);
        if (currentWidth + partWidth > availableWidth && hasTokenInLine) {
          visualLineCount += 1;
          currentWidth = 0;
          hasTokenInLine = false;
        }

        currentWidth += partWidth;
        hasTokenInLine = true;
      });
    });

    visualLineCount += hasTokenInLine ? 1 : 1;
  });

  const verticalPadding = CARD_CONTENT_PADDING * 2 - 8;
  const estimatedHeight = visualLineCount * lineHeightPx + verticalPadding;
  return Math.min(AUTO_RESIZE_MAX_HEIGHT, Math.max(AUTO_RESIZE_MIN_HEIGHT, Math.ceil(estimatedHeight)));
};

const InfiniteCanvas = () => {
  const stageRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isHoveringConnection, setIsHoveringConnection] = useState(false);
  const [connectionStartCardId, setConnectionStartCardId] = useState(null);
  const [connectionStartAnchor, setConnectionStartAnchor] = useState(null);
  const [tempConnectionPoints, setTempConnectionPoints] = useState(null);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [cursorCanvasPosition, setCursorCanvasPosition] = useState({ x: 0, y: 0 });
  const [isResizingCard, setIsResizingCard] = useState(false);
  const [resizeType, setResizeType] = useState(null);
  const [resizingCardId, setResizingCardId] = useState(null);
  const [cardInitialSize, setCardInitialSize] = useState({ width: 0, height: 0 });
  const [cardInitialPosition, setCardInitialPosition] = useState({ x: 0, y: 0 });
  const [editingCardId, setEditingCardId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const textareaRef = useRef(null);
  const [wasCardDragged, setWasCardDragged] = useState(false);
  const dragStartTimeRef = useRef(0);
  const dragThresholdTime = 300;
  const dragThresholdDistance = 5;
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [cardStartPos, setCardStartPos] = useState({ x: 0, y: 0 });
  const [activeEdge, setActiveEdge] = useState(null);
  const [cursorStyle, setCursorStyle] = useState('default');
  const [hoveredGroupId, setHoveredGroupId] = useState(null);
  const dragHistoryRecordedRef = useRef(false);
  const resizeHistoryRecordedRef = useRef(false);

  const {
    zoom, panX, panY,
    cards, connections,
    selectedCardIds, selectedConnectionIds,
    isConnectingMode, setPan, setZoom, updateCard, selectCards,
    clearSelection, selectConnections, updateConnection, addCard, removeCard,
    recordHistory, undo, redo,
  } = useCanvasStore();

  const rawSelectedCard = selectedCardIds.length === 1 ? cards[selectedCardIds[0]] : null;
  const selectedCard = rawSelectedCard && rawSelectedCard.groupId && cards[rawSelectedCard.groupId]?.collapsed
    ? null
    : rawSelectedCard;
  const collapsedHeight = 120;
  const cardContentPadding = 20;
  const minimapWidth = 180;
  const minimapHeight = 120;

  useEffect(() => {
    const handleResize = () => {
      setStageSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const calculateDistance = (p1, p2) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const handleMouseMove = (e) => {
    const stage = stageRef.current;
    if (!stage) return;

    const pointerPos = stage.getPointerPosition();
    if (pointerPos) {
      setMousePosition(pointerPos);

      const canvasX = (pointerPos.x - panX) / zoom;
      const canvasY = (pointerPos.y - panY) / zoom;
      setCursorCanvasPosition({ x: canvasX, y: canvasY });

      if (isConnectingMode && connectionStartCardId && tempConnectionPoints) {
        const startCard = cards[connectionStartCardId];
        const startPoint = connectionStartAnchor && startCard
          ? getPointFromAnchor(startCard, connectionStartAnchor)
          : tempConnectionPoints.start;
        setTempConnectionPoints({
          start: startPoint,
          end: { x: canvasX, y: canvasY },
        });
      }

      if (isDraggingCard && draggedCardId && e.evt.buttons === 1) {
        if (!dragHistoryRecordedRef.current) {
          recordHistory();
          dragHistoryRecordedRef.current = true;
        }
        const deltaX = (pointerPos.x - dragStartPos.x) / zoom;
        const deltaY = (pointerPos.y - dragStartPos.y) / zoom;

        const newX = cardStartPos.x + deltaX;
        const newY = cardStartPos.y + deltaY;

        updateCardPosition(draggedCardId, newX, newY);

        const draggedCard = cards[draggedCardId];
        if (draggedCard && draggedCard.type !== 'group') {
          const targetGroupId = resolveContainingGroupId({
            x: newX + draggedCard.size.width / 2,
            y: newY + draggedCard.size.height / 2,
          });
          if (targetGroupId && targetGroupId !== draggedCard.groupId) {
            setHoveredGroupId(targetGroupId);
          } else {
            setHoveredGroupId(null);
          }
        } else {
          setHoveredGroupId(null);
        }
      } else if (isDraggingCard && e.evt.buttons !== 1) {
        handleDragEnd();
      }

      if (isResizingCard && resizingCardId && resizeType) {
        if (!resizeHistoryRecordedRef.current) {
          recordHistory();
          resizeHistoryRecordedRef.current = true;
        }
        const card = cards[resizingCardId];
        if (!card) return;

        const deltaX = (pointerPos.x - dragStartPos.x) / zoom;
        const deltaY = (pointerPos.y - dragStartPos.y) / zoom;

        let newWidth = cardInitialSize.width;
        let newHeight = cardInitialSize.height;
        let newX = cardInitialPosition.x;
        let newY = cardInitialPosition.y;

        if (resizeType === 'right') {
          newWidth = Math.max(50, cardInitialSize.width + deltaX);
        } else if (resizeType === 'bottom') {
          newHeight = Math.max(50, cardInitialSize.height + deltaY);
        } else if (resizeType === 'left') {
          newWidth = Math.max(50, cardInitialSize.width - deltaX);
          if (newWidth >= 50) {
            newX = cardInitialPosition.x + deltaX;
          }
        } else if (resizeType === 'top') {
          newHeight = Math.max(50, cardInitialSize.height - deltaY);
          if (newHeight >= 50) {
            newY = cardInitialPosition.y + deltaY;
          }
        } else if (resizeType === 'corner') {
          newWidth = Math.max(50, cardInitialSize.width + deltaX);
          newHeight = Math.max(50, cardInitialSize.height + deltaY);
        }

        updateCard(
          resizingCardId,
          {
            size: { width: newWidth, height: newHeight },
            position: { x: newX, y: newY },
          },
          { skipHistory: true },
        );

        if (card.groupId) {
          syncGroupBounds(card.groupId);
        }
      }

      if (!isDraggingCard && !isResizingCard && selectedCardIds.length > 0) {
        let edgeFound = false;

        for (const cardId of selectedCardIds) {
          const card = cards[cardId];
          if (!card) continue;
          if (card.type === 'group' && (card.autoResize !== false || card.collapsed)) {
            continue;
          }

          const relativeX = canvasX - card.position.x;
          const relativeY = canvasY - card.position.y;

          if (relativeX >= 0 && relativeX <= card.size.width &&
              relativeY >= 0 && relativeY <= card.size.height) {
            let edgeType = null;

            if (relativeX >= card.size.width - RESIZE_EDGE_SENSITIVITY &&
                relativeY >= card.size.height - RESIZE_EDGE_SENSITIVITY) {
              edgeType = 'corner';
            } else if (relativeX <= RESIZE_EDGE_SENSITIVITY) {
              edgeType = 'left';
            } else if (relativeX >= card.size.width - RESIZE_EDGE_SENSITIVITY) {
              edgeType = 'right';
            } else if (relativeY <= RESIZE_EDGE_SENSITIVITY) {
              edgeType = 'top';
            } else if (relativeY >= card.size.height - RESIZE_EDGE_SENSITIVITY) {
              edgeType = 'bottom';
            }

            if (edgeType) {
              setActiveEdge({ cardId, edgeType });

              switch (edgeType) {
                case 'left':
                case 'right':
                  setCursorStyle('ew-resize');
                  break;
                case 'top':
                case 'bottom':
                  setCursorStyle('ns-resize');
                  break;
                case 'corner':
                  setCursorStyle('nwse-resize');
                  break;
                default:
                  break;
              }

              edgeFound = true;
              break;
            }
          }
        }

        if (!edgeFound) {
          setActiveEdge(null);
          setCursorStyle('default');
        }
      }
    }
  };

  const updateCardPosition = (cardId, x, y) => {
    const card = cards[cardId];
    if (!card) return;

    const deltaX = x - card.position.x;
    const deltaY = y - card.position.y;
    const affectedGroupIds = new Set();
    const isGroupCard = card.type === 'group';
    const movedCardIds = new Set([cardId]);

    if (selectedCardIds.length > 1 && selectedCardIds.includes(cardId) && !isGroupCard) {
      selectedCardIds.forEach((selectedId) => {
        const selected = cards[selectedId];
        if (selected) {
          updateCard(
            selectedId,
            {
              position: {
                x: selected.position.x + deltaX,
                y: selected.position.y + deltaY,
              },
            },
            { skipHistory: true },
          );
          movedCardIds.add(selectedId);
          if (selected.groupId) {
            affectedGroupIds.add(selected.groupId);
          }
        }
      });
    } else {
      updateCard(
        cardId,
        {
          position: { x, y },
        },
        { skipHistory: true },
      );
      if (card.groupId) {
        affectedGroupIds.add(card.groupId);
      }
    }

    if (isGroupCard && Array.isArray(card.childIds)) {
      card.childIds.forEach((childId) => {
        const child = cards[childId];
        if (!child) return;
        updateCard(
          childId,
          {
            position: {
              x: child.position.x + deltaX,
              y: child.position.y + deltaY,
            },
          },
          { skipHistory: true },
        );
        movedCardIds.add(childId);
        if (child.groupId) {
          affectedGroupIds.add(child.groupId);
        }
      });
      affectedGroupIds.add(cardId);
    }

    affectedGroupIds.forEach((groupId) => syncGroupBounds(groupId));

    Object.values(connections).forEach((connection) => {
      if (movedCardIds.has(connection.startCardId) || movedCardIds.has(connection.endCardId)) {
        const startCard = cards[connection.startCardId];
        const endCard = cards[connection.endCardId];

        if (startCard && endCard) {
          const { startPoint, endPoint } = calculateConnectionPoints(
            startCard,
            endCard,
            connection.startAnchor,
            connection.endAnchor,
          );
          updateConnection(
            connection.id,
            {
              startPoint,
              endPoint,
            },
            { skipHistory: true },
          );
        }
      }
    });
  };

  const handleWheel = (e) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = zoom;
    const pointer = stage.getPointerPosition();

    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - panX) / oldScale,
      y: (pointer.y - panY) / oldScale,
    };

    let newScale = e.evt.deltaY < 0 ? oldScale * 1.1 : oldScale / 1.1;
    newScale = Math.max(0.1, Math.min(newScale, 5));

    setZoom(newScale);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setPan(newPos.x, newPos.y);
  };

  const handleDragStart = (e) => {
    if (isDraggingCard || e.target !== e.currentTarget) {
      return false;
    }

    return undefined;
  };

  const handleDragMove = (e) => {
    if (!isDraggingCard && e.target === e.currentTarget) {
      setPan(e.target.x(), e.target.y());
    }
  };

  const handleCardMouseDown = (cardId, e) => {
    if (e.evt.button !== 0) return;

    e.evt.stopPropagation();

    const stage = stageRef.current;
    if (!stage) return;

    if (activeEdge && activeEdge.cardId === cardId) {
      handleResizeStart(cardId, activeEdge.edgeType, e);
      return;
    }

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    const card = cards[cardId];
    if (!card) return;

    if (card.type === 'group' && card.collapsed) {
      const canvasX = (pointerPos.x - panX) / zoom;
      const canvasY = (pointerPos.y - panY) / zoom;
      const relativeY = canvasY - card.position.y;
      selectCards([cardId]);

      if (relativeY > card.size.height * COLLAPSED_GROUP_DRAG_RATIO) {
        const restored = card.expandedSize || card.size;
        updateCard(card.id, { collapsed: false, size: restored });
        if (card.autoResize !== false) {
          syncGroupBounds(card.id);
        }
        return;
      }
    }

    dragStartTimeRef.current = Date.now();

    setIsDraggingCard(true);
    setDraggedCardId(cardId);
    setDragStartPos({ x: pointerPos.x, y: pointerPos.y });
    setCardStartPos({ x: card.position.x, y: card.position.y });

    const isCardAlreadySelected = selectedCardIds.includes(cardId);

    if (e.evt.shiftKey) {
      if (!isCardAlreadySelected) {
        selectCards([...selectedCardIds, cardId]);
        if (selectedConnectionIds.length > 0) {
          selectConnections([]);
        }
      }
    } else if (!isCardAlreadySelected) {
      selectCards([cardId]);
      if (selectedConnectionIds.length > 0) {
        selectConnections([]);
      }
    } else if (selectedConnectionIds.length > 0) {
      selectConnections([]);
    }
  };

  const handleResizeStart = (cardId, type, e) => {
    e.evt.stopPropagation();
    const card = cards[cardId];
    if (!card) return;
    if (card.type === 'group' && (card.autoResize !== false || card.collapsed)) return;

    const stage = stageRef.current;
    if (!stage) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    setIsResizingCard(true);
    setResizeType(type);
    setResizingCardId(cardId);
    setDragStartPos({ x: pointerPos.x, y: pointerPos.y });
    setCardInitialSize({ width: card.size.width, height: card.size.height });
    setCardInitialPosition({ x: card.position.x, y: card.position.y });
  };

  const isPointInsideRect = (point, rect) => {
    return (
      point.x >= rect.position.x &&
      point.x <= rect.position.x + rect.size.width &&
      point.y >= rect.position.y &&
      point.y <= rect.position.y + rect.size.height
    );
  };

  const isCardFullyInsideRect = (card, rect) => {
    return (
      card.position.x >= rect.position.x &&
      card.position.y >= rect.position.y &&
      card.position.x + card.size.width <= rect.position.x + rect.size.width &&
      card.position.y + card.size.height <= rect.position.y + rect.size.height
    );
  };

  const getRectIntersection = (rectA, rectB) => {
    const left = Math.max(rectA.position.x, rectB.position.x);
    const top = Math.max(rectA.position.y, rectB.position.y);
    const right = Math.min(rectA.position.x + rectA.size.width, rectB.position.x + rectB.size.width);
    const bottom = Math.min(rectA.position.y + rectA.size.height, rectB.position.y + rectB.size.height);

    if (right <= left || bottom <= top) {
      return null;
    }

    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    };
  };

  const getCollapsedChildClip = (card, group) => {
    if (!group) return null;
    const groupRect = {
      position: { x: group.position.x, y: group.position.y },
      size: { width: group.size.width, height: group.size.height },
    };
    if (isCardFullyInsideRect(card, groupRect)) {
      return { clip: null, fullyVisible: true };
    }
    const previewHeight = card.size.height * COLLAPSED_CHILD_PREVIEW_RATIO;
    const childPreviewRect = {
      position: { x: card.position.x, y: card.position.y },
      size: { width: card.size.width, height: previewHeight },
    };

    return { clip: getRectIntersection(groupRect, childPreviewRect), fullyVisible: false };
  };

  const resolveContainingGroupId = (point) => {
    const groupCards = Object.values(cards).filter((card) => card.type === 'group');
    if (groupCards.length === 0) return null;

    const sortedGroups = [...groupCards].sort((a, b) => {
      const areaA = a.size.width * a.size.height;
      const areaB = b.size.width * b.size.height;
      return areaA - areaB;
    });

    const match = sortedGroups.find((group) => isPointInsideRect(point, group));
    return match ? match.id : null;
  };

  const updateGroupMembership = (cardIds) => {
    if (cardIds.length === 0) return;

    cardIds.forEach((cardId) => {
      const card = cards[cardId];
      if (!card || card.type === 'group') return;

      const center = {
        x: card.position.x + card.size.width / 2,
        y: card.position.y + card.size.height / 2,
      };
      const nextGroupId = resolveContainingGroupId(center);

      if (nextGroupId === card.groupId) return;

      if (card.groupId && cards[card.groupId]?.type === 'group') {
        const oldGroup = cards[card.groupId];
        const nextChildIds = Array.isArray(oldGroup.childIds)
          ? oldGroup.childIds.filter((id) => id !== cardId)
          : [];
        updateCard(oldGroup.id, { childIds: nextChildIds }, { skipHistory: true });
        syncGroupBounds(oldGroup.id);
      }

      if (nextGroupId) {
        const newGroup = cards[nextGroupId];
        const childIds = Array.isArray(newGroup.childIds) ? newGroup.childIds : [];
        if (!childIds.includes(cardId)) {
          updateCard(nextGroupId, { childIds: [...childIds, cardId] }, { skipHistory: true });
        }
        updateCard(cardId, { groupId: nextGroupId }, { skipHistory: true });
        syncGroupBounds(nextGroupId);
      } else {
        updateCard(cardId, { groupId: null }, { skipHistory: true });
      }
    });
  };

  const handleDragEnd = () => {
    let shouldUpdateGroups = false;
    let movedCardIds = [];

    if (isDraggingCard && draggedCardId) {
      const dragDuration = Date.now() - dragStartTimeRef.current;

      const stage = stageRef.current;
      if (stage) {
        const currentPosition = stage.getPointerPosition();
        if (currentPosition) {
          const dragDistance = calculateDistance(dragStartPos, currentPosition);
          if (dragDuration > dragThresholdTime || dragDistance > dragThresholdDistance) {
            setWasCardDragged(true);
            shouldUpdateGroups = true;
          }
        }
      }

      setTimeout(() => {
        setWasCardDragged(false);
      }, 100);

      if (shouldUpdateGroups) {
        const draggedCard = cards[draggedCardId];
        if (draggedCard && draggedCard.type !== 'group') {
          movedCardIds = selectedCardIds.includes(draggedCardId) && selectedCardIds.length > 1
            ? selectedCardIds
            : [draggedCardId];
          movedCardIds = movedCardIds.filter((id) => cards[id] && cards[id].type !== 'group');
        }
      }
    }

    if (shouldUpdateGroups && movedCardIds.length > 0) {
      updateGroupMembership(movedCardIds);
    }

    setHoveredGroupId(null);
    setIsDraggingCard(false);
    setDraggedCardId(null);
    setIsResizingCard(false);
    setResizingCardId(null);
    setResizeType(null);
    dragHistoryRecordedRef.current = false;
    resizeHistoryRecordedRef.current = false;
  };

  const handleCardClick = (cardId, e) => {
    e.evt.stopPropagation();

    const card = cards[cardId];
    if (!card) return;

    if (isConnectingMode) {
      const pointerPos = stage?.getPointerPosition();
      const canvasPointer = pointerPos
        ? { x: (pointerPos.x - panX) / zoom, y: (pointerPos.y - panY) / zoom }
        : null;

      if (!connectionStartCardId) {
        const targetPoint = canvasPointer || getCardCenter(card);
        const startEdgePoint = getEdgeIntersection(card, targetPoint);
        const startAnchor = getAnchorFromPoint(card, startEdgePoint);
        const startPoint = getPointFromAnchor(card, startAnchor);

        setConnectionStartCardId(cardId);
        setConnectionStartAnchor(startAnchor);
        setTempConnectionPoints({
          start: startPoint,
          end: startPoint,
        });
      } else if (cardId === connectionStartCardId) {
        setConnectionStartCardId(null);
        setConnectionStartAnchor(null);
        setTempConnectionPoints(null);
      } else if (cardId !== connectionStartCardId) {
        const startCard = cards[connectionStartCardId];
        const endCard = card;
        const { addConnection } = useCanvasStore.getState();

        if (startCard && endCard) {
          const targetPoint = canvasPointer || getCardCenter(endCard);
          const endEdgePoint = getEdgeIntersection(endCard, targetPoint);
          const endAnchor = getAnchorFromPoint(endCard, endEdgePoint);
          const startAnchor = connectionStartAnchor
            || getAnchorFromPoint(startCard, getEdgeIntersection(startCard, getCardCenter(endCard)));

          const { startPoint, endPoint } = calculateConnectionPoints(
            startCard,
            endCard,
            startAnchor,
            endAnchor,
          );

          addConnection({
            startCardId: connectionStartCardId,
            endCardId: cardId,
            startPoint,
            endPoint,
            startAnchor,
            endAnchor,
          });
        }

        setConnectionStartCardId(null);
        setConnectionStartAnchor(null);
        setTempConnectionPoints(null);
      }
      return;
    }

    const clickDuration = Date.now() - dragStartTimeRef.current;

    const stage = stageRef.current;
    let dragDistance = 0;

    if (stage) {
      const currentPosition = stage.getPointerPosition();
      if (currentPosition) {
        dragDistance = calculateDistance(dragStartPos, currentPosition);
      }
    }

    if (wasCardDragged || clickDuration > dragThresholdTime || dragDistance > dragThresholdDistance) {
      return;
    }

    if (card.type === 'text') {
      const isShiftPressed = 'shiftKey' in e.evt && Boolean(e.evt.shiftKey);
      if (!isShiftPressed) {
        selectCards([cardId]);
      }
    }
  };

  const handleCardDoubleClick = (cardId, e) => {
    e.evt.stopPropagation();

    const card = cards[cardId];
    if (!card || card.type !== 'text') return;

    selectCards([cardId]);
    setEditingCardId(cardId);
    if (card.content === 'Click to edit text content') {
      setEditingText('');
    } else {
      setEditingText(card.content || '');
    }
  };

  const handleStageClick = (e) => {
    if (e.target === e.target.getStage() || e.target.name() === 'background-rect') {
      clearSelection();
    }
  };

  const handleConnectionClick = (connectionId, e) => {
    e.evt.stopPropagation();
    const isShiftPressed = 'shiftKey' in e.evt && Boolean(e.evt.shiftKey);

    if (isShiftPressed) {
      const newSelection = [...selectedConnectionIds];
      const index = newSelection.indexOf(connectionId);
      if (index === -1) {
        newSelection.push(connectionId);
      } else {
        newSelection.splice(index, 1);
      }
      selectConnections(newSelection);
    } else {
      selectConnections([connectionId]);
      selectCards([]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (editingCardId) return;

      const isModifierPressed = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const isUndoShortcut = isModifierPressed && key === 'z' && !e.shiftKey;
      const isRedoShortcut = isModifierPressed && (key === 'y' || (key === 'z' && e.shiftKey));
      const target = e.target;
      const isTypingTarget = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((isUndoShortcut || isRedoShortcut) && isTypingTarget) {
        return;
      }

      if (isUndoShortcut) {
        e.preventDefault();
        undo();
        return;
      }

      if (isRedoShortcut) {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') &&
          (selectedCardIds.length > 0 || selectedConnectionIds.length > 0)) {
        const { recordHistory } = useCanvasStore.getState();
        recordHistory();

        selectedCardIds.forEach((id) => {
          const { removeCard } = useCanvasStore.getState();
          removeCard(id, { skipHistory: true });
        });

        selectedConnectionIds.forEach((id) => {
          const { removeConnection } = useCanvasStore.getState();
          removeConnection(id, { skipHistory: true });
        });

        clearSelection();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedCardIds, selectedConnectionIds, editingCardId, clearSelection, undo, redo]);

  const loadImage = (src) => {
    if (imageCache.has(src)) {
      return imageCache.get(src);
    }

    const img = new window.Image();
    img.src = src;
    imageCache.set(src, img);
    return img;
  };

  const getFileIcon = (fileType) => {
    if (!fileType) return '📄';

    if (fileType.startsWith('application/pdf')) {
      return '📕';
    } else if (fileType.startsWith('video/')) {
      return '🎬';
    } else if (fileType.startsWith('text/')) {
      return '📄';
    } else if (fileType.startsWith('application/msword') ||
               fileType.includes('wordprocessingml')) {
      return '📘';
    } else if (fileType.includes('spreadsheet') ||
               fileType.includes('excel')) {
      return '📊';
    } else if (fileType.includes('presentation') ||
               fileType.includes('powerpoint')) {
      return '📑';
    }

    return '📄';
  };

  const getFileTypeName = (fileType) => {
    if (!fileType) return 'Unknown file';

    if (fileType.startsWith('application/pdf')) {
      return 'PDF file';
    } else if (fileType.startsWith('video/')) {
      return 'Video file';
    } else if (fileType.startsWith('text/')) {
      return 'Text file';
    } else if (fileType.startsWith('application/msword') ||
               fileType.includes('wordprocessingml')) {
      return 'Word file';
    } else if (fileType.includes('spreadsheet') ||
               fileType.includes('excel')) {
      return 'Excel file';
    } else if (fileType.includes('presentation') ||
               fileType.includes('powerpoint')) {
      return 'PowerPoint file';
    }

    const parts = fileType.split('/');
    return parts.length > 1 ? `${parts[1].toUpperCase()} file` : 'File';
  };

  const renderCardPreview = (card) => {
    if (card.type === 'link') {
      return (
        <iframe
          className={styles.previewFrame}
          src={card.url}
          title={card.url || 'Link preview'}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      );
    }

    if (card.type === 'youtube') {
      const embedUrl = card.videoId
        ? `https://www.youtube.com/embed/${card.videoId}?rel=0`
        : '';
      return (
        <iframe
          className={styles.previewFrame}
          src={embedUrl}
          title="YouTube preview"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }

    if (card.previewType === 'pdf') {
      return (
        <iframe
          className={styles.previewFrame}
          src={card.content}
          title={card.fileName || 'PDF preview'}
        />
      );
    }

    if (card.previewType === 'video') {
      return (
        <video
          className={styles.previewFrame}
          src={card.content}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
        />
      );
    }

    if (card.previewType === 'text') {
      const previewText = (card.content || '').slice(0, 4000);
      return (
        <pre className={styles.previewText}>
          {previewText || 'Text preview is empty.'}
        </pre>
      );
    }

    return null;
  };

  const getCardCenter = (card) => ({
    x: card.position.x + card.size.width / 2,
    y: card.position.y + card.size.height / 2,
  });

  const getEdgeIntersection = (card, targetPoint) => {
    const center = getCardCenter(card);
    const dx = targetPoint.x - center.x;
    const dy = targetPoint.y - center.y;

    if (dx === 0 && dy === 0) {
      return center;
    }

    const halfWidth = card.size.width / 2;
    const halfHeight = card.size.height / 2;
    const scaleX = Math.abs(dx) > 0 ? halfWidth / Math.abs(dx) : Infinity;
    const scaleY = Math.abs(dy) > 0 ? halfHeight / Math.abs(dy) : Infinity;
    const scale = Math.min(scaleX, scaleY);

    return {
      x: center.x + dx * scale,
      y: center.y + dy * scale,
    };
  };

  const getAnchorFromPoint = (card, point) => {
    const left = card.position.x;
    const right = card.position.x + card.size.width;
    const top = card.position.y;
    const bottom = card.position.y + card.size.height;

    const distances = [
      { edge: 'left', value: Math.abs(point.x - left) },
      { edge: 'right', value: Math.abs(point.x - right) },
      { edge: 'top', value: Math.abs(point.y - top) },
      { edge: 'bottom', value: Math.abs(point.y - bottom) },
    ];

    distances.sort((a, b) => a.value - b.value);
    const edge = distances[0].edge;

    if (edge === 'left' || edge === 'right') {
      const ratio = (point.y - top) / card.size.height;
      return { edge, ratio: Math.min(1, Math.max(0, ratio)) };
    }

    const ratio = (point.x - left) / card.size.width;
    return { edge, ratio: Math.min(1, Math.max(0, ratio)) };
  };

  const getPointFromAnchor = (card, anchor) => {
    const left = card.position.x;
    const right = card.position.x + card.size.width;
    const top = card.position.y;
    const bottom = card.position.y + card.size.height;

    switch (anchor.edge) {
      case 'left':
        return { x: left, y: top + anchor.ratio * card.size.height };
      case 'right':
        return { x: right, y: top + anchor.ratio * card.size.height };
      case 'top':
        return { x: left + anchor.ratio * card.size.width, y: top };
      case 'bottom':
      default:
        return { x: left + anchor.ratio * card.size.width, y: bottom };
    }
  };

  const calculateConnectionPoints = (startCard, endCard, startAnchor, endAnchor) => {
    const startTarget = endAnchor ? getPointFromAnchor(endCard, endAnchor) : getCardCenter(endCard);
    const endTarget = startAnchor ? getPointFromAnchor(startCard, startAnchor) : getCardCenter(startCard);

    const startPoint = startAnchor
      ? getPointFromAnchor(startCard, startAnchor)
      : getEdgeIntersection(startCard, startTarget);
    const endPoint = endAnchor
      ? getPointFromAnchor(endCard, endAnchor)
      : getEdgeIntersection(endCard, endTarget);

    return { startPoint, endPoint };
  };

  const getGroupBounds = (groupId) => {
    const { cards: currentCards } = useCanvasStore.getState();
    const group = currentCards[groupId];
    if (!group || group.type !== 'group' || !Array.isArray(group.childIds) || group.childIds.length === 0) {
      return null;
    }

    const childCards = group.childIds.map((id) => currentCards[id]).filter(Boolean);
    if (childCards.length === 0) return null;

    const minX = Math.min(...childCards.map((card) => card.position.x));
    const minY = Math.min(...childCards.map((card) => card.position.y));
    const maxX = Math.max(...childCards.map((card) => card.position.x + card.size.width));
    const maxY = Math.max(...childCards.map((card) => card.position.y + card.size.height));

    return {
      position: { x: minX - GROUP_PADDING, y: minY - GROUP_PADDING },
      size: {
        width: maxX - minX + GROUP_PADDING * 2,
        height: maxY - minY + GROUP_PADDING * 2,
      },
    };
  };

  const syncGroupBounds = (groupId) => {
    const { cards: currentCards, updateCard: updateGroupCard } = useCanvasStore.getState();
    const group = currentCards[groupId];
    if (!group || group.type !== 'group' || group.autoResize === false || group.collapsed) {
      return;
    }
    const bounds = getGroupBounds(groupId);
    if (!bounds) return;
    updateGroupCard(groupId, bounds, { skipHistory: true });
  };

  const handleTextEditingComplete = () => {
    if (editingCardId) {
      updateCard(editingCardId, {
        content: editingText,
      });
      setEditingCardId(null);
      setEditingText('');
    }
  };

  const handleTextEditingCancel = () => {
    setEditingCardId(null);
    setEditingText('');
  };

  const handleEditingTextChange = (e) => {
    setEditingText(e.target.value);
  };

  const minimapData = useMemo(() => {
    const cardList = Object.values(cards);
    const viewport = {
      x: -panX / zoom,
      y: -panY / zoom,
      width: stageSize.width / zoom,
      height: stageSize.height / zoom,
    };

    let minX = viewport.x;
    let minY = viewport.y;
    let maxX = viewport.x + viewport.width;
    let maxY = viewport.y + viewport.height;

    if (cardList.length > 0) {
      cardList.forEach((card) => {
        minX = Math.min(minX, card.position.x);
        minY = Math.min(minY, card.position.y);
        maxX = Math.max(maxX, card.position.x + card.size.width);
        maxY = Math.max(maxY, card.position.y + card.size.height);
      });
    }

    const padding = 120;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const boundsWidth = Math.max(1, maxX - minX);
    const boundsHeight = Math.max(1, maxY - minY);
    const scale = Math.min(minimapWidth / boundsWidth, minimapHeight / boundsHeight);

    const mappedCards = cardList.map((card) => ({
      id: card.id,
      x: (card.position.x - minX) * scale,
      y: (card.position.y - minY) * scale,
      width: Math.max(2, card.size.width * scale),
      height: Math.max(2, card.size.height * scale),
      selected: selectedCardIds.includes(card.id),
    }));

    const viewportRect = {
      x: (viewport.x - minX) * scale,
      y: (viewport.y - minY) * scale,
      width: Math.max(2, viewport.width * scale),
      height: Math.max(2, viewport.height * scale),
    };

    return {
      cards: mappedCards,
      viewport: viewportRect,
    };
  }, [cards, panX, panY, zoom, stageSize, minimapWidth, minimapHeight, selectedCardIds]);

  useEffect(() => {
    if (!editingCardId) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleTextEditingCancel();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleTextEditingComplete();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    if (textareaRef.current) {
      textareaRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingCardId]);

  const CoordinatesPanel = () => {
    return (
      <div className={styles.coordinatesPanel}>
        <div className={styles.coordinateGroup}>
          <span className={styles.coordinateLabel}>Canvas:</span>
          <span className={styles.coordinateValue}>Zoom: {zoom.toFixed(2)}x</span>
          <span className={styles.coordinateValue}>Pan: ({panX.toFixed(0)}, {panY.toFixed(0)})</span>
        </div>

        <div className={styles.coordinateGroup}>
          <span className={styles.coordinateLabel}>Mouse:</span>
          <span className={styles.coordinateValue}>Raw: ({mousePosition.x.toFixed(0)}, {mousePosition.y.toFixed(0)})</span>
          <span className={styles.coordinateValue}>Canvas: ({cursorCanvasPosition.x.toFixed(0)}, {cursorCanvasPosition.y.toFixed(0)})</span>
        </div>

        {selectedCard && (
          <div className={`${styles.coordinateGroup} ${styles.selectedCardCoordinates}`}>
            <span className={styles.coordinateLabel}>Selected card ({selectedCard.id}):</span>
            <span className={styles.coordinateValue}>Position: ({selectedCard.position.x.toFixed(0)}, {selectedCard.position.y.toFixed(0)})</span>
            <span className={styles.coordinateValue}>Size: {selectedCard.size.width}x{selectedCard.size.height}</span>
            {selectedCard.angle !== undefined && (
              <span className={styles.coordinateValue}>Rotation: {selectedCard.angle.toFixed(1)}°</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleToggleCollapse = () => {
    if (!selectedCard) return;

    if (selectedCard.type === 'group') {
      if (!selectedCard.collapsed) {
        updateCard(selectedCard.id, {
          collapsed: true,
          expandedSize: selectedCard.size,
          size: { width: selectedCard.size.width, height: collapsedHeight },
        });
        return;
      }

      const restored = selectedCard.expandedSize || selectedCard.size;
      updateCard(selectedCard.id, {
        collapsed: false,
        size: restored,
      });

      if (selectedCard.autoResize !== false) {
        syncGroupBounds(selectedCard.id);
      }
      return;
    }

    if (!selectedCard.collapsed) {
      updateCard(selectedCard.id, {
        collapsed: true,
        expandedSize: selectedCard.size,
        size: { width: selectedCard.size.width, height: collapsedHeight },
      });
      return;
    }

    const restored = selectedCard.expandedSize || selectedCard.size;
    updateCard(selectedCard.id, {
      collapsed: false,
      size: restored,
    });
  };

  const handleCollapsedGroupExpand = (cardId, e) => {
    e.evt.stopPropagation();
    const card = cards[cardId];
    if (!card || card.type !== 'group' || !card.collapsed) return;

    selectCards([cardId]);
    const restored = card.expandedSize || card.size;
    updateCard(cardId, {
      collapsed: false,
      size: restored,
    });

    if (card.autoResize !== false) {
      syncGroupBounds(cardId);
    }
  };

  const handleResize = () => {
    if (!selectedCard) return;

    if (selectedCard.type === 'group') {
      const nextAutoResize = selectedCard.autoResize === false;
      updateCard(selectedCard.id, { autoResize: nextAutoResize });
      if (nextAutoResize) {
        syncGroupBounds(selectedCard.id);
      }
      return;
    }

    if (selectedCard.type !== 'text') return;
    const nextHeight = estimateTextCardHeight(selectedCard.content || '', selectedCard.size.width);

    updateCard(selectedCard.id, {
      collapsed: false,
      size: { width: selectedCard.size.width, height: nextHeight },
    });
  };

  const handleCopyCard = async () => {
    if (!selectedCard) return;
    try {
      await navigator.clipboard.writeText(selectedCard.content || '');
    } catch (error) {
      console.error('Failed to copy card content:', error);
    }
  };

  const handleDuplicateCard = () => {
    if (!selectedCard) return;
    if (selectedCard.type === 'group') {
      const offset = 30;
      const group = selectedCard;
      const { id: _id, childIds: _childIds, ...groupRest } = group;
      const originalChildIds = Array.isArray(group.childIds) ? group.childIds : [];

      recordHistory();

      const newGroupId = addCard(
        {
          ...groupRest,
          position: {
            x: group.position.x + offset,
            y: group.position.y + offset,
          },
          childIds: [],
        },
        { skipHistory: true },
      );

      const newChildIds = [];
      originalChildIds.forEach((childId) => {
        const child = cards[childId];
        if (!child) return;
        const { id: _childId, ...childRest } = child;
        const newChildId = addCard(
          {
            ...childRest,
            position: {
              x: child.position.x + offset,
              y: child.position.y + offset,
            },
            groupId: newGroupId,
          },
          { skipHistory: true },
        );
        newChildIds.push(newChildId);
      });

      updateCard(newGroupId, { childIds: newChildIds }, { skipHistory: true });
      if (group.autoResize !== false && !group.collapsed) {
        syncGroupBounds(newGroupId);
      }
      selectCards([newGroupId]);
      return;
    }

    const { id, expandedSize, collapsed, ...rest } = selectedCard;
    addCard({
      ...rest,
      position: {
        x: selectedCard.position.x + 30,
        y: selectedCard.position.y + 30,
      },
    });
  };

  const handleRenameGroup = () => {
    if (!selectedCard || selectedCard.type !== 'group') return;
    const nextName = window.prompt('Enter group name', selectedCard.title || 'Group');
    if (nextName === null) return;
    const trimmed = nextName.trim();
    updateCard(selectedCard.id, { title: trimmed || 'Group' });
  };

  const handleUngroupCard = () => {
    if (!selectedCard || !selectedCard.groupId) return;
    const group = cards[selectedCard.groupId];
    recordHistory();

    updateCard(selectedCard.id, { groupId: null }, { skipHistory: true });

    if (group?.type === 'group' && Array.isArray(group.childIds)) {
      const nextChildIds = group.childIds.filter((id) => id !== selectedCard.id);
      updateCard(group.id, { childIds: nextChildIds }, { skipHistory: true });
      if (nextChildIds.length > 0) {
        syncGroupBounds(group.id);
      }
    }
  };

  const handleDeleteCard = () => {
    if (!selectedCard) return;
    if (selectedCard.type === 'group') {
      const childIds = Array.isArray(selectedCard.childIds) ? selectedCard.childIds : [];
      recordHistory();
      childIds.forEach((childId) => {
        removeCard(childId, { skipHistory: true });
      });
      removeCard(selectedCard.id, { skipHistory: true });
      clearSelection();
      return;
    }
    removeCard(selectedCard.id);
    clearSelection();
  };

  const previewCards = useMemo(() => {
    return Object.values(cards).filter((card) => {
      if (card.type === 'link') return true;
      if (card.type === 'youtube') return true;
      return card.type === 'file' && ['pdf', 'video', 'text'].includes(card.previewType);
    });
  }, [cards]);

  const orderedCards = useMemo(() => {
    const list = Object.values(cards);
    return list.sort((a, b) => {
      if (a.type === 'group' && b.type !== 'group') return -1;
      if (a.type !== 'group' && b.type === 'group') return 1;
      return 0;
    });
  }, [cards]);

  const getPreviewStyle = (card) => ({
    left: `${card.position.x * zoom + panX}px`,
    top: `${card.position.y * zoom + panY}px`,
    width: `${card.size.width * zoom}px`,
    height: `${card.size.height * zoom}px`,
  });

  return (
    <div className={styles.canvasContainer} style={{ cursor: cursorStyle }}>
      {isConnectingMode && (
        <div className={styles.connectingModeIndicator}>
          {connectionStartCardId
            ? 'Select a target card to complete the connection'
            : 'Click a starting card to begin the connection'}
        </div>
      )}

      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        draggable={!isDraggingCard && !isResizingCard && !isHoveringConnection}
        onWheel={handleWheel}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onClick={handleStageClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleDragEnd}
        x={panX}
        y={panY}
        scaleX={zoom}
        scaleY={zoom}
      >
        <Layer>
          <Rect
            x={-10000}
            y={-10000}
            width={20000}
            height={20000}
            fill="transparent"
            perfectDrawEnabled={false}
            name="background-rect"
          />

          {isConnectingMode && tempConnectionPoints && (
            <Arrow
              points={[
                tempConnectionPoints.start.x, tempConnectionPoints.start.y,
                tempConnectionPoints.end.x, tempConnectionPoints.end.y,
              ]}
              stroke="#4285f4"
              strokeWidth={2}
              fill="#4285f4"
              dash={[5, 5]}
              tension={0.5}
              pointerWidth={8}
              pointerLength={8}
              perfectDrawEnabled={false}
            />
          )}

          {Object.values(connections).map((connection) => (
            <Arrow
              key={connection.id}
              points={[
                connection.startPoint.x, connection.startPoint.y,
                connection.endPoint.x, connection.endPoint.y,
              ]}
              stroke={selectedConnectionIds.includes(connection.id) ? '#4285f4' : '#666'}
              strokeWidth={selectedConnectionIds.includes(connection.id) ? 3 : 2}
              fill={selectedConnectionIds.includes(connection.id) ? '#4285f4' : '#666'}
              tension={0.5}
              onClick={(e) => handleConnectionClick(connection.id, e)}
              onTap={(e) => handleConnectionClick(connection.id, e)}
              onMouseDown={(e) => e.evt.stopPropagation()}
              onMouseEnter={() => setIsHoveringConnection(true)}
              onMouseLeave={() => setIsHoveringConnection(false)}
              pointerWidth={8}
              pointerLength={8}
              perfectDrawEnabled={false}
              hitStrokeWidth={10}
            />
          ))}

          {orderedCards.map((card) => {
            const isGroup = card.type === 'group';
            const parentGroup = !isGroup && card.groupId ? cards[card.groupId] : null;
            const isInCollapsedGroup = parentGroup?.type === 'group' && parentGroup.collapsed;
            const collapsedInfo = isInCollapsedGroup
              ? getCollapsedChildClip(card, parentGroup)
              : null;
            const collapsedClip = collapsedInfo?.clip ?? null;
            if (isInCollapsedGroup && !collapsedInfo?.fullyVisible && !collapsedClip) {
              return null;
            }
            const isGroupHighlighted = isGroup && hoveredGroupId === card.id;
            const isCardSelected = selectedCardIds.includes(card.id);
            const isCollapsedGroup = isGroup && card.collapsed;
            const collapsedGroupDragHeight = isCollapsedGroup ? card.size.height * COLLAPSED_GROUP_DRAG_RATIO : 0;
            return (
            <Group
              key={card.id}
              x={card.position.x}
              y={card.position.y}
              width={card.size.width}
              height={card.size.height}
              draggable={false}
              onMouseDown={isCollapsedGroup ? undefined : (e) => handleCardMouseDown(card.id, e)}
              onClick={isCollapsedGroup ? undefined : (e) => handleCardClick(card.id, e)}
              onDblClick={isCollapsedGroup ? undefined : (e) => handleCardDoubleClick(card.id, e)}
              onTap={isCollapsedGroup ? undefined : () => selectCards([card.id])}
              rotation={card.angle || 0}
              listening={!isInCollapsedGroup}
              clipX={collapsedClip ? collapsedClip.x - card.position.x : undefined}
              clipY={collapsedClip ? collapsedClip.y - card.position.y : undefined}
              clipWidth={collapsedClip ? collapsedClip.width : undefined}
              clipHeight={collapsedClip ? collapsedClip.height : undefined}
            >
              <Rect
                width={card.size.width}
                height={card.size.height}
                fill={isGroup
                  ? (isGroupHighlighted ? 'rgba(34, 197, 94, 0.12)' : 'rgba(47, 107, 255, 0.06)')
                  : 'white'}
                stroke={isGroupHighlighted ? '#22c55e' : isCardSelected ? '#4285f4' : '#ddd'}
                strokeWidth={isGroup ? (isGroupHighlighted ? 2.5 : 1) : isCardSelected ? 2 : 1}
                shadowColor={isGroupHighlighted ? 'rgba(34, 197, 94, 0.45)' : isGroup ? 'transparent' : 'rgba(0,0,0,0.2)'}
                shadowBlur={isGroup ? (isGroupHighlighted ? 12 : 0) : 5}
                shadowOffset={isGroup ? { x: 0, y: 0 } : { x: 0, y: 2 }}
                dash={isGroup ? [6, 4] : undefined}
                cornerRadius={5}
              />

              {isCollapsedGroup && (
                <>
                  <Rect
                    width={card.size.width}
                    height={collapsedGroupDragHeight}
                    fill="transparent"
                    listening
                    onMouseDown={(e) => handleCardMouseDown(card.id, e)}
                    onClick={(e) => handleCardClick(card.id, e)}
                    perfectDrawEnabled={false}
                  />
                  <Rect
                    y={collapsedGroupDragHeight}
                    width={card.size.width}
                    height={card.size.height - collapsedGroupDragHeight}
                    fill="transparent"
                    listening
                    onMouseDown={(e) => e.evt.stopPropagation()}
                    onClick={(e) => handleCollapsedGroupExpand(card.id, e)}
                    perfectDrawEnabled={false}
                  />
                </>
              )}

              {card.type === 'group' ? (
                <Text
                  x={12}
                  y={10}
                  width={card.size.width - 24}
                  height={20}
                  text={card.title || 'Group'}
                  fontSize={13}
                  fill={isGroupHighlighted ? '#14532d' : '#64748b'}
                  listening={false}
                />
              ) : card.type === 'text' ? (
                <MarkdownCard
                  x={cardContentPadding}
                  y={cardContentPadding}
                  width={card.size.width - cardContentPadding * 2}
                  height={card.size.height - cardContentPadding * 2}
                  content={!card.content || card.content.trim() === '' ? 'Click to edit text content' : card.content}
                />
              ) : card.type === 'image' ? (
                <Image
                  x={0}
                  y={15}
                  width={card.size.width}
                  height={card.size.height - 15}
                  image={loadImage(card.content)}
                  cornerRadius={5}
                  listening={false}
                />
              ) : card.type === 'file' ? (
                <Group>
                  <Text
                    x={0}
                    y={15}
                    width={card.size.width}
                    height={40}
                    text={getFileIcon(card.fileType)}
                    fontSize={24}
                    fill="#333"
                    align="center"
                    listening={false}
                  />
                  <Text
                    x={0}
                    y={55}
                    width={card.size.width}
                    height={30}
                    text={card.fileName || getFileTypeName(card.fileType)}
                    fontSize={16}
                    fill="#333"
                    align="center"
                    listening={false}
                  />
                  <Text
                    x={10}
                    y={85}
                    width={card.size.width - 20}
                    height={card.size.height - 95}
                    text="Click to view file"
                    fontSize={14}
                    fill="#666"
                    align="center"
                    listening={false}
                  />
                </Group>
              ) : card.type === 'link' ? (
                <Group>
                  <Text
                    x={0}
                    y={18}
                    width={card.size.width}
                    height={30}
                    text="🌐"
                    fontSize={22}
                    fill="#1f2a37"
                    align="center"
                    listening={false}
                  />
                  <Text
                    x={16}
                    y={50}
                    width={card.size.width - 32}
                    height={card.size.height - 60}
                    text={card.url || 'Link preview'}
                    fontSize={13}
                    fill="#475569"
                    align="center"
                    listening={false}
                  />
                </Group>
              ) : card.type === 'youtube' ? (
                <Group>
                  <Text
                    x={0}
                    y={18}
                    width={card.size.width}
                    height={30}
                    text="▶️"
                    fontSize={22}
                    fill="#1f2a37"
                    align="center"
                    listening={false}
                  />
                  <Text
                    x={16}
                    y={50}
                    width={card.size.width - 32}
                    height={card.size.height - 60}
                    text={card.videoId ? `YouTube: ${card.videoId}` : 'YouTube preview'}
                    fontSize={13}
                    fill="#475569"
                    align="center"
                    listening={false}
                  />
                </Group>
              ) : null}
            </Group>
          );
          })}
        </Layer>
      </Stage>

      {previewCards.map((card) => (
        <div
          key={`preview-${card.id}`}
          className={styles.cardPreviewOverlay}
          style={getPreviewStyle(card)}
        >
          {renderCardPreview(card)}
        </div>
      ))}

      {selectedCard && !editingCardId && (
        <div
          className={styles.cardOptionsBar}
          style={{
            left: selectedCard.position.x * zoom + panX + (selectedCard.size.width * zoom) / 2,
            top: selectedCard.position.y * zoom + panY - 12,
          }}
        >
          <button className={styles.cardOptionButton} onClick={handleToggleCollapse}>
            {selectedCard.collapsed ? 'Expand' : 'Collapse'}
          </button>
          <button className={styles.cardOptionButton} onClick={handleResize}>
            {selectedCard.type === 'group'
              ? (selectedCard.autoResize === false ? 'Auto Resize: Off' : 'Auto Resize: On')
              : 'Resize'}
          </button>
          {selectedCard.type !== 'group' && (
            <button className={styles.cardOptionButton} onClick={handleCopyCard}>
              Copy
            </button>
          )}
          <button className={styles.cardOptionButton} onClick={handleDuplicateCard}>
            Duplicate
          </button>
          {selectedCard.type === 'group' && (
            <button className={styles.cardOptionButton} onClick={handleRenameGroup}>
              Rename
            </button>
          )}
          {selectedCard.groupId && (
            <button className={styles.cardOptionButton} onClick={handleUngroupCard}>
              Ungroup
            </button>
          )}
          <button className={`${styles.cardOptionButton} ${styles.dangerButton}`} onClick={handleDeleteCard}>
            Delete
          </button>
        </div>
      )}

      <CoordinatesPanel />

      <ZoomControls />

      <div className={styles.minimap} aria-label="minimap">
        <svg
          className={styles.minimapSvg}
          width={minimapWidth}
          height={minimapHeight}
          viewBox={`0 0 ${minimapWidth} ${minimapHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <rect
            x="0"
            y="0"
            width={minimapWidth}
            height={minimapHeight}
            rx="10"
            fill="rgba(255, 255, 255, 0.92)"
            stroke="rgba(148, 163, 184, 0.6)"
          />
          {minimapData.cards.map((card) => (
            <rect
              key={card.id}
              x={card.x}
              y={card.y}
              width={card.width}
              height={card.height}
              rx="2"
              fill={card.selected ? 'rgba(47, 107, 255, 0.55)' : 'rgba(148, 163, 184, 0.35)'}
              stroke={card.selected ? 'rgba(47, 107, 255, 0.9)' : 'rgba(148, 163, 184, 0.6)'}
            />
          ))}
          <rect
            x={minimapData.viewport.x}
            y={minimapData.viewport.y}
            width={minimapData.viewport.width}
            height={minimapData.viewport.height}
            fill="none"
            stroke="rgba(15, 23, 42, 0.8)"
            strokeWidth="1.5"
            rx="2"
          />
        </svg>
      </div>

      {editingCardId && cards[editingCardId] && (
        <div
          className={styles.textEditingOverlay}
          style={{
            position: 'absolute',
            top: `${cards[editingCardId].position.y * zoom + panY}px`,
            left: `${cards[editingCardId].position.x * zoom + panX}px`,
            width: `${cards[editingCardId].size.width * zoom}px`,
            height: `${cards[editingCardId].size.height * zoom}px`,
          }}
        >
          <textarea
            ref={textareaRef}
            className={styles.textEditingTextarea}
            value={editingText}
            onChange={handleEditingTextChange}
            onBlur={handleTextEditingComplete}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleTextEditingComplete();
              } else if (e.key === 'Escape') {
                handleTextEditingCancel();
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              padding: `${20 * zoom}px ${20 * zoom}px`,
              fontSize: `${14 * zoom}px`,
              border: '2px solid #4285f4',
              borderRadius: '5px',
              boxSizing: 'border-box',
              resize: 'none',
              outline: 'none',
            }}
          />
          <div className={styles.textEditingTooltip}>
            Supports Markdown formatting | Press Enter to save, Esc to cancel
          </div>
        </div>
      )}
    </div>
  );
};

export default InfiniteCanvas;
