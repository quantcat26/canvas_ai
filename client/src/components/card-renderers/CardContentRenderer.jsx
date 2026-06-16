import React, { memo } from 'react';
import TextCardRenderer from './TextCardRenderer.jsx';
import ImageCardRenderer from './ImageCardRenderer.jsx';
import FileCardRenderer from './FileCardRenderer.jsx';
import LinkCardRenderer from './LinkCardRenderer.jsx';
import YoutubeCardRenderer from './YoutubeCardRenderer.jsx';
import GroupCardRenderer from './GroupCardRenderer.jsx';

const CardContentRenderer = memo(({
  card,
  isSelected,
  isGroupHighlighted,
}) => {
  switch (card.type) {
    case 'text':
      return (
        <TextCardRenderer
          card={card}
          isSelected={isSelected}
        />
      );
    case 'image':
      return <ImageCardRenderer card={card} />;
    case 'file':
      return <FileCardRenderer card={card} />;
    case 'link':
      return <LinkCardRenderer card={card} />;
    case 'youtube':
      return <YoutubeCardRenderer card={card} />;
    case 'group':
      return (
        <GroupCardRenderer
          card={card}
          isHighlighted={isGroupHighlighted}
        />
      );
    default:
      return null;
  }
});

CardContentRenderer.displayName = 'CardContentRenderer';

export default CardContentRenderer;
