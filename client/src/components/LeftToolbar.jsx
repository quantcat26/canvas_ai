import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import './LeftToolbar.css';
import useCanvasStore from '../store/canvasStore.js';
import { getCenteredCardPosition } from '../utils/canvasPosition.js';

const LeftToolbar = () => {
  const {
    cards,
    addCard,
    updateCard,
    toggleConnectingMode,
    isConnectingMode,
    selectedCardIds,
    selectCards,
    undo,
    redo,
    canUndo,
    canRedo,
    recordHistory,
    panX,
    panY,
    zoom,
  } = useCanvasStore(useShallow((state) => ({
    cards: state.cards,
    addCard: state.addCard,
    updateCard: state.updateCard,
    toggleConnectingMode: state.toggleConnectingMode,
    isConnectingMode: state.isConnectingMode,
    selectedCardIds: state.selectedCardIds,
    selectCards: state.selectCards,
    undo: state.undo,
    redo: state.redo,
    canUndo: state.history.length > 0,
    canRedo: state.future.length > 0,
    recordHistory: state.recordHistory,
    panX: state.panX,
    panY: state.panY,
    zoom: state.zoom,
  })));
  const [activeTool, setActiveTool] = useState('select');

  const setTool = (tool) => {
    setActiveTool(tool);
    if (tool === 'connect') {
      if (!isConnectingMode) toggleConnectingMode();
      return;
    }

    if (isConnectingMode) toggleConnectingMode();
  };

  const getFilePreviewType = (file) => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('text/')) return 'text';
    return 'file';
  };

  const getFileCardSize = (previewType) => {
    switch (previewType) {
      case 'image':
        return { width: 180, height: 180 };
      case 'video':
      case 'pdf':
        return { width: 320, height: 220 };
      case 'text':
        return { width: 300, height: 220 };
      default:
        return { width: 200, height: 160 };
    }
  };

  const normalizeUrl = (value) => {
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };

  const extractYouTubeId = (value) => {
    const trimmed = value.trim();
    const match = trimmed.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/i);
    if (match) return match[1];
    if (/^[A-Za-z0-9_-]{6,}$/.test(trimmed)) return trimmed;
    return null;
  };

  const handleAddTextCard = () => {
    setTool('card');
    const defaultMarkdownContent = `# Title
  ## Subtitle

  You can use **bold** or *italic* text.

  - List item 1
  - List item 2

  [Link](https://www.example.com)

  > Quoted text

  \`\`\`
  Code block
  \`\`\`
  `;

    addCard({
      type: 'text',
      content: defaultMarkdownContent,
      position: getCenteredCardPosition({ size: { width: 300, height: 250 }, panX, panY, zoom }),
      size: {
        width: 300,
        height: 250,
      },
    });
  };

  const handleAddTextOnly = () => {
    setTool('text');
    addCard({
      type: 'text',
      content: 'Click to edit text content',
      position: getCenteredCardPosition({ size: { width: 220, height: 140 }, panX, panY, zoom }),
      size: {
        width: 220,
        height: 140,
      },
    });
  };

  const handleAddLinkCard = () => {
    setTool('link');
    const value = window.prompt('Enter a URL to preview');
    if (!value) return;

    const url = normalizeUrl(value);
    const size = { width: 360, height: 240 };

    addCard({
      type: 'link',
      url,
      position: getCenteredCardPosition({ size, panX, panY, zoom }),
      size,
    });
  };

  const handleAddGroup = () => {
    setTool('group');
    const emptySize = { width: 620, height: 460 };

    if (selectedCardIds.length === 0) {
      addCard({
        type: 'group',
        position: getCenteredCardPosition({ size: emptySize, panX, panY, zoom }),
        size: emptySize,
        childIds: [],
        autoResize: true,
        title: 'Group',
      });
      return;
    }

    const selectedCards = selectedCardIds.map((id) => cards[id]).filter(Boolean);
    if (selectedCards.length === 0) return;

    const padding = 20;
    const minX = Math.min(...selectedCards.map((card) => card.position.x));
    const minY = Math.min(...selectedCards.map((card) => card.position.y));
    const maxX = Math.max(...selectedCards.map((card) => card.position.x + card.size.width));
    const maxY = Math.max(...selectedCards.map((card) => card.position.y + card.size.height));

    const groupPosition = { x: minX - padding, y: minY - padding };
    const groupSize = {
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };

    recordHistory();
    const groupId = addCard(
      {
        type: 'group',
        position: groupPosition,
        size: groupSize,
        childIds: selectedCardIds,
        autoResize: true,
        title: 'Group',
      },
      { skipHistory: true },
    );

    selectedCardIds.forEach((cardId) => {
      updateCard(cardId, { groupId }, { skipHistory: true });
    });

    selectCards([groupId]);
  };

  const handleAddYouTubeCard = () => {
    setTool('youtube');
    const value = window.prompt('Enter a YouTube URL or video ID');
    if (!value) return;

    const videoId = extractYouTubeId(value);
    if (!videoId) {
      window.alert('Invalid YouTube URL or video ID.');
      return;
    }

    const size = { width: 360, height: 220 };

    addCard({
      type: 'youtube',
      videoId,
      position: getCenteredCardPosition({ size, panX, panY, zoom }),
      size,
    });
  };

  const handleAddFileCard = () => {
    setTool('upload');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,application/pdf,video/*,text/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    fileInput.style.display = 'none';

    fileInput.onchange = (event) => {
      const target = event.target;
      const file = target && target.files ? target.files[0] : null;
      if (!file) return;

      const reader = new FileReader();
      const previewType = getFilePreviewType(file);
      const size = getFileCardSize(previewType);

      reader.onload = (loadEvent) => {
        const content = loadEvent.target?.result;
        const position = {
          ...getCenteredCardPosition({ size, panX, panY, zoom }),
        };

        if (previewType === 'image') {
          addCard({
            type: 'image',
            content: typeof content === 'string' ? content : '',
            position,
            size,
            fileType: file.type,
            fileName: file.name,
          });
          return;
        }

        addCard({
          type: 'file',
          content: typeof content === 'string' ? content : '',
          position,
          size,
          fileType: file.type,
          fileName: file.name,
          previewType,
        });
      };

      if (previewType === 'text') {
        reader.readAsText(file);
        return;
      }

      reader.readAsDataURL(file);
    };

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  };

  const handleToggleConnection = () => {
    setTool('connect');
  };

  return (
    <div className="left-toolbar">
      <div className="toolbar-group">
        <button
          className={`tool-button ${activeTool === 'select' ? 'active' : ''}`}
          title="Select tool"
          onClick={() => setTool('select')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 4l12 7-6 2-2 6L5 4z" fill="currentColor"/>
          </svg>
        </button>

        <button className="tool-button" title="Add text card" onClick={handleAddTextCard}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z" fill="currentColor"/>
          </svg>
        </button>

        <button className="tool-button" title="Upload file" onClick={handleAddFileCard}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15.01l1.41 1.41L11 14.84V19h2v-4.16l1.59 1.59L16 15.01 12.01 11 8 15.01z" fill="currentColor"/>
          </svg>
        </button>

        <button
          className={`tool-button ${activeTool === 'text' ? 'active' : ''}`}
          title="Text tool"
          onClick={handleAddTextOnly}
        >
          <span className="text-icon">T</span>
        </button>

        <button className="tool-button" title="Add link card" onClick={handleAddLinkCard}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" fill="currentColor"/>
          </svg>
        </button>

        <button className="tool-button" title="Add YouTube video" onClick={handleAddYouTubeCard}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/>
          </svg>
        </button>

        <button className="tool-button" title="Add group" onClick={handleAddGroup}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z" fill="currentColor"/>
          </svg>
        </button>

        <button
          className={`tool-button ${isConnectingMode || activeTool === 'connect' ? 'active' : ''}`}
          title="Add arrow"
          onClick={handleToggleConnection}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z" fill="currentColor"/>
          </svg>
        </button>
      </div>

      <div className="separator"></div>

      <div className="toolbar-group">
        <button
          className="tool-button"
          title="Undo"
          onClick={undo}
          disabled={!canUndo}
          aria-disabled={!canUndo}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 8C9.85 8 7.45 8.99 5.6 10.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" fill="currentColor"/>
          </svg>
        </button>

        <button
          className="tool-button"
          title="Redo"
          onClick={redo}
          disabled={!canRedo}
          aria-disabled={!canRedo}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default LeftToolbar;
