export const getViewportCenterInCanvas = ({ panX, panY, zoom, viewportWidth, viewportHeight }) => {
  return {
    x: (viewportWidth / 2 - panX) / zoom,
    y: (viewportHeight / 2 - panY) / zoom,
  };
};

export const getCenteredCardPosition = ({
  size,
  panX,
  panY,
  zoom,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
}) => {
  const center = getViewportCenterInCanvas({ panX, panY, zoom, viewportWidth, viewportHeight });
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
  };
};