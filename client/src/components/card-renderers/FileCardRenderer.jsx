import React, { memo } from 'react';
import { Group, Text } from 'react-konva';

const FILE_ICONS = {
  pdf: '📄',
  doc: '📝',
  docx: '📝',
  xls: '📊',
  xlsx: '📊',
  ppt: '📑',
  pptx: '📑',
  txt: '📃',
  csv: '📊',
  default: '📁',
};

const FILE_TYPE_NAMES = {
  pdf: 'PDF',
  doc: 'Word',
  docx: 'Word',
  xls: 'Excel',
  xlsx: 'Excel',
  ppt: 'PowerPoint',
  pptx: 'PowerPoint',
  txt: 'Text',
  csv: 'CSV',
};

const getFileIcon = (fileType) => {
  if (!fileType) return FILE_ICONS.default;
  return FILE_ICONS[fileType.toLowerCase()] || FILE_ICONS.default;
};

const getFileTypeName = (fileType) => {
  if (!fileType) return 'File';
  return FILE_TYPE_NAMES[fileType.toLowerCase()] || fileType.toUpperCase();
};

const FileCardRenderer = memo(({ card }) => (
  <Group>
    <Text
      x={15}
      y={20}
      text={getFileIcon(card.fileType)}
      fontSize={28}
      listening={false}
    />
    <Text
      x={55}
      y={20}
      width={card.size.width - 70}
      height={20}
      text={card.title || card.fileName || getFileTypeName(card.fileType)}
      fontSize={13}
      fontStyle="bold"
      fill="#1f2937"
      listening={false}
    />
    {card.title && card.fileName && card.title !== card.fileName && (
      <Text
        x={55}
        y={44}
        width={card.size.width - 70}
        height={14}
        text={card.fileName}
        fontSize={11}
        fill="#6b7280"
        listening={false}
      />
    )}
    {card.fileSize && (
      <Text
        x={55}
        y={card.title && card.fileName && card.title !== card.fileName ? 60 : 44}
        width={card.size.width - 70}
        height={14}
        text={card.fileSize}
        fontSize={11}
        fill="#9ca3af"
        listening={false}
      />
    )}
  </Group>
));

FileCardRenderer.displayName = 'FileCardRenderer';

export default FileCardRenderer;
