import React, { memo } from 'react';
import { Image } from 'react-konva';

const imageCache = new Map();

const loadImage = (url) => {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);

  const img = new window.Image();
  img.src = url;
  img.crossOrigin = 'anonymous';
  imageCache.set(url, img);
  return img;
};

const ImageCardRenderer = memo(({ card }) => (
  <Image
    x={0}
    y={15}
    width={card.size.width}
    height={card.size.height - 15}
    image={loadImage(card.content)}
    cornerRadius={5}
    listening={false}
  />
));

ImageCardRenderer.displayName = 'ImageCardRenderer';

export default ImageCardRenderer;
