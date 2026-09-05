export interface PositionedPdfTextItem {
  text: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  height: number;
  centerY: number;
  /** Viewport-space text quad vectors used for rotated or skewed runs. */
  quad?: {
    x: number;
    y: number;
    advanceX: number;
    advanceY: number;
    riseX: number;
    riseY: number;
  };
  /** Unrotated PDF page-space bounds for this exact source item. */
  sourcePdfRect?: [number, number, number, number];
}

export interface PageSelectableTextLine {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Unrotated PDF page-space bounds: left, bottom, right, top. */
  pdfRect?: [number, number, number, number];
  /** PDF.js source run metadata used to preview unchanged text after the edited word. */
  sourceRun?: {
    text: string;
    start: number;
    end: number;
    left: number;
    top: number;
    width: number;
    height: number;
    /** Upright, left-to-right text in the displayed page coordinate system. */
    isHorizontal?: boolean;
    /** Unrotated PDF page-space bounds for the complete PDF.js text item. */
    pdfRect?: [number, number, number, number];
  };
}

const horizontalRunGap = (previous: PositionedPdfTextItem, next: PositionedPdfTextItem) =>
  Math.max(12, Math.max(previous.height, next.height) * 1.5);

const splitHorizontalRuns = (items: PositionedPdfTextItem[]) => {
  const orderedItems = [...items].sort((a, b) => a.left - b.left);
  const runs: PositionedPdfTextItem[][] = [];

  orderedItems.forEach((item) => {
    const currentRun = runs[runs.length - 1];
    const previous = currentRun?.[currentRun.length - 1];
    if (!currentRun || (previous && item.left - previous.right > horizontalRunGap(previous, item))) {
      runs.push([item]);
      return;
    }
    currentRun.push(item);
  });

  return runs;
};

const toSelectableLine = (items: PositionedPdfTextItem[]): PageSelectableTextLine => {
  const left = Math.min(...items.map((item) => item.left));
  const top = Math.min(...items.map((item) => item.top));
  const right = Math.max(...items.map((item) => item.right));
  const bottom = Math.max(...items.map((item) => item.bottom));
  let text = '';
  let lastRight = items[0]?.left ?? 0;

  items.forEach((item) => {
    const gap = item.left - lastRight;
    if (text && gap > Math.max(item.height * 0.25, 3)) text += ' ';
    text += item.text;
    lastRight = Math.max(lastRight, item.right);
  });

  return {
    text: text.replace(/\s+/g, ' ').trim(),
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
};

export const groupPositionedTextItems = (
  items: PositionedPdfTextItem[],
): PageSelectableTextLine[] => {
  const lines: Array<{
    items: PositionedPdfTextItem[];
    centerY: number;
    height: number;
  }> = [];

  items.forEach((item) => {
    const currentLine = lines[lines.length - 1];
    const threshold = currentLine ? Math.max(currentLine.height, item.height) * 0.6 : 0;

    if (!currentLine || Math.abs(item.centerY - currentLine.centerY) > threshold) {
      lines.push({ items: [item], centerY: item.centerY, height: item.height });
      return;
    }

    currentLine.items.push(item);
    currentLine.centerY = (currentLine.centerY * (currentLine.items.length - 1) + item.centerY)
      / currentLine.items.length;
    currentLine.height = Math.max(currentLine.height, item.height);
  });

  return lines
    .flatMap((line) => splitHorizontalRuns(line.items).map(toSelectableLine))
    .filter((line) => line.text);
};

export const positionedTextItemsToWordTargets = (
  items: PositionedPdfTextItem[],
): PageSelectableTextLine[] => items.flatMap((item) => {
  const sourceText = item.text;
  const sourceLength = Math.max(1, sourceText.length);
  const sourceWidth = Math.max(1, item.right - item.left);
  const words = Array.from(sourceText.matchAll(/\S+/g));

  return words.map((word) => {
    const start = word.index ?? 0;
    const end = start + word[0].length;
    const startFraction = start / sourceLength;
    const endFraction = end / sourceLength;
    const wordCorners = item.quad ? [
      [
        item.quad.x + item.quad.advanceX * startFraction,
        item.quad.y + item.quad.advanceY * startFraction,
      ],
      [
        item.quad.x + item.quad.advanceX * endFraction,
        item.quad.y + item.quad.advanceY * endFraction,
      ],
      [
        item.quad.x + item.quad.advanceX * startFraction + item.quad.riseX,
        item.quad.y + item.quad.advanceY * startFraction + item.quad.riseY,
      ],
      [
        item.quad.x + item.quad.advanceX * endFraction + item.quad.riseX,
        item.quad.y + item.quad.advanceY * endFraction + item.quad.riseY,
      ],
    ] : undefined;
    const wordXValues = wordCorners?.map(([x]) => x);
    const wordYValues = wordCorners?.map(([, y]) => y);
    const left = wordXValues ? Math.min(...wordXValues) : item.left + sourceWidth * startFraction;
    const right = wordXValues ? Math.max(...wordXValues) : item.left + sourceWidth * endFraction;
    const top = wordYValues ? Math.min(...wordYValues) : item.top;
    const bottom = wordYValues ? Math.max(...wordYValues) : item.bottom;

    return {
      text: word[0],
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
      sourceRun: {
        text: sourceText,
        start,
        end,
        left: item.left,
        top: item.top,
        width: sourceWidth,
        height: Math.max(1, item.bottom - item.top),
        isHorizontal: Boolean(item.quad
          && item.quad.advanceX > 0 && item.quad.riseY < 0
          && Math.abs(item.quad.advanceY) <= Math.abs(item.quad.advanceX) * 0.0001
          && Math.abs(item.quad.riseX) <= Math.abs(item.quad.riseY) * 0.0001),
        ...(item.sourcePdfRect ? { pdfRect: item.sourcePdfRect } : {}),
      },
    };
  });
});
