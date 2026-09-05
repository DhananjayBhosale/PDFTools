import type { ByteCount } from '../../services/domain/workspaceModels';

/**
 * One formatter for every byte count in the product, so a size never reads two
 * ways on two screens. `null` means the store genuinely does not know the value;
 * it is shown as "Unknown", never as zero.
 */
export const formatBytes = (bytes: ByteCount): string => {
  if (bytes === null) return 'Unknown';
  if (bytes < 1000) return `${bytes} bytes`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(0)} KB`;
  if (bytes < 1000 * 1000 * 1000) return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
  return `${(bytes / (1000 * 1000 * 1000)).toFixed(2)} GB`;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Short, glanceable timestamp for a list row. */
export const formatTimestamp = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return 'Unknown time';
  const date = new Date(value);
  const elapsed = Date.now() - value;

  if (elapsed < MINUTE) return 'Just now';
  if (elapsed < HOUR) {
    const minutes = Math.round(elapsed / MINUTE);
    return `${minutes} min ago`;
  }
  if (elapsed < DAY) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (elapsed < 7 * DAY) {
    return date.toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/** Full timestamp for assistive technology and the detail sheet. */
export const formatTimestampLong = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return 'Unknown time';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

/**
 * Splits a filename so a long name can wrap on the stem while the extension
 * stays attached and readable. Long names wrap; they are never cut off.
 */
export const splitFilename = (name: string): { stem: string; extension: string } => {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return { stem: name, extension: '' };
  return { stem: name.slice(0, dot), extension: name.slice(dot) };
};
