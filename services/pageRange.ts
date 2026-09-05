const MAX_PAGE_RANGE_INPUT_LENGTH = 512;
const MAX_PAGE_RANGE_TOKENS = 256;

/**
 * Parses a user-entered 1-based page list without doing work outside the
 * document bounds. Validate range endpoints before expansion: malformed input
 * such as `1-999999999` must be rejected in constant time, not looped over.
 */
export const parseBoundedPageRange = (value: string, totalPages: number): number[] => {
  const normalized = value.trim();
  if (!normalized) throw new Error('Enter a page or range, for example 2,4-6.');
  if (!Number.isSafeInteger(totalPages) || totalPages < 1) {
    throw new Error('Load a PDF before entering a page range.');
  }
  if (normalized.length > MAX_PAGE_RANGE_INPUT_LENGTH) {
    throw new Error('That page range is too long. Use fewer page groups.');
  }

  const tokens = normalized.split(',');
  if (tokens.length > MAX_PAGE_RANGE_TOKENS) {
    throw new Error('That page range has too many groups.');
  }

  const pages = new Set<number>();
  for (const rawToken of tokens) {
    const token = rawToken.trim();
    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    const singleMatch = token.match(/^\d+$/);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
        throw new Error(`“${token}” is not a safe page range.`);
      }
      if (start > end) throw new Error(`Page range ${token} must run from low to high.`);
      if (start < 1 || end > totalPages) {
        const invalid = start < 1 ? start : end;
        throw new Error(`Page ${invalid} is outside this PDF (1-${totalPages}).`);
      }
      for (let page = start; page <= end; page += 1) pages.add(page - 1);
      continue;
    }

    if (singleMatch) {
      const page = Number(token);
      if (!Number.isSafeInteger(page) || page < 1 || page > totalPages) {
        throw new Error(`Page ${token} is outside this PDF (1-${totalPages}).`);
      }
      pages.add(page - 1);
      continue;
    }

    throw new Error(`“${token || rawToken}” is not a valid page or range.`);
  }

  return [...pages].sort((left, right) => left - right);
};
