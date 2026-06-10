import React, { useState, useRef, useEffect, useMemo } from 'react';
import useCanvasStore from '../store/canvasStore.js';
import './AiChatInput.css';

const AiChatInput = ({
  onAiSubmit,
  isLoading = false,
  configs = [],
  activeConfigId,
  onSelectConfig,
  onOpenSettings,
}) => {
  const [inputText, setInputText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showServiceSelector, setShowServiceSelector] = useState(false);

  const textAreaRef = useRef(null);

  const aiSelectedCardIds = useCanvasStore((state) => state.aiSelectedCardIds);
  const cards = useCanvasStore((state) => state.cards);

  const selectedCards = useMemo(() => {
    return aiSelectedCardIds
      .map((id) => cards[id])
      .filter(Boolean);
  }, [aiSelectedCardIds, cards]);

  const getCardSummaryLabel = (card) => {
    if (!card) return 'Selected card';

    if (card.type === 'text') {
      const content = card.content || '';
      const firstLine = content.split('\n')[0] || '';
      const snippet = firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
      return snippet || 'Text card';
    }

    if (card.type === 'image') {
      return card.fileName || 'Image card';
    }

    if (card.type === 'file') {
      if (card.fileName) return card.fileName;
      if (card.previewType === 'pdf') return 'PDF file';
      if (card.previewType === 'video') return 'Video file';
      if (card.previewType === 'text') return 'Text file';
      return 'File card';
    }

    if (card.type === 'link') {
      if (card.title) return card.title;
      if (!card.url) return 'Link card';
      try {
        return new URL(card.url).hostname || card.url;
      } catch {
        return card.url;
      }
    }

    if (card.type === 'youtube') {
      return card.videoId ? `YouTube: ${card.videoId}` : 'YouTube card';
    }

    if (card.type === 'group') {
      return card.title ? `Group: ${card.title}` : 'Group card';
    }

    return 'Selected card';
  };

  const selectedSummary = useMemo(() => {
    if (selectedCards.length === 0) return null;
    return {
      text: getCardSummaryLabel(selectedCards[0]),
      count: selectedCards.length,
    };
  }, [selectedCards]);

  const activeConfig = useMemo(() => {
    return configs.find((item) => item.id === activeConfigId) || null;
  }, [configs, activeConfigId]);

  const encodeBase64 = (value) => {
    if (!value) return '';
    try {
      return window.btoa(unescape(encodeURIComponent(value)));
    } catch (error) {
      console.warn('Failed to encode attachment to base64:', error);
      return '';
    }
  };
  const extractBase64FromDataUrl = (dataUrl) => {
    if (!dataUrl || typeof dataUrl !== 'string') return '';
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return '';
    const body = dataUrl.slice(commaIdx + 1);
    try {
      return window.atob(body);
    } catch {
      return body;
    }
  };

  const getRawContentFromCard = (card) => {
    if (!card || !card.content) return '';
    if (card.content.startsWith('data:')) {
      return extractBase64FromDataUrl(card.content);
    }
    return card.content;
  };



  const syncTextareaHeight = () => {
    const textArea = textAreaRef.current;
    if (!textArea) return;

    if (textArea.value.length === 0) {
      textArea.style.height = '42px';
      return;
    }

    textArea.style.height = 'auto';
    textArea.style.height = `${textArea.scrollHeight}px`;
  };

  const handleSubmit = () => {
    if (isLoading) return;

    const trimmedInput = inputText.trim();

    // Flatten selected cards: expand group children recursively
    const getAllFlattenedCards = (cardIds, allCards) => {
      const result = [];
      const seen = new Set();
      const collect = (ids) => {
        ids.forEach((id) => {
          const card = allCards[id];
          if (!card || seen.has(id)) return;
          seen.add(id);
          result.push(card);
          if (card.type === 'group' && Array.isArray(card.childIds)) {
            collect(card.childIds);
          }
        });
      };
      collect(cardIds);
      return result;
    };

    const flattenedCards = getAllFlattenedCards(aiSelectedCardIds, cards);

    const buildCardPayload = (card, index) => {
      const header = `Card ${index + 1} (ID: ${card.id})`;
      const typeLabel = card.previewType ? `${card.type} (${card.previewType})` : card.type;
      const details = [`Type: ${typeLabel}`];

      if (card.type === 'text') {
        details.push(`Content:\n${card.content || ''}`);
      } else if (card.type === 'image') {
        if (card.fileName) details.push(`File name: ${card.fileName}`);
        if (card.fileType) details.push(`MIME type: ${card.fileType}`);
        details.push('Image attached');
      } else if (card.type === 'file') {
        if (card.fileName) details.push(`File name: ${card.fileName}`);
        if (card.fileType) details.push(`MIME type: ${card.fileType}`);
        if (card.previewType === 'text') {
          details.push('Text file attached');
        } else {
          details.push('File attached');
        }
      } else if (card.type === 'link') {
        if (card.title) details.push(`Title: ${card.title}`);
        if (card.url) {
          details.push(`URL: ${card.url}`);
        }
      } else if (card.type === 'youtube') {
        if (card.videoId) {
          details.push(`Video ID: ${card.videoId}`);
          details.push(`URL: https://www.youtube.com/watch?v=${card.videoId}`);
        }
      } else if (card.type === 'group') {
        if (card.title) details.push(`Group: ${card.title}`);
      } else if (card.content) {
        details.push(`Content:\n${card.content}`);
      }

      return `${header}\n${details.join('\n')}`.trim();
    };

    const selectedPayloads = flattenedCards.map((card, index) =>
      buildCardPayload(card, index)
    );

    const buildCardAttachment = (card) => {
        if (card.type === 'image' && card.content) {
          return {
            type: 'image',
            mimeType: card.fileType || '',
            name: card.fileName || '',
            data: card.content,
          };
        }

        if (card.type === 'file' && card.content) {
          if (card.previewType === 'video') {
            return {
              type: 'video',
              mimeType: card.fileType || '',
              name: card.fileName || '',
              data: card.content,
            };
          }

          if (card.previewType === 'pdf') {
            return {
              type: 'pdf',
              mimeType: card.fileType || 'application/pdf',
              name: card.fileName || '',
              data: card.content,
            };
          }

          if (card.previewType === 'text') {
            const rawContent = getRawContentFromCard(card);
            if (!rawContent) return null;
            const encoded = encodeBase64(rawContent);
            if (!encoded) return null;
            return {
              type: 'document',
              mimeType: card.fileType || 'text/plain',
              name: card.fileName || '',
              data: encoded,
            };
          }

          return {
            type: 'document',
            mimeType: card.fileType || '',
            name: card.fileName || '',
            data: card.content,
          };
        }

        return null;
      };

    const attachments = flattenedCards
      .map(buildCardAttachment)
      .filter(Boolean);

    const combinedMessage = (() => {
      if (selectedPayloads.length === 0) return trimmedInput;
      const joinedCards = selectedPayloads.join('\n\n---\n\n');
      return trimmedInput ? `${joinedCards}\n\nUser message:\n${trimmedInput}` : joinedCards;
    })();

    if (!combinedMessage) return;

    if (!activeConfigId) return;

    onAiSubmit(combinedMessage, activeConfigId, attachments);
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    syncTextareaHeight();
  }, [inputText]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (!isShortcut) return;

      e.preventDefault();

      const textArea = textAreaRef.current;
      if (!textArea || isLoading) return;

      setShowServiceSelector(false);
      textArea.focus();
      syncTextareaHeight();
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isLoading]);

  const handleFocus = () => {
    setIsInputFocused(true);
    syncTextareaHeight();
  };

  const toggleServiceSelector = () => {
    setShowServiceSelector((prev) => !prev);
  };

  const canSend = Boolean(activeConfig) && (Boolean(inputText.trim()) || selectedCards.length > 0);
  const configLabel = activeConfig ? (activeConfig.name || activeConfig.model) : 'Select model';

  return (
    <div className="bottom-bar">
      <div className="ai-panel">
        {selectedSummary && (
          <div className="selected-card-line">
            <span className="selected-card-label">Selected</span>
            <span className="selected-card-text">{selectedSummary.text}</span>
            {selectedSummary.count > 1 && (
              <span className="selected-card-count">+{selectedSummary.count - 1}</span>
            )}
          </div>
        )}

        <div className={`ai-input-container ${isInputFocused ? 'active' : ''}`}>
          {showServiceSelector && (
            <div className="service-selector">
              <div className="service-selector-header">
                <span>Configured Models</span>
                <button
                  className="model-manage-btn"
                  onClick={() => {
                    setShowServiceSelector(false);
                    if (onOpenSettings) onOpenSettings();
                  }}
                >
                  Manage
                </button>
              </div>
              <div className="model-list">
                {configs.length === 0 && (
                  <div className="model-empty">
                    No models have been configured yet. Please create one first.
                  </div>
                )}
                {configs.map((config) => (
                  <button
                    key={config.id}
                    className={`model-option ${config.id === activeConfigId ? 'selected' : ''}`}
                    onClick={() => {
                      if (onSelectConfig) onSelectConfig(config.id);
                      setShowServiceSelector(false);
                    }}
                  >
                    <div>
                      <div className="model-option-name">{config.name || config.model}</div>
                      <div className="model-option-meta">{config.model}</div>
                    </div>
                    <span className="model-option-base">{config.baseUrl.replace(/^https?:\/\//, '')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            ref={textAreaRef}
            className="ai-input ai-textarea"
            placeholder="Ask AI Anything... ⌘K"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={() => setIsInputFocused(false)}
            disabled={isLoading}
            rows={1}
          />

          <div className="input-actions">
            <button
              className="service-selector-btn"
              onClick={toggleServiceSelector}
              title="Select AI service"
            >
              <span className="service-indicator">{configLabel}</span>
            </button>

            <button
              className="send-btn"
              onClick={handleSubmit}
              disabled={!canSend || isLoading}
              aria-label="Send"
            >
              {isLoading ? '...' : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 12h14m0 0l-5-5m5 5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AiChatInput;
