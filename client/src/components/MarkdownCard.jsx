import React, { useMemo } from 'react';
import { Group, Rect, Text } from 'react-konva';

const BASE_FONT_SIZE = 14;
const LINE_HEIGHT = 1.5;
const FONT_FAMILY = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
const CODE_FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
const CODE_BG = '#eef2ff';
const CODE_TEXT = '#1e293b';
const TEXT_COLOR = '#1f2937';
const MUTED_TEXT = '#6b7280';
const TABLE_BORDER = '#e2e8f0';
const TABLE_HEADER_BG = '#f8fafc';
const HR_COLOR = '#e5e7eb';

const measureContext = typeof document !== 'undefined'
  ? document.createElement('canvas').getContext('2d')
  : null;

const getFont = ({ fontSize, fontFamily, fontStyle = 'normal' }) => {
  return `${fontStyle} ${fontSize}px ${fontFamily}`.trim();
};

const measureTextWidth = (text, style) => {
  if (!measureContext) return text.length * style.fontSize * 0.6;
  measureContext.font = getFont(style);
  return measureContext.measureText(text).width;
};

const splitInlineCode = (text) => {
  const segments = [];
  const regex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match = null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), isCode: false });
    }
    segments.push({ text: match[1], isCode: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isCode: false });
  }

  return segments;
};

const parseInlineStyles = (text) => {
  const segments = [];
  const regex = /(\*\*\*|___)(.+?)\1|(\*\*|__)(.+?)\3|(\*|_)(.+?)\5/g;
  let lastIndex = 0;
  let match = null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false, italic: false });
    }

    if (match[1]) {
      segments.push({ text: match[2], bold: true, italic: true });
    } else if (match[3]) {
      segments.push({ text: match[4], bold: true, italic: false });
    } else if (match[5]) {
      segments.push({ text: match[6], bold: false, italic: true });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false, italic: false });
  }

  return segments;
};

const resolveFontStyle = (bold, italic, baseStyle = 'normal') => {
  if (bold && italic) return 'bold italic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return baseStyle || 'normal';
};

const splitTokens = (text) => {
  return text.split(/(\s+)/).filter((token) => token.length > 0);
};

const isWhitespaceToken = (token) => /^\s+$/.test(token);

const splitByWidth = (text, style, maxWidth) => {
  const chars = text.split('');
  const parts = [];
  let current = '';

  chars.forEach((char) => {
    const next = current + char;
    if (measureTextWidth(next, style) > maxWidth && current.length > 0) {
      parts.push(current);
      current = char;
      return;
    }
    current = next;
  });

  if (current.length > 0) {
    parts.push(current);
  }

  return parts;
};

const layoutInline = (text, maxWidth, baseStyle, codeStyle, codePadding) => {
  const segments = splitInlineCode(text);
  const lines = [];
  let currentLine = { tokens: [], width: 0, height: baseStyle.fontSize * LINE_HEIGHT };

  const pushLine = () => {
    if (currentLine.tokens.length > 0) {
      lines.push(currentLine);
    }
    currentLine = { tokens: [], width: 0, height: baseStyle.fontSize * LINE_HEIGHT };
  };

  segments.forEach((segment) => {
    const isCode = segment.isCode;
    const runs = isCode
      ? [{ text: segment.text, bold: false, italic: false }]
      : parseInlineStyles(segment.text);

    runs.forEach((run) => {
      if (!run.text) return;

      const style = isCode
        ? codeStyle
        : {
          ...baseStyle,
          fontStyle: resolveFontStyle(run.bold, run.italic, baseStyle.fontStyle),
        };
      const tokens = isCode ? [run.text] : splitTokens(run.text);

      tokens.forEach((token) => {
        if (!token) return;

        if (!isCode && isWhitespaceToken(token)) {
          if (currentLine.tokens.length === 0) {
            return;
          }

          const rawWidth = measureTextWidth(token, style);
          if (currentLine.width + rawWidth > maxWidth) {
            pushLine();
            return;
          }

          currentLine.tokens.push({
            text: token,
            isCode,
            style,
            width: rawWidth,
            height: style.fontSize * LINE_HEIGHT,
          });
          currentLine.width += rawWidth;
          return;
        }

        const tokenWidth = measureTextWidth(token, style);
        const remainingWidth = maxWidth - currentLine.width;
        let tokenParts = [token];

        if (!isCode && currentLine.tokens.length > 0 && tokenWidth > remainingWidth && remainingWidth > 0) {
          const firstParts = splitByWidth(token, style, remainingWidth);
          const firstPart = firstParts[0];
          if (firstPart && firstPart.length < token.length) {
            const remainder = token.slice(firstPart.length);
            tokenParts = [firstPart, ...splitByWidth(remainder, style, maxWidth)];
          }
        }

        if (tokenParts.length === 1 && measureTextWidth(tokenParts[0], style) > maxWidth) {
          tokenParts = splitByWidth(tokenParts[0], style, maxWidth);
        }

        tokenParts.forEach((part) => {
          const rawWidth = measureTextWidth(part, style);
          const partWidth = isCode ? rawWidth + codePadding.x * 2 : rawWidth;
          const tokenHeight = isCode
            ? style.fontSize + codePadding.y * 2 + 2
            : style.fontSize * LINE_HEIGHT;

          if (currentLine.width + partWidth > maxWidth && currentLine.tokens.length > 0) {
            pushLine();
          }

          currentLine.tokens.push({
            text: part,
            isCode,
            style,
            width: partWidth,
            height: tokenHeight,
          });
          currentLine.width += partWidth;
          currentLine.height = Math.max(currentLine.height, tokenHeight);
        });
      });
    });
  });

  if (currentLine.tokens.length > 0) {
    lines.push(currentLine);
  }

  return lines;
};

