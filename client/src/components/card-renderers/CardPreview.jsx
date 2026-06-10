import React, { memo } from 'react';
import styles from '../InfiniteCanvas.module.css';

const EmbeddedIframe = memo(({
  src,
  title,
  sandbox,
  allow,
  allowFullScreen,
  referrerPolicy = 'no-referrer',
}) => (
  <iframe
    className={styles.previewFrame}
    src={src || undefined}
    title={title}
    referrerPolicy={referrerPolicy}
    sandbox={sandbox}
    allow={allow}
    allowFullScreen={allowFullScreen}
  />
));
EmbeddedIframe.displayName = 'EmbeddedIframe';

const EmbeddedVideo = memo(({ src }) => (
  <video
    className={styles.previewFrame}
    src={src}
    playsInline
    controls
    preload="metadata"
  />
));
EmbeddedVideo.displayName = 'EmbeddedVideo';

const CardPreview = memo(({
  card,
  title,
  onDragStart,
}) => {
  if (card.type === 'link') {
    return (
      <div className={styles.previewCardShell}>
        <div
          className={styles.previewHeader}
          onMouseDown={(e) => onDragStart(card.id, e)}
        >
          {title}
        </div>
        <div className={styles.previewBody}>
          <EmbeddedIframe
            src={card.url}
            title={title}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      </div>
    );
  }

  if (card.type === 'youtube') {
    const embedUrl = card.videoId
      ? `https://www.youtube.com/embed/${card.videoId}?rel=0&modestbranding=1`
      : '';
    return (
      <div className={styles.previewCardShell}>
        <div
          className={styles.previewHeader}
          onMouseDown={(e) => onDragStart(card.id, e)}
        >
          {title}
        </div>
        <div className={styles.previewBody}>
          <EmbeddedIframe
            src={embedUrl}
            title={title}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  if (card.previewType === 'pdf') {
    return (
      <div className={styles.previewCardShell}>
        <div
          className={styles.previewHeader}
          onMouseDown={(e) => onDragStart(card.id, e)}
        >
          {title}
        </div>
        <div className={styles.previewBody}>
          <EmbeddedIframe
            src={card.content}
            title={card.fileName || 'PDF preview'}
          />
        </div>
      </div>
    );
  }

  if (card.previewType === 'video') {
    return (
      <div className={styles.previewCardShell}>
        <div
          className={styles.previewHeader}
          onMouseDown={(e) => onDragStart(card.id, e)}
        >
          {title}
        </div>
        <div className={styles.previewBody}>
          <EmbeddedVideo src={card.content} />
        </div>
      </div>
    );
  }

  if (card.previewType === 'text') {
    const previewText = (card.content || '').slice(0, 4000);
    return (
      <pre className={styles.previewText}>
        {previewText || 'Text preview is empty.'}
      </pre>
    );
  }

  return null;
});

CardPreview.displayName = 'CardPreview';

export default CardPreview;
