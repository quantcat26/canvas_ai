import React, { useState, useEffect } from 'react';
import AiChatCard from './AiChatCard.jsx';
import './AiChatContainer.css';

const AiChatContainer = ({ responses, onClose, onAddToCanvas }) => {
  const [cardPositions, setCardPositions] = useState([]);

  useEffect(() => {
    if (responses.length > cardPositions.length) {
      const newPositions = [...cardPositions];

      for (let i = cardPositions.length; i < responses.length; i += 1) {
        const baseX = window.innerWidth - 400;
        const baseY = 120 + (i * 20);
        newPositions.push({ x: baseX, y: baseY });
      }

      setCardPositions(newPositions);
    }
  }, [responses.length, cardPositions]);

  if (responses.length === 0) return null;

  return (
    <div className="ai-chat-container">
      {responses.map((response, index) => (
        cardPositions[index] && (
          <AiChatCard
            key={`ai-response-${index}`}
            content={response}
            position={cardPositions[index]}
            onClose={() => onClose(index)}
            onAddToCanvas={() => onAddToCanvas(response)}
          />
        )
      ))}
    </div>
  );
};

export default AiChatContainer;