const wrapPlainText = (text, maxWidth, style) => {
  const words = splitTokens(text);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const next = current.length === 0 ? word : `${current}${word}`;
    if (measureTextWidth(next, style) <= maxWidth) {
      current = next;
      return;
    }

    if (current.length > 0) {
      lines.push(current);
      current = '';
    }

    if (measureTextWidth(word, style) > maxWidth) {
      splitByWidth(word, style, maxWidth).forEach((part) => lines.push(part));
    } else {
      current = word;
    }
  });

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
};

const isTableSeparator = (line) => /^\s*\|?\s*:?[-]+:?\s*(\|\s*:?[-]+:?\s*)+\|?\s*$/.test(line);

const parseTableRow = (line) => {
  const trimmed = line.trim();
  const raw = trimmed.split('|');
  if (raw.length <= 1) return [trimmed];
  const cells = trimmed.startsWith('|') ? raw.slice(1) : raw.slice();
  const normalized = trimmed.endsWith('|') ? cells.slice(0, -1) : cells;
  return normalized.map((cell) => cell.trim());
};

const parseMarkdownBlocks = (markdown) => {
  const lines = markdown.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      blocks.push({ type: 'space', size: 8 });
      i += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', text: codeLines.join('\n') });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    const headingMatch = /^#{1,6}\s+/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[0].trim().length;
      blocks.push({ type: 'heading', level, text: trimmed.replace(/^#{1,6}\s+/, '') });
      i += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'blockquote', blocks: parseMarkdownBlocks(quoteLines.join('\n')) });
      continue;
    }

    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const rows = [parseTableRow(line)];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(parseTableRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', rows });
      continue;
    }

    const listMatch = /^\s*([-*+]\s+|\d+\.\s+)/.exec(line);
    if (listMatch) {
      const items = [];
      const ordered = /^\s*\d+\.\s+/.test(line);
      while (i < lines.length && /^\s*([-*+]\s+|\d+\.\s+)/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]\s+|\d+\.\s+)/, '').trim());
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraphLines = [];
    while (i < lines.length && lines[i].trim() !== '') {
      const nextLine = lines[i].trim();
      if (nextLine.startsWith('```') || /^#{1,6}\s+/.test(nextLine) || nextLine.startsWith('>')) {
        break;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(nextLine)) {
        break;
      }
      if (nextLine.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        break;
      }
      if (/^\s*([-*+]\s+|\d+\.\s+)/.test(lines[i])) {
        break;
      }
      paragraphLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
  }

  return blocks;
};

