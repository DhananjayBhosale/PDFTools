import { canvasToBlob } from './pdfShared';

export interface PreparedPdfImageAsset {
  file: File;
  previewUrl: string;
  aspectRatio: number;
}

const loadImageDimensions = async (blob: Blob): Promise<{ width: number; height: number }> => {
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    const bitmap = await createImageBitmap(blob);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const dimensions = { width: image.width, height: image.height };
      URL.revokeObjectURL(url);
      resolve(dimensions);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    image.src = url;
  });
};

const toPngFile = async (file: File): Promise<File> => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Canvas context unavailable');
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await canvasToBlob(canvas, 'image/png');
  return new File([blob], `${file.name.replace(/\.[^/.]+$/, '')}.png`, { type: 'image/png' });
};

export const preparePdfImageAsset = async (file: File): Promise<PreparedPdfImageAsset> => {
  const preparedFile = ['image/jpeg', 'image/png'].includes(file.type) ? file : await toPngFile(file);
  const { width, height } = await loadImageDimensions(preparedFile);

  return {
    file: preparedFile,
    previewUrl: URL.createObjectURL(preparedFile),
    aspectRatio: width / height,
  };
};

export const getContainedImageSize = (
  aspectRatio: number,
  maxFraction: number,
  pageAspect = 210 / 297,
) => {
  let width = maxFraction;
  let height = (width * pageAspect) / aspectRatio;

  if (height > maxFraction) {
    height = maxFraction;
    width = (height * aspectRatio) / pageAspect;
  }

  return { width, height };
};
