import React, { memo, useCallback } from 'react';
import MarkdownCardOverlay from './MarkdownCardOverlay.jsx';
import useCanvasStore from '../../store/canvasStore.js';

const MIN_HEIGHT = 80;

const TextCardRenderer = memo(({
  card,
  isSelected,
}) => {
  const updateCard = useCanvasStore((s) => s.updateCard);
  const autoResize = card.autoResize !== false; // default true

  const content = !card.content || card.content.trim() === ''
    ? 'Click to edit text content'
    : card.content;

  const handleContentHeight = useCallback((measuredHeight) => {
    if (!autoResize) return;
    const clamped = Math.max(MIN_HEIGHT, Math.ceil(measuredHeight));
    if (clamped !== card.size.height) {
      updateCard(card.id, {
        size: { width: card.size.width, height: clamped },
      });
    }
  }, [autoResize, card.id, card.size.width, card.size.height, updateCard]);

  return (
    <MarkdownCardOverlay
      width={card.size.width}
      height={card.size.height}
      content={content}
      isSelected={isSelected}
      onContentHeight={handleContentHeight}
      updateTrigger={autoResize ? `${content}|${card.size.width}` : null}
    />
  );
});

TextCardRenderer.displayName = 'TextCardRenderer';

export default TextCardRenderer;