const MarkdownCard = ({ content, x = 0, y = 0, width = 200, height = 120 }) => {
  const markdown = content || 'Click to edit text content';

  const blocks = useMemo(() => parseMarkdownBlocks(markdown), [markdown]);

  const elements = useMemo(() => {
    const renderNodes = [];
    const maxWidth = Math.max(40, width);
    let keyCounter = 0;
    const nextKey = (label) => `${label}-${keyCounter++}`;
    const baseStyle = {
      fontSize: BASE_FONT_SIZE,
      fontFamily: FONT_FAMILY,
      fontStyle: 'normal',
      fill: TEXT_COLOR,
    };
    const codeStyle = {
      fontSize: BASE_FONT_SIZE - 1,
      fontFamily: CODE_FONT_FAMILY,
      fontStyle: 'normal',
      fill: CODE_TEXT,
    };
    const codePadding = { x: 4, y: 2 };

    const pushLine = (line, startX, startY) => {
      let cursorX = startX;
      line.tokens.forEach((token, tokenIndex) => {
        const textHeight = token.isCode
          ? token.style.fontSize * LINE_HEIGHT
          : token.style.fontSize * LINE_HEIGHT;
        const tokenTop = startY + (line.height - token.height) / 2;
        const textTop = startY + (line.height - textHeight) / 2;

        if (token.isCode) {
          renderNodes.push(
            <Rect
              key={nextKey('code-bg')}
              x={cursorX}
              y={tokenTop}
              width={token.width}
              height={token.height}
              fill={CODE_BG}
              cornerRadius={4}
            />
          );
          renderNodes.push(
            <Text
              key={nextKey('code-text')}
              x={cursorX + codePadding.x}
              y={textTop}
              text={token.text}
              fontSize={token.style.fontSize}
              fontFamily={token.style.fontFamily}
              fontStyle={token.style.fontStyle}
              fill={CODE_TEXT}
            />
          );
        } else {
          renderNodes.push(
            <Text
              key={nextKey('text')}
              x={cursorX}
              y={textTop}
              text={token.text}
              fontSize={token.style.fontSize}
              fontFamily={token.style.fontFamily}
              fontStyle={token.style.fontStyle}
              fill={token.style.fill || TEXT_COLOR}
            />
          );
        }

        cursorX += token.width;
      });
    };

    const renderBlockList = (blockList, startX, startY, availableWidth) => {
      let cursorY = startY;

      blockList.forEach((block, blockIndex) => {
        if (cursorY > height) return;

        if (block.type === 'space') {
          cursorY += block.size;
          return;
        }

        if (block.type === 'hr') {
          renderNodes.push(
            <Rect
              key={nextKey('hr')}
              x={startX}
              y={cursorY + 4}
              width={availableWidth}
              height={1}
              fill={HR_COLOR}
            />
          );
          cursorY += 12;
          return;
        }

        if (block.type === 'heading') {
          const sizeMap = { 1: 22, 2: 18, 3: 16, 4: 15, 5: 14, 6: 13 };
          const headingStyle = {
            ...baseStyle,
            fontSize: sizeMap[block.level] || 16,
            fontStyle: 'bold',
          };
          const lines = layoutInline(block.text, availableWidth, headingStyle, codeStyle, codePadding);
          lines.forEach((line, lineIndex) => {
            pushLine(line, startX, cursorY);
            cursorY += line.height;
            if (lineIndex === lines.length - 1) {
              cursorY += 8;
            }
          });
          return;
        }

        if (block.type === 'paragraph') {
          const lines = layoutInline(block.text, availableWidth, baseStyle, codeStyle, codePadding);
          lines.forEach((line) => {
            pushLine(line, startX, cursorY);
            cursorY += line.height;
          });
          cursorY += 8;
          return;
        }

        if (block.type === 'blockquote') {
          const indent = 12;
          const initialY = cursorY;
          const nested = renderBlockList(block.blocks, startX + indent, cursorY, availableWidth - indent);
          const blockHeight = nested - initialY;
          renderNodes.push(
            <Rect
              key={nextKey('quote-bar')}
              x={startX}
              y={initialY}
              width={3}
              height={blockHeight}
              fill={TABLE_BORDER}
              cornerRadius={3}
            />
          );
          cursorY = nested + 8;
          return;
        }

        if (block.type === 'list') {
          const indent = 16;
          block.items.forEach((item, itemIndex) => {
            const prefix = block.ordered ? `${itemIndex + 1}.` : '•';
            const prefixStyle = { ...baseStyle, fontStyle: 'bold' };
            const lines = layoutInline(item, availableWidth - indent, baseStyle, codeStyle, codePadding);

            lines.forEach((line, lineIndex) => {
              if (lineIndex === 0) {
                renderNodes.push(
                  <Text
                    key={nextKey('list-prefix')}
                    x={startX}
                    y={cursorY}
                    text={`${prefix} `}
                    fontSize={prefixStyle.fontSize}
                    fontFamily={prefixStyle.fontFamily}
                    fontStyle={prefixStyle.fontStyle}
                    fill={TEXT_COLOR}
                  />
                );
                pushLine(line, startX + indent, cursorY);
              } else {
                pushLine(line, startX + indent, cursorY);
              }
              cursorY += line.height;
            });

            cursorY += 6;
          });
          return;
        }

        if (block.type === 'code') {
          const paddingX = 10;
          const paddingY = 8;
          const codeLines = block.text.split('\n');
          const codeTextStyle = { ...codeStyle, fontSize: BASE_FONT_SIZE - 1 };
          const wrappedLines = [];
          codeLines.forEach((line) => {
            const parts = splitByWidth(line.length === 0 ? ' ' : line, codeTextStyle, availableWidth - paddingX * 2);
            wrappedLines.push(...parts);
          });
          const lineHeight = codeTextStyle.fontSize * LINE_HEIGHT;
          const blockHeight = wrappedLines.length * lineHeight + paddingY * 2;

          renderNodes.push(
            <Rect
              key={nextKey('code-block')}
              x={startX}
              y={cursorY}
              width={availableWidth}
              height={blockHeight}
              fill={CODE_BG}
              cornerRadius={6}
            />
          );

          wrappedLines.forEach((line, lineIndex) => {
            renderNodes.push(
              <Text
                key={nextKey('code-line')}
                x={startX + paddingX}
                y={cursorY + paddingY + lineIndex * lineHeight}
                text={line}
                fontSize={codeTextStyle.fontSize}
                fontFamily={codeTextStyle.fontFamily}
                fill={CODE_TEXT}
              />
            );
          });

          cursorY += blockHeight + 8;
          return;
        }

        if (block.type === 'table') {
          const cellPadding = 6;
          const tableFont = { ...baseStyle, fontSize: BASE_FONT_SIZE - 1 };
          const columnCount = Math.max(...block.rows.map((row) => row.length));
          const colWidths = new Array(columnCount).fill(60);
          const rawWidth = 10000;

          block.rows.forEach((row) => {
            row.forEach((cell, colIndex) => {
              const measureLines = layoutInline(cell, rawWidth, tableFont, codeStyle, codePadding);
              const measuredWidth = measureLines.reduce((maxValue, line) => Math.max(maxValue, line.width), 0);
              const cellWidth = Math.max(measuredWidth, measureTextWidth(cell, tableFont)) + cellPadding * 2;
              colWidths[colIndex] = Math.max(colWidths[colIndex], cellWidth);
            });
          });

          const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
          if (totalWidth > availableWidth) {
            const scale = availableWidth / totalWidth;
            for (let i = 0; i < colWidths.length; i += 1) {
              colWidths[i] = Math.max(50, colWidths[i] * scale);
            }
          }

          block.rows.forEach((row, rowIndex) => {
            let rowHeight = tableFont.fontSize * LINE_HEIGHT + cellPadding * 2;
            const cellLayouts = row.map((cell, colIndex) => {
              const lines = layoutInline(cell, colWidths[colIndex] - cellPadding * 2, tableFont, codeStyle, codePadding);
              const cellHeight = lines.reduce((sum, line) => sum + line.height, 0) + cellPadding * 2;
              rowHeight = Math.max(rowHeight, cellHeight);
              return lines;
            });

            let cursorX = startX;
            row.forEach((cell, colIndex) => {
              const isHeader = rowIndex === 0;
              renderNodes.push(
                <Rect
                  key={nextKey('table-cell')}
                  x={cursorX}
                  y={cursorY}
                  width={colWidths[colIndex]}
                  height={rowHeight}
                  stroke={TABLE_BORDER}
                  fill={isHeader ? TABLE_HEADER_BG : '#fff'}
                />
              );

              const cellLines = cellLayouts[colIndex];
              let cellY = cursorY + cellPadding;
              cellLines.forEach((line) => {
                pushLine(line, cursorX + cellPadding, cellY);
                cellY += line.height;
              });

              cursorX += colWidths[colIndex];
            });

            cursorY += rowHeight;
          });

          cursorY += 10;
        }
      });

      return cursorY;
    };

    renderBlockList(blocks, 0, 0, maxWidth);

    return renderNodes;
  }, [blocks, height, width]);

  return (
    <Group x={x} y={y} clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
      {elements}
    </Group>
  );
};

export default MarkdownCard;
