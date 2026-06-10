import React, { memo } from 'react';
import { Group, Text } from 'react-konva';

const YoutubeCardRenderer = memo(({ card }) => (
  <Group>
    <Text
      x={0}
      y={18}
      width={card.size.width}
      height={30}
      text="▶️"
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
      text={card.videoId ? `YouTube: ${card.videoId}` : 'YouTube preview'}
      fontSize={13}
      fill="#475569"
      align="center"
      listening={false}
    />
  </Group>
));

YoutubeCardRenderer.displayName = 'YoutubeCardRenderer';

export default YoutubeCardRenderer;
