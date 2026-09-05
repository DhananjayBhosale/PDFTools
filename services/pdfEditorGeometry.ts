export interface PdfPoint {
  x: number;
  y: number;
}

export interface PdfPageVisualGeometry {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface PdfRectangle extends PdfPoint {
  width: number;
  height: number;
}

export const normalizePageRotation = (rotation: number): PdfPageVisualGeometry['rotation'] => {
  const normalized = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  return normalized as PdfPageVisualGeometry['rotation'];
};

export const getVisualPageSize = (geometry: PdfPageVisualGeometry) =>
  geometry.rotation === 90 || geometry.rotation === 270
    ? { width: geometry.cropHeight, height: geometry.cropWidth }
    : { width: geometry.cropWidth, height: geometry.cropHeight };

/** Convert PDF.js viewport coordinates (top-left origin) into PDF user-space coordinates. */
export const visualPointToPdf = (
  geometry: PdfPageVisualGeometry,
  visualX: number,
  visualY: number,
): PdfPoint => {
  const { cropX, cropY, cropWidth, cropHeight, rotation } = geometry;
  if (rotation === 90) return { x: cropX + visualY, y: cropY + visualX };
  if (rotation === 180) return { x: cropX + cropWidth - visualX, y: cropY + visualY };
  if (rotation === 270) return { x: cropX + cropWidth - visualY, y: cropY + cropHeight - visualX };
  return { x: cropX + visualX, y: cropY + cropHeight - visualY };
};

export const visualRectangleToPdf = (
  geometry: PdfPageVisualGeometry,
  visualX: number,
  visualY: number,
  visualWidth: number,
  visualHeight: number,
): PdfRectangle => {
  const corners = [
    visualPointToPdf(geometry, visualX, visualY),
    visualPointToPdf(geometry, visualX + visualWidth, visualY),
    visualPointToPdf(geometry, visualX, visualY + visualHeight),
    visualPointToPdf(geometry, visualX + visualWidth, visualY + visualHeight),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y),
  };
};

/** Rotate one PDF-space point around a fixed centre. Positive angles are counter-clockwise. */
export const rotatePointAroundCenter = (
  pointX: number,
  pointY: number,
  centerX: number,
  centerY: number,
  rotationDegrees: number,
): PdfPoint => {
  const radians = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const offsetX = pointX - centerX;
  const offsetY = pointY - centerY;

  return {
    x: centerX + offsetX * cos - offsetY * sin,
    y: centerY + offsetX * sin + offsetY * cos,
  };
};

/** Bottom-left draw origin for a box that must rotate around its visual centre. */
export const rotatedBoxOrigin = (
  centerX: number,
  centerY: number,
  boxWidth: number,
  boxHeight: number,
  rotationDegrees: number,
): PdfPoint => rotatePointAroundCenter(
  centerX - boxWidth / 2,
  centerY - boxHeight / 2,
  centerX,
  centerY,
  rotationDegrees,
);
