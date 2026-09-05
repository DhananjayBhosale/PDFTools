import type { OutputDeliveryHandler } from './platform/contracts.ts';
import { Capacitor } from '@capacitor/core';
import {
  announceOutput,
  getWorkspaceSettings,
  recordOutput,
  type OutputRecord,
} from './workspace.ts';

interface InstalledOutputDeliveryHandler {
  handler: OutputDeliveryHandler;
}

let outputDeliveryHandler: InstalledOutputDeliveryHandler | null = null;

/** Installs one process-wide delivery seam. Cleanup cannot remove a newer handler. */
export const installOutputDeliveryHandler = (handler: OutputDeliveryHandler): (() => void) => {
  const installation = { handler };
  outputDeliveryHandler = installation;
  let installed = true;
  return () => {
    if (!installed) return;
    installed = false;
    if (outputDeliveryHandler === installation) outputDeliveryHandler = null;
  };
};

export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

/** Browsers and file pickers do not consistently provide a MIME type for local PDFs. */
export const isPdfFile = (file: File): boolean =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

export const getSafeBuffer = (buffer: ArrayBuffer): Uint8Array => {
  return new Uint8Array(buffer).slice(0);
};

const canvasDataUrlToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => {
  const dataUrl = canvas.toDataURL(type, quality);
  const separator = dataUrl.indexOf(',');
  if (separator < 0) throw new Error('Canvas export failed');

  const header = dataUrl.slice(0, separator);
  const payload = dataUrl.slice(separator + 1);
  const mimeType = /^data:([^;,]+)/.exec(header)?.[1] || type;
  const decoded = atob(payload);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
};

export const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => {
  // Android System WebView can leave HTMLCanvasElement.toBlob callbacks pending
  // indefinitely. Its synchronous encoder is reliable, so use that only in the
  // native shell and keep the lower-memory asynchronous path in browsers.
  if (Capacitor.isNativePlatform()) {
    return Promise.resolve(canvasDataUrlToBlob(canvas, type, quality));
  }

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

export const triggerBrowserDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return url;
};

const createOutputRecord = (
  blob: Blob,
  filename: string,
  mimeType: string,
  toolPath: string,
): OutputRecord => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  filename,
  mimeType,
  size: blob.size,
  toolPath,
  createdAt: Date.now(),
  blob,
});

const deliverWithInstalledHandler = async (
  installation: InstalledOutputDeliveryHandler,
  blob: Blob,
  filename: string,
  mimeType: string,
  toolPath: string,
): Promise<void> => {
  const settings = getWorkspaceSettings();
  const record = createOutputRecord(blob, filename, mimeType, toolPath);
  await installation.handler({
    blob,
    name: filename,
    mimeType,
    toolPath,
    keepLocalHistory: settings.keepLocalHistory,
    autoDownload: settings.autoDownload,
  });
  announceOutput(record);
};

export const downloadBlob = (blob: Blob, filename: string, mimeType = blob.type) => {
  const resolvedMimeType = mimeType || blob.type || 'application/octet-stream';
  const toolPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const installation = outputDeliveryHandler;
  if (installation) {
    void deliverWithInstalledHandler(installation, blob, filename, resolvedMimeType, toolPath)
      .catch((error) => console.warn('Unable to save output in local history.', error));
    return null;
  }

  // Browser/PWA fallback intentionally remains byte-for-byte in behaviour when
  // no native delivery handler is installed.
  void recordOutput(blob, filename, resolvedMimeType, toolPath)
    .then(announceOutput)
    .catch((error) => console.warn('Unable to save output in local history.', error));

  if (!getWorkspaceSettings().autoDownload) return null;

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
          triggerBrowserDownload(blob, filename);
        }
      }
    })();
    return null;
  }

  return triggerBrowserDownload(blob, filename);
};

/**
 * Delivers one output and resolves only after the result is recoverable.
 *
 * Existing tools intentionally keep `downloadBlob`'s fire-and-forget behavior.
 * Editors that disarm a dirty-state guard use this seam so a failed or cancelled
 * native delivery cannot be reported as a successful save.
 */
export const deliverBlob = async (
  blob: Blob,
  filename: string,
  mimeType = blob.type,
): Promise<void> => {
  const resolvedMimeType = mimeType || blob.type || 'application/octet-stream';
  const toolPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const installation = outputDeliveryHandler;
  if (installation) {
    await deliverWithInstalledHandler(installation, blob, filename, resolvedMimeType, toolPath);
    return;
  }

  const settings = getWorkspaceSettings();
  let record: OutputRecord | null = null;
  let historyError: unknown;
  try {
    record = await recordOutput(blob, filename, resolvedMimeType, toolPath);
  } catch (error) {
    historyError = error;
  }

  if (!settings.autoDownload) {
    if (!record) throw historyError;
    announceOutput(record);
    return;
  }

  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: resolvedMimeType
          ? [
              {
                description: 'Document export',
                accept: { [resolvedMimeType]: [`.${filename.split('.').pop() || ''}`] },
              },
            ]
          : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      if (record) announceOutput(record);
      return;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        if (settings.keepLocalHistory && record) {
          announceOutput(record);
          return;
        }
        throw historyError ?? error;
      }
      triggerBrowserDownload(blob, filename);
      if (record) announceOutput(record);
      return;
    }
  }

  triggerBrowserDownload(blob, filename);
  if (record) announceOutput(record);
};

export const downloadBytes = (
  bytes: Uint8Array | ArrayBuffer,
  filename: string,
  mimeType = 'application/octet-stream',
) => {
  const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return downloadBlob(new Blob([payload], { type: mimeType }), filename, mimeType);
};
