import React from 'react';
import './ZoomControls.css';
import useCanvasStore from '../store/canvasStore.js';

const ZoomControls = () => {
  const { zoom, zoomIn, zoomOut, resetZoom, resetPosition } = useCanvasStore();

  return (
    <div className="zoom-controls">
      <div className="button-wrapper">
        <button
          className="tool-button position-reset-button"
          onClick={resetPosition}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" fill="currentColor"/>
          </svg>
          <div className="custom-tooltip">Reset canvas position</div>
        </button>
      </div>

      <div className="button-wrapper">
        <button
          className="tool-button zoom-button"
          onClick={zoomOut}
        >
          <span>−</span>
          <div className="custom-tooltip">Zoom out</div>
        </button>
      </div>

      <div className="button-wrapper">
        <button
          className="tool-button zoom-level-button"
          onClick={resetZoom}
        >
          {Math.round(zoom * 100)}%
          <div className="custom-tooltip">Reset zoom to 100%</div>
        </button>
      </div>

      <div className="button-wrapper">
        <button
          className="tool-button zoom-button"
          onClick={zoomIn}
        >
          <span>+</span>
          <div className="custom-tooltip">Zoom in</div>
        </button>
      </div>
    </div>
  );
};

export default ZoomControls;
