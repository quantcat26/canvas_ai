import React, { useState } from 'react';
import MarkdownContent from './MarkdownContent.jsx';
import './AiChatCard.css';

const AiChatCard = ({ content, position, onClose, onAddToCanvas }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [cardPosition, setCardPosition] = useState(position);

  const handleDragStart = (e) => {
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleDrag = (e) => {
    if (!isDragging) return;

    setCardPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={`ai-chat-card ${isDragging ? 'dragging' : ''}`}
      style={{
        left: `${cardPosition.x}px`,
        top: `${cardPosition.y}px`,
      }}
      onMouseDown={handleDragStart}
      onMouseMove={handleDrag}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      <div className="ai-chat-header">
        <div className="ai-chat-source">{content.source}</div>
        <div className="ai-chat-actions">
          {onAddToCanvas && (
            <button
              className="add-to-canvas-btn"
              onClick={onAddToCanvas}
              title="Add to canvas"
            >
              + Canvas
            </button>
          )}
          {onClose && (
            <button
              className="close-btn"
              onClick={onClose}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="ai-chat-content">
        <MarkdownContent content={content.text} className="markdown-content--chat" />
      </div>
    </div>
  );
};

export default AiChatCard;
