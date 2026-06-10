import React, { memo, useRef, useLayoutEffect, useState } from 'react';
import { Html } from 'react-konva-utils';
import MarkdownContent from './MarkdownContent.jsx';

const CARD_PADDING = 12;
const CARD_RADIUS = 8;

const MarkdownCardOverlay = memo(({
  width = 200,
  height = 120,
  content = '',
  isSelected = false,
  onContentHeight,
}) => {
  const innerWidth = Math.max(0, width - CARD_PADDING * 2);
  const innerHeight = Math.max(0, height - CARD_PADDING * 2);
  const contentRef = useRef(null);
  const [lastContentKey, setLastContentKey] = useState('');

  const contentKey = `${content}|${width}`;

  useLayoutEffect(() => {
    if (!contentRef.current || !onContentHeight) return;
    if (contentKey === lastContentKey) return;
    setLastContentKey(contentKey);

    const el = contentRef.current;
    // Small delay to ensure DOM has fully rendered after react-markdown
    const measure = () => {
      const scrollHeight = el.scrollHeight;
      const paddingTotal = CARD_PADDING * 2;
      const bodyPadding = 8;
      const measuredHeight = scrollHeight + paddingTotal + bodyPadding;
      if (measuredHeight !== height) {
        onContentHeight(measuredHeight);
      }
    };
    // Use rAF to ensure layout is settled
    requestAnimationFrame(measure);
  });

  const divStyle = {
    pointerEvents: 'none',
    overflow: 'hidden',
    width: `${width}px`,
    height: `${height}px`,
    background: '#ffffff',
    borderRadius: `${CARD_RADIUS}px`,
    boxShadow: isSelected
      ? '0 0 0 2px #4285f4, 0 1px 3px rgba(0,0,0,0.12)'
      : '0 1px 3px rgba(0,0,0,0.12)',
    boxSizing: 'border-box',
    padding: `${CARD_PADDING}px`,
  };

  const wrapperStyle = {
    width: `${innerWidth}px`,
    height: `${innerHeight}px`,
    overflow: 'hidden',
  };

  return (
    <Html
      groupProps={{ x: 0, y: 0 }}
      divProps={{ style: divStyle }}
    >
      <div style={wrapperStyle} ref={contentRef}>
        <MarkdownContent
          content={content}
          className="markdown-content--canvas"
        />
      </div>
    </Html>
  );
});

MarkdownCardOverlay.displayName = 'MarkdownCardOverlay';

export default MarkdownCardOverlay;
