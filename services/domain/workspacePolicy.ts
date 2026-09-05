import type { ByteCount, DurableDocumentRef } from './workspaceModels.ts';

const OPAQUE_REFERENCE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export const toDurableDocumentRef = (value: string): DurableDocumentRef | null => {
  const candidate = value.trim();
  if (!OPAQUE_REFERENCE_TOKEN.test(candidate)) {
    return null;
  }
  return candidate as DurableDocumentRef;
};

export const normalizeByteCount = (value: unknown): ByteCount => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
};

export const calculateSpaceSaved = (input: ByteCount, output: ByteCount): ByteCount => {
  if (input === null || output === null) return null;
  return Math.max(0, input - output);
};

export const totalKnownSpaceSaved = (values: readonly ByteCount[]): number =>
  values.reduce<number>((total, value) => total + (value ?? 0), 0);
