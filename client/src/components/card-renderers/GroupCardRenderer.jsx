import React, { memo } from 'react';
import { Text } from 'react-konva';

const GroupCardRenderer = memo(({ card, isHighlighted }) => (
  <Text
    x={12}
    y={10}
    width={card.size.width - 24}
    height={20}
    text={card.title || 'Group'}
    fontSize={13}
    fill={isHighlighted ? '#14532d' : '#64748b'}
    listening={false}
  />
));

GroupCardRenderer.displayName = 'GroupCardRenderer';

export default GroupCardRenderer;
