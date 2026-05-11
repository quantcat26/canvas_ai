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

  const selectedCardIds = useCanvasStore((state) => state.selectedCardIds);
  const cards = useCanvasStore((state) => state.cards);

  const selectedTextCards = useMemo(() => {
    return selectedCardIds
      .map((id) => cards[id])
      .filter((card) => Boolean(card && card.type === 'text' && card.content && card.content.trim()));
  }, [selectedCardIds, cards]);

  const selectedSummary = useMemo(() => {
    if (selectedTextCards.length === 0) return null;
    const first = selectedTextCards[0]?.content || '';
    const firstLine = first.split('\n')[0] || '';
    const snippet = firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
    return {
      text: snippet || 'Selected text card',
      count: selectedTextCards.length,
    };
  }, [selectedTextCards]);

  const activeConfig = useMemo(() => {
    return configs.find((item) => item.id === activeConfigId) || null;
  }, [configs, activeConfigId]);

  const handleSubmit = () => {
    if (isLoading) return;

    const trimmedInput = inputText.trim();
    const selectedTexts = selectedTextCards.map((card, index) => {
      return `Card ${index + 1} (ID: ${card.id})\n${card.content}`;
    });

    const combinedMessage = (() => {
      if (selectedTexts.length === 0) return trimmedInput;
      const joinedCards = selectedTexts.join('\n\n---\n\n');
      return trimmedInput ? `${joinedCards}\n\nUser message:\n${trimmedInput}` : joinedCards;
    })();

    if (!combinedMessage) return;

    if (!activeConfigId) return;

    onAiSubmit(combinedMessage, activeConfigId);
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    const textArea = textAreaRef.current;
    if (textArea && isInputFocused) {
      textArea.style.height = 'auto';
      textArea.style.height = `${textArea.scrollHeight}px`;
    } else if (textArea) {
      textArea.style.height = '42px';
    }
  }, [inputText, isInputFocused]);

  const handleFocus = () => {
    setIsInputFocused(true);
    if (textAreaRef.current) {
      setTimeout(() => {
        const textArea = textAreaRef.current;
        if (textArea) {
          textArea.style.height = 'auto';
          textArea.style.height = `${textArea.scrollHeight / 1.75}px`;
        }
      }, 0);
    }
  };

  const toggleServiceSelector = () => {
    setShowServiceSelector((prev) => !prev);
  };

  const canSend = Boolean(activeConfig) && (Boolean(inputText.trim()) || selectedTextCards.length > 0);
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
            placeholder="Ask AI Anything..."
            value={isInputFocused ? inputText : ''}
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

            {!isInputFocused && <div className="shortcut-hint">⌘K</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiChatInput;
