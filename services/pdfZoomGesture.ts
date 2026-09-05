export const clampPdfZoom = (zoom: number, min: number, max: number) =>
  Math.min(max, Math.max(min, zoom));

export const pdfZoomFromWheel = (
  currentZoom: number,
  deltaY: number,
  min: number,
  max: number,
) => clampPdfZoom(currentZoom * Math.exp(-deltaY * 0.01), min, max);

export const pdfZoomFromPinch = (
  startZoom: number,
  startDistance: number,
  currentDistance: number,
  min: number,
  max: number,
) => {
  if (startDistance <= 0 || currentDistance <= 0) return clampPdfZoom(startZoom, min, max);
  return clampPdfZoom(startZoom * (currentDistance / startDistance), min, max);
};

export const pdfZoomScrollOffset = (
  currentScroll: number,
  pointerOffset: number,
  previousZoom: number,
  nextZoom: number,
) => {
  if (previousZoom <= 0 || previousZoom === nextZoom) return currentScroll;
  return Math.max(0, (currentScroll + pointerOffset) * (nextZoom / previousZoom) - pointerOffset);
};

export const pdfPageFromScrollBoundary = ({
  currentPage,
  pageCount,
  zoom,
  deltaX,
  deltaY,
  atStart,
  atEnd,
}: {
  currentPage: number;
  pageCount: number;
  zoom: number;
  deltaX: number;
  deltaY: number;
  atStart: boolean;
  atEnd: boolean;
}) => {
  if (zoom <= 1 || pageCount < 2 || Math.abs(deltaY) < 4 || Math.abs(deltaY) <= Math.abs(deltaX)) {
    return currentPage;
  }
  if (deltaY > 0 && atEnd) return Math.min(pageCount - 1, currentPage + 1);
  if (deltaY < 0 && atStart) return Math.max(0, currentPage - 1);
  return currentPage;
};
