import React, { memo } from 'react';
import { Group, Text } from 'react-konva';

const getLinkDisplayTitle = (card) => {
  if (card.title) return card.title;
  if (!card.url) return 'Link preview';

  try {
    return new URL(card.url).hostname || card.url;
  } catch {
    return card.url;
  }
};

const LinkCardRenderer = memo(({ card }) => (
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
      text={getLinkDisplayTitle(card)}
      fontSize={13}
      fill="#475569"
      align="center"
      listening={false}
    />
  </Group>
));

LinkCardRenderer.displayName = 'LinkCardRenderer';

export default LinkCardRenderer;
