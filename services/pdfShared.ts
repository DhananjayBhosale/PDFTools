export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const getSafeBuffer = (buffer: ArrayBuffer): Uint8Array => {
  return new Uint8Array(buffer).slice(0);
};

export const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas export failed'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
};

export const revokeObjectUrl = (url?: string | null) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

export const revokeObjectUrls = (urls: Iterable<string | null | undefined>) => {
  for (const url of urls) {
    revokeObjectUrl(url);
  }
};

const triggerAnchorDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return url;
};

export const downloadBlob = (blob: Blob, filename: string, mimeType = blob.type) => {
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    void (async () => {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: mimeType
            ? [
                {
                  description: 'Document export',
                  accept: { [mimeType]: [`.${filename.split('.').pop() || ''}`] },
                },
              ]
            : undefined,
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          triggerAnchorDownload(blob, filename);
        }
      }
    })();
    return null;
  }

  return triggerAnchorDownload(blob, filename);
};

export const downloadBytes = (
  bytes: Uint8Array | ArrayBuffer,
  filename: string,
  mimeType = 'application/octet-stream',
) => {
  const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return downloadBlob(new Blob([payload], { type: mimeType }), filename, mimeType);
};
