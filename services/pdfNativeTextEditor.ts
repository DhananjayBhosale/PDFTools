import { init, type WrappedPdfiumModule } from '@embedpdf/pdfium';
import pdfiumWasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';
import { boundsFitWithinCropBox, PDF_TEXT_OVERFLOW_MESSAGE } from './pdfTextEditSafety';
import {
  planNativePdfTextEdits,
  resolveNativePdfTextTarget,
  type NativePdfTextTarget,
  type NativePdfTextAppearance,
  type PdfSpaceRect,
  type PdfTextCharacterSnapshot,
  type PdfTextObjectSnapshot,
  type PlannedNativePdfTextEdit,
} from './pdfNativeTextPlanning';

const PDF_PAGE_OBJECT_TEXT = 1;
const PDF_TEXT_RENDER_MODE_INVISIBLE = 3;
const MAX_NATIVE_TEXT_FILE_BYTES = 64 * 1024 * 1024;
const MAX_FIRST_INSPECTION_MS = 400;
const SERIALIZED_BOUNDS_TOLERANCE_POINTS = 0.05;

type PdfiumHeap = WrappedPdfiumModule['pdfium'] & {
  HEAPU8: Uint8Array;
};

type PdfiumEngine = WrappedPdfiumModule & { pdfium: PdfiumHeap };

export interface NativePdfTextEdit extends NativePdfTextTarget {
  pageIndex: number;
  replacementText: string;
}

export interface PdfTextRunPlacement {
  pageIndex: number;
  text: string;
  x: number;
  y: number;
}

export interface NativePdfTextCapability {
  supported: boolean;
  reason?: string;
  match?: {
    pdfRect: PdfSpaceRect;
    sourceRun: {
      text: string;
      start: number;
      end: number;
      pdfRect: PdfSpaceRect;
    };
    appearance?: NativePdfTextAppearance;
  };
}

interface CachedInspectionDocument {
  engine: PdfiumEngine;
  inputPointer: number;
  document: number;
}

interface PageObjectState {
  objectIndex: number;
  type: number;
  bounds?: PdfSpaceRect;
  text?: string;
  fontSize?: number;
  matrix?: [number, number, number, number, number, number];
  fillColor?: [number, number, number, number];
  characters?: PdfTextCharacterSnapshot[];
}

interface SerializedPageExpectation {
  pageIndex: number;
  originalObjects: PageObjectState[];
  changes: Array<{
    objectIndex: number;
    replacementText: string;
    stablePrefixLength: number;
    originalStableSuffixStart: number;
    replacementStableSuffixStart: number;
  }>;
}

let enginePromise: Promise<PdfiumEngine> | null = null;
let operationChain: Promise<unknown> = Promise.resolve();
const inspectionDocuments = new WeakMap<File, CachedInspectionDocument>();
const inspectionDisabledReasons = new WeakMap<File, string>();

const loadEngine = () => {
  enginePromise ??= (async () => {
    const response = await fetch(pdfiumWasmUrl);
    if (!response.ok) throw new Error('The local PDF text engine could not be loaded.');
    const wasmBinary = await response.arrayBuffer();
    const engine = await init({ wasmBinary }) as PdfiumEngine;
    engine.PDFiumExt_Init();
    return engine;
  })().catch((error) => {
    enginePromise = null;
    throw error;
  });
  return enginePromise;
};

const serializePdfiumOperation = <T>(operation: () => Promise<T>): Promise<T> => {
  const run = operationChain.then(operation, operation);
  operationChain = run.catch(() => undefined);
  return run;
};

const malloc = (engine: PdfiumEngine, size: number) => engine.pdfium.wasmExports.malloc(size);
const free = (engine: PdfiumEngine, pointer: number) => engine.pdfium.wasmExports.free(pointer);

const readFloat32 = (engine: PdfiumEngine, pointer: number) => (
  new DataView(engine.pdfium.HEAPU8.buffer).getFloat32(pointer, true)
);

const readFloat64 = (engine: PdfiumEngine, pointer: number) => (
  new DataView(engine.pdfium.HEAPU8.buffer).getFloat64(pointer, true)
);

const readUint32 = (engine: PdfiumEngine, pointer: number) => (
  new DataView(engine.pdfium.HEAPU8.buffer).getUint32(pointer, true)
);

const readUtf8 = (engine: PdfiumEngine, pointer: number, byteLength: number) => (
  new TextDecoder().decode(engine.pdfium.HEAPU8.slice(pointer, pointer + Math.max(0, byteLength - 1)))
);

const utf16Pointer = (engine: PdfiumEngine, text: string) => {
  const pointer = malloc(engine, (text.length + 1) * 2);
  const view = new DataView(engine.pdfium.HEAPU8.buffer);
  for (let index = 0; index < text.length; index += 1) {
    view.setUint16(pointer + index * 2, text.charCodeAt(index), true);
  }
  view.setUint16(pointer + text.length * 2, 0, true);
  return pointer;
};

const readTextObject = (
  engine: PdfiumEngine,
  object: number,
  textPage: number,
) => {
  const byteLength = engine.FPDFTextObj_GetText(object, textPage, 0, 0);
  if (byteLength <= 2) return '';
  const pointer = malloc(engine, byteLength);
  try {
    engine.FPDFTextObj_GetText(object, textPage, pointer, byteLength);
    return new TextDecoder('utf-16le').decode(
      engine.pdfium.HEAPU8.slice(pointer, pointer + byteLength - 2),
    );
  } finally {
    free(engine, pointer);
  }
};

const readObjectBounds = (engine: PdfiumEngine, object: number): PdfSpaceRect | undefined => {
  const pointers = [
    malloc(engine, 4),
    malloc(engine, 4),
    malloc(engine, 4),
    malloc(engine, 4),
  ] as [number, number, number, number];
  const [leftPointer, bottomPointer, rightPointer, topPointer] = pointers;
  try {
    if (!engine.FPDFPageObj_GetBounds(
      object,
      leftPointer,
      bottomPointer,
      rightPointer,
      topPointer,
    )) return undefined;
    return [
      readFloat32(engine, leftPointer),
      readFloat32(engine, bottomPointer),
      readFloat32(engine, rightPointer),
      readFloat32(engine, topPointer),
    ];
  } finally {
    pointers.forEach((pointer) => free(engine, pointer));
  }
};

const readEffectiveCropBox = (engine: PdfiumEngine, page: number): PdfSpaceRect => {
  const rectPointer = malloc(engine, 16);
  try {
    // PDFium intersects inherited MediaBox/CropBox values in unrotated PDF
    // coordinates, the same space used by its saved object/character bounds.
    if (!engine.FPDF_GetPageBoundingBox(page, rectPointer)) {
      throw new Error('Direct text edit failed: the saved page bounds could not be verified.');
    }
    // FS_RECTF is stored as left, top, right, bottom.
    return [
      readFloat32(engine, rectPointer),
      readFloat32(engine, rectPointer + 12),
      readFloat32(engine, rectPointer + 8),
      readFloat32(engine, rectPointer + 4),
    ];
  } finally {
    free(engine, rectPointer);
  }
};

const readTextObjectFontSize = (engine: PdfiumEngine, object: number) => {
  const sizePointer = malloc(engine, 4);
  try {
    return engine.FPDFTextObj_GetFontSize(object, sizePointer)
      ? readFloat32(engine, sizePointer)
      : undefined;
  } finally {
    free(engine, sizePointer);
  }
};

const readObjectMatrix = (
  engine: PdfiumEngine,
  object: number,
): [number, number, number, number, number, number] | undefined => {
  const matrixPointer = malloc(engine, 24);
  try {
    if (!engine.FPDFPageObj_GetMatrix(object, matrixPointer)) return undefined;
    return Array.from({ length: 6 }, (_, index) => (
      readFloat32(engine, matrixPointer + index * 4)
    )) as [number, number, number, number, number, number];
  } finally {
    free(engine, matrixPointer);
  }
};

const readObjectFillColor = (
  engine: PdfiumEngine,
  object: number,
): [number, number, number, number] | undefined => {
  const pointers = [
    malloc(engine, 4),
    malloc(engine, 4),
    malloc(engine, 4),
    malloc(engine, 4),
  ] as [number, number, number, number];
  try {
    return engine.FPDFPageObj_GetFillColor(object, ...pointers)
      ? pointers.map((pointer) => readUint32(engine, pointer)) as [number, number, number, number]
      : undefined;
  } finally {
    pointers.forEach((pointer) => free(engine, pointer));
  }
};

const classifyFontFamily = (name: string, flags: number): NativePdfTextAppearance['fontFamily'] => {
  const normalized = name.replace(/^[A-Z]{6}\+/, '').toLowerCase();
  if ((flags & 1) !== 0 || /courier|mono|typewriter/.test(normalized)) return 'Courier';
  if ((flags & 2) !== 0 || /times|serif|minion|garamond|georgia|cambria|palatino/.test(normalized)) {
    return 'TimesRoman';
  }
  return 'Helvetica';
};

const readFontName = (engine: PdfiumEngine, font: number) => {
  const byteLength = engine.FPDFFont_GetBaseFontName(font, 0, 0);
  if (byteLength <= 1) return '';
  const pointer = malloc(engine, byteLength);
  try {
    const written = engine.FPDFFont_GetBaseFontName(font, pointer, byteLength);
    return written > 1 ? readUtf8(engine, pointer, written) : '';
  } finally {
    free(engine, pointer);
  }
};

const readEffectiveTextSize = (engine: PdfiumEngine, object: number) => {
  const fontSize = readTextObjectFontSize(engine, object);
  if (!fontSize) return undefined;
  const matrix = readObjectMatrix(engine, object);
  if (!matrix) return fontSize;
  const verticalScale = Math.hypot(matrix[2], matrix[3]);
  return fontSize * (Number.isFinite(verticalScale) && verticalScale > 0 ? verticalScale : 1);
};

const readTextAppearance = (
  engine: PdfiumEngine,
  object: number,
): NativePdfTextAppearance | undefined => {
  const font = engine.FPDFTextObj_GetFont(object);
  const fontSize = readEffectiveTextSize(engine, object);
  if (!font || !fontSize) return undefined;
  const colorPointers = [malloc(engine, 4), malloc(engine, 4), malloc(engine, 4), malloc(engine, 4)];
  const [redPointer, greenPointer, bluePointer, alphaPointer] = colorPointers;
  try {
    const flags = engine.FPDFFont_GetFlags(font);
    const fontName = readFontName(engine, font);
    const hasColor = engine.FPDFPageObj_GetFillColor(object, redPointer, greenPointer, bluePointer, alphaPointer);
    const color = hasColor
      ? `#${[redPointer, greenPointer, bluePointer]
        .map((pointer) => Math.min(255, readUint32(engine, pointer)).toString(16).padStart(2, '0'))
        .join('')}`
      : '#000000';
    const weight = engine.FPDFFont_GetWeight(font);
    return {
      fontFamily: classifyFontFamily(fontName, flags),
      fontSize,
      color,
      fontWeight: Number.isFinite(weight) && weight > 0 ? Math.max(100, Math.min(900, weight)) : 400,
      fontStyle: (flags & 64) !== 0 || /italic|oblique/i.test(fontName) ? 'italic' : 'normal',
    };
  } finally {
    colorPointers.forEach((pointer) => free(engine, pointer));
  }
};

const collectTextObjects = (
  engine: PdfiumEngine,
  page: number,
  textPage: number,
): PdfTextObjectSnapshot[] => {
  const boundPointers = [malloc(engine, 4), malloc(engine, 4), malloc(engine, 4), malloc(engine, 4)];
  const [leftPointer, bottomPointer, rightPointer, topPointer] = boundPointers;
  const charPointers = [malloc(engine, 8), malloc(engine, 8), malloc(engine, 8), malloc(engine, 8)];
  const [charLeftPointer, charRightPointer, charBottomPointer, charTopPointer] = charPointers;
  const objects: PdfTextObjectSnapshot[] = [];
  const objectByPointer = new Map<number, PdfTextObjectSnapshot>();
  const rawCharactersByObject = new Map<number, Array<{
    pageCharacterIndex: number;
    text: string;
    bounds: PdfSpaceRect;
  }>>();

  try {
    const count = engine.FPDFPage_CountObjects(page);
    for (let objectIndex = 0; objectIndex < count; objectIndex += 1) {
      const object = engine.FPDFPage_GetObject(page, objectIndex);
      if (!object || engine.FPDFPageObj_GetType(object) !== PDF_PAGE_OBJECT_TEXT) continue;
      if (engine.FPDFTextObj_GetTextRenderMode(object) === PDF_TEXT_RENDER_MODE_INVISIBLE) continue;
      if (!engine.FPDFPageObj_GetBounds(
        object,
        leftPointer,
        bottomPointer,
        rightPointer,
        topPointer,
      )) continue;

      const snapshot: PdfTextObjectSnapshot = {
        objectIndex,
        text: readTextObject(engine, object, textPage),
        bounds: [
          readFloat32(engine, leftPointer),
          readFloat32(engine, bottomPointer),
          readFloat32(engine, rightPointer),
          readFloat32(engine, topPointer),
        ],
        characters: [],
      };
      objects.push(snapshot);
      objectByPointer.set(object, snapshot);
    }

    const characterCount = engine.FPDFText_CountChars(textPage);
    for (let pageCharacterIndex = 0; pageCharacterIndex < characterCount; pageCharacterIndex += 1) {
      if (engine.FPDFText_IsGenerated(textPage, pageCharacterIndex) === 1) continue;
      const object = engine.FPDFText_GetTextObject(textPage, pageCharacterIndex);
      const snapshot = objectByPointer.get(object);
      if (!snapshot) continue;
      const unicode = engine.FPDFText_GetUnicode(textPage, pageCharacterIndex);
      if (unicode <= 0 || unicode > 0x10ffff) continue;
      if (!engine.FPDFText_GetCharBox(
        textPage,
        pageCharacterIndex,
        charLeftPointer,
        charRightPointer,
        charBottomPointer,
        charTopPointer,
      )) continue;
      const rawCharacters = rawCharactersByObject.get(object) ?? [];
      rawCharacters.push({
        pageCharacterIndex,
        text: String.fromCodePoint(unicode),
        bounds: [
          readFloat64(engine, charLeftPointer),
          readFloat64(engine, charBottomPointer),
          readFloat64(engine, charRightPointer),
          readFloat64(engine, charTopPointer),
        ],
      });
      rawCharactersByObject.set(object, rawCharacters);
    }

    for (const [object, snapshot] of objectByPointer) {
      let searchFrom = 0;
      const alignedCharacters: PdfTextCharacterSnapshot[] = [];
      for (const character of rawCharactersByObject.get(object) ?? []) {
        const start = snapshot.text.indexOf(character.text, searchFrom);
        if (start < 0) continue;
        const end = start + character.text.length;
        alignedCharacters.push({ ...character, start, end });
        searchFrom = end;
      }
      snapshot.characters = alignedCharacters;
    }
  } finally {
    [...boundPointers, ...charPointers].forEach((pointer) => free(engine, pointer));
  }

  return objects;
};

const withDocument = async <T>(
  engine: PdfiumEngine,
  bytes: Uint8Array,
  operation: (document: number) => Promise<T> | T,
) => {
  const inputPointer = malloc(engine, bytes.byteLength);
  engine.pdfium.HEAPU8.set(bytes, inputPointer);
  const document = engine.FPDF_LoadMemDocument64(inputPointer, bytes.byteLength, '');
  if (!document) {
    free(engine, inputPointer);
    throw new Error('PDFium could not open this document for direct text editing.');
  }

  try {
    return await operation(document);
  } finally {
    engine.FPDF_CloseDocument(document);
    free(engine, inputPointer);
  }
};

const saveDocument = (engine: PdfiumEngine, document: number) => {
  const writer = engine.PDFiumExt_OpenFileWriter();
  if (!writer) throw new Error('PDFium could not create an output writer.');

  try {
    if (!engine.PDFiumExt_SaveAsCopy(document, writer)) {
      throw new Error('PDFium could not save the direct text edit.');
    }
    const size = engine.PDFiumExt_GetFileWriterSize(writer);
    if (size <= 0) throw new Error('PDFium produced an empty document.');
    const outputPointer = malloc(engine, size);
    try {
      if (!engine.PDFiumExt_GetFileWriterData(writer, outputPointer, size)) {
        throw new Error('PDFium could not read the edited document.');
      }
      return engine.pdfium.HEAPU8.slice(outputPointer, outputPointer + size);
    } finally {
      free(engine, outputPointer);
    }
  } finally {
    engine.PDFiumExt_CloseFileWriter(writer);
  }
};

const pageExists = (engine: PdfiumEngine, document: number, pageIndex: number) => (
  Number.isInteger(pageIndex) && pageIndex >= 0 && pageIndex < engine.FPDF_GetPageCount(document)
);

const closeInspectionDocument = (file: File) => {
  const cached = inspectionDocuments.get(file);
  if (!cached) return;
  cached.engine.FPDF_CloseDocument(cached.document);
  free(cached.engine, cached.inputPointer);
  inspectionDocuments.delete(file);
};

const openInspectionDocument = async (engine: PdfiumEngine, file: File) => {
  const cached = inspectionDocuments.get(file);
  if (cached) return cached;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const inputPointer = malloc(engine, bytes.byteLength);
  engine.pdfium.HEAPU8.set(bytes, inputPointer);
  const document = engine.FPDF_LoadMemDocument64(inputPointer, bytes.byteLength, '');
  if (!document) {
    free(engine, inputPointer);
    throw new Error('PDFium could not open this document for direct text editing.');
  }
  const opened = { engine, inputPointer, document };
  inspectionDocuments.set(file, opened);
  return opened;
};

export const releaseNativePdfTextDocument = (file: File): Promise<void> => (
  serializePdfiumOperation(async () => {
    closeInspectionDocument(file);
    inspectionDisabledReasons.delete(file);
  })
);

const inspectTarget = (
  engine: PdfiumEngine,
  document: number,
  pageIndex: number,
  target: NativePdfTextTarget,
) => {
  if (!pageExists(engine, document, pageIndex)) {
    return { supported: false as const, reason: 'The selected PDF page does not exist.' };
  }
  const page = engine.FPDF_LoadPage(document, pageIndex);
  if (!page) return { supported: false as const, reason: 'The selected PDF page could not be opened.' };
  const textPage = engine.FPDFText_LoadPage(page);
  if (!textPage) {
    engine.FPDF_ClosePage(page);
    return { supported: false as const, reason: 'The selected page has no editable PDF text layer.' };
  }

  try {
    const result = resolveNativePdfTextTarget(collectTextObjects(engine, page, textPage), target);
    if (result.supported) {
      const object = engine.FPDFPage_GetObject(page, result.target.objectIndex);
      result.target.appearance = object ? readTextAppearance(engine, object) : undefined;
    }
    return result;
  } finally {
    engine.FPDFText_ClosePage(textPage);
    engine.FPDF_ClosePage(page);
  }
};

export const inspectNativePdfTextTarget = async (
  file: File,
  pageIndex: number,
  target: NativePdfTextTarget,
): Promise<NativePdfTextCapability> => serializePdfiumOperation(async () => {
  try {
    if (file.size > MAX_NATIVE_TEXT_FILE_BYTES) {
      return {
        supported: false,
        reason: 'Direct text editing is limited to PDFs up to 64 MB to protect this device. Visual fallback is available.',
      };
    }
    const disabledReason = inspectionDisabledReasons.get(file);
    if (disabledReason) return { supported: false, reason: disabledReason };
    const engine = await loadEngine();
    const cached = await openInspectionDocument(engine, file);
    const startedAt = performance.now();
    const result = inspectTarget(engine, cached.document, pageIndex, target);
    const elapsedMs = performance.now() - startedAt;
    if (elapsedMs > MAX_FIRST_INSPECTION_MS) {
      const reason = 'Direct text analysis is too slow for this PDF on this device. Visual fallback is available.';
      closeInspectionDocument(file);
      inspectionDisabledReasons.set(file, reason);
      return { supported: false, reason };
    }
    if ('reason' in result) return { supported: false, reason: result.reason };
    return {
      supported: true,
      match: {
        pdfRect: result.target.pdfRect,
        sourceRun: {
          text: result.target.objectText,
          start: result.target.start,
          end: result.target.end,
          pdfRect: result.target.objectPdfRect,
        },
        appearance: result.target.appearance,
      },
    };
  } catch (error) {
    return {
      supported: false,
      reason: error instanceof Error ? error.message : 'Direct text editing is unavailable for this word.',
    };
  }
});

const collectPageObjectStates = (
  engine: PdfiumEngine,
  page: number,
  textPage: number,
): PageObjectState[] => {
  const states: PageObjectState[] = [];
  const textSnapshots = new Map(
    collectTextObjects(engine, page, textPage).map((snapshot) => [snapshot.objectIndex, snapshot]),
  );
  const count = engine.FPDFPage_CountObjects(page);
  for (let objectIndex = 0; objectIndex < count; objectIndex += 1) {
    const object = engine.FPDFPage_GetObject(page, objectIndex);
    if (!object) continue;
    const type = engine.FPDFPageObj_GetType(object);
    states.push({
      objectIndex,
      type,
      bounds: readObjectBounds(engine, object),
      text: type === PDF_PAGE_OBJECT_TEXT ? readTextObject(engine, object, textPage) : undefined,
      fontSize: type === PDF_PAGE_OBJECT_TEXT ? readTextObjectFontSize(engine, object) : undefined,
      matrix: readObjectMatrix(engine, object),
      fillColor: readObjectFillColor(engine, object),
      characters: textSnapshots.get(objectIndex)?.characters,
    });
  }
  return states;
};

const closeEnough = (first: number, second: number) => (
  Math.abs(first - second) <= SERIALIZED_BOUNDS_TOLERANCE_POINTS
);

const verifyTextObjectFitsPage = (
  object: Pick<PageObjectState, 'bounds' | 'characters'>,
  cropBox: PdfSpaceRect,
) => {
  if (
    !object.bounds
    || !boundsFitWithinCropBox(object.bounds, cropBox)
    || object.characters?.some((character) => (
      character.text.trim() && !boundsFitWithinCropBox(character.bounds, cropBox)
    ))
  ) {
    throw new Error(PDF_TEXT_OVERFLOW_MESSAGE);
  }
};

/** Verify actual serialized ink, including standard-font overhang and advances. */
export const verifyPdfTextRunsFitWithinPage = async (
  output: Uint8Array,
  runs: PdfTextRunPlacement[],
): Promise<void> => {
  const visibleRuns = runs.filter((run) => run.text.trim());
  if (visibleRuns.length === 0) return;

  return serializePdfiumOperation(async () => {
    const engine = await loadEngine();
    await withDocument(engine, output, (document) => {
      const runsByPage = new Map<number, PdfTextRunPlacement[]>();
      for (const run of visibleRuns) {
        const pageRuns = runsByPage.get(run.pageIndex) ?? [];
        pageRuns.push(run);
        runsByPage.set(run.pageIndex, pageRuns);
      }
      for (const [pageIndex, pageRuns] of runsByPage) {
        const verificationError = 'Visual fallback failed: the saved replacement text could not be verified.';
        if (!pageExists(engine, document, pageIndex)) throw new Error(verificationError);
        const page = engine.FPDF_LoadPage(document, pageIndex);
        if (!page) throw new Error(verificationError);
        const textPage = engine.FPDFText_LoadPage(page);
        if (!textPage) {
          engine.FPDF_ClosePage(page);
          throw new Error(verificationError);
        }
        try {
          const cropBox = readEffectiveCropBox(engine, page);
          const objects = collectTextObjects(engine, page, textPage).map((object) => ({
            ...object,
            matrix: readObjectMatrix(engine, engine.FPDFPage_GetObject(page, object.objectIndex)),
          }));
          for (const run of pageRuns) {
            const matches = objects.filter((object) => object.matrix
              && Math.abs(object.matrix[4] - run.x) <= 0.25
              && Math.abs(object.matrix[5] - run.y) <= 0.25);
            if (!matches.some((object) => object.text === run.text)) throw new Error(verificationError);
            // PDFium suppresses extracted text for some overlapping duplicates.
            // Check every visible object at this baseline, even with empty text.
            for (const object of matches) verifyTextObjectFitsPage(object, cropBox);
          }
        } finally {
          engine.FPDFText_ClosePage(textPage);
          engine.FPDF_ClosePage(page);
        }
      }
    });
  });
};

const verifySerializedOutput = async (
  engine: PdfiumEngine,
  output: Uint8Array,
  expectations: SerializedPageExpectation[],
) => withDocument(engine, output, (document) => {
  for (const expectation of expectations) {
    if (!pageExists(engine, document, expectation.pageIndex)) {
      throw new Error('Direct text edit failed: the saved page could not be reopened.');
    }
    const page = engine.FPDF_LoadPage(document, expectation.pageIndex);
    if (!page) throw new Error('Direct text edit failed: the saved page could not be reopened.');
    const textPage = engine.FPDFText_LoadPage(page);
    if (!textPage) {
      engine.FPDF_ClosePage(page);
      throw new Error('Direct text edit failed: the saved text layer could not be reopened.');
    }

    try {
      const cropBox = readEffectiveCropBox(engine, page);
      const reopenedObjects = collectPageObjectStates(engine, page, textPage);
      if (reopenedObjects.length !== expectation.originalObjects.length) {
        throw new Error('Direct text edit failed: serialized page objects changed unexpectedly.');
      }
      const changes = new Map(expectation.changes.map((change) => [change.objectIndex, change]));
      for (const original of expectation.originalObjects) {
        const reopened = reopenedObjects.find((candidate) => candidate.objectIndex === original.objectIndex);
        if (!reopened || reopened.type !== original.type) {
          throw new Error('Direct text edit failed: a serialized page object changed unexpectedly.');
        }
        if (
          original.fontSize !== undefined
          && (reopened.fontSize === undefined || !closeEnough(original.fontSize, reopened.fontSize))
        ) {
          throw new Error('Direct text edit failed: a serialized PDF font size changed unexpectedly.');
        }
        if (
          original.matrix
          && (!reopened.matrix || original.matrix.some((value, index) => !closeEnough(value, reopened.matrix![index])))
        ) {
          throw new Error('Direct text edit failed: a serialized PDF text transform changed unexpectedly.');
        }
        if (
          original.fillColor
          && (!reopened.fillColor || original.fillColor.some((value, index) => value !== reopened.fillColor![index]))
        ) {
          throw new Error('Direct text edit failed: a serialized PDF text colour changed unexpectedly.');
        }
        const change = changes.get(original.objectIndex);
        if (change) {
          if (reopened.text !== change.replacementText) {
            throw new Error('Direct text edit failed: saved text disagreed with the requested edit.');
          }
          // Check the serialized result with its retained font and transform.
          // The full object also includes any untouched suffix pushed by the
          // replacement, even if the text extractor omits off-page characters.
          if (change.replacementText.trim()) verifyTextObjectFitsPage(reopened, cropBox);
          const stablePrefixCharacters = original.characters?.filter(
            (character) => character.end <= change.stablePrefixLength,
          ) ?? [];
          for (const character of stablePrefixCharacters) {
            const reopenedCharacter = reopened.characters?.find((candidate) => (
              candidate.start === character.start
              && candidate.end === character.end
              && candidate.text === character.text
            ));
            if (
              !reopenedCharacter
              || character.bounds.some((value, index) => !closeEnough(value, reopenedCharacter.bounds[index]))
            ) {
              throw new Error('Direct text edit failed: unedited PDF text moved during serialization.');
            }
          }
          const originalSuffixCharacters = original.characters?.filter(
            (character) => character.start >= change.originalStableSuffixStart,
          ) ?? [];
          const reopenedSuffixCharacters = reopened.characters?.filter(
            (character) => character.start >= change.replacementStableSuffixStart,
          ) ?? [];
          const suffixCharactersMatch = originalSuffixCharacters.length === reopenedSuffixCharacters.length
            && originalSuffixCharacters.every((character, index) => {
              const reopenedCharacter = reopenedSuffixCharacters[index];
              return reopenedCharacter
                && character.start - change.originalStableSuffixStart
                  === reopenedCharacter.start - change.replacementStableSuffixStart
                && character.end - change.originalStableSuffixStart
                  === reopenedCharacter.end - change.replacementStableSuffixStart
                && character.text === reopenedCharacter.text;
            });
          if (!suffixCharactersMatch) {
            throw new Error('Direct text edit failed: unedited PDF text moved during serialization.');
          }
          if (originalSuffixCharacters.length > 0) {
            const originalAnchor = originalSuffixCharacters[0].bounds;
            const reopenedAnchor = reopenedSuffixCharacters[0].bounds;
            for (let index = 0; index < originalSuffixCharacters.length; index += 1) {
              const originalBounds = originalSuffixCharacters[index].bounds;
              const reopenedBounds = reopenedSuffixCharacters[index].bounds;
              const originalRelativeBounds = [
                originalBounds[0] - originalAnchor[0],
                originalBounds[1] - originalAnchor[1],
                originalBounds[2] - originalAnchor[0],
                originalBounds[3] - originalAnchor[1],
              ];
              const reopenedRelativeBounds = [
                reopenedBounds[0] - reopenedAnchor[0],
                reopenedBounds[1] - reopenedAnchor[1],
                reopenedBounds[2] - reopenedAnchor[0],
                reopenedBounds[3] - reopenedAnchor[1],
              ];
              if (originalRelativeBounds.some((value, boundIndex) => (
                !closeEnough(value, reopenedRelativeBounds[boundIndex])
              ))) {
                throw new Error('Direct text edit failed: unedited PDF text moved during serialization.');
              }
            }
          }
          continue;
        }
        if (original.text !== reopened.text) {
          throw new Error('Direct text edit failed: unrelated PDF text changed during serialization.');
        }
        if (
          original.bounds
          && (!reopened.bounds || original.bounds.some((value, index) => !closeEnough(value, reopened.bounds![index])))
        ) {
          throw new Error('Direct text edit failed: unrelated PDF content moved during serialization.');
        }
      }
    } finally {
      engine.FPDFText_ClosePage(textPage);
      engine.FPDF_ClosePage(page);
    }
  }
});

export const applyNativePdfTextEdits = async (
  input: Uint8Array,
  edits: NativePdfTextEdit[],
): Promise<Uint8Array> => {
  if (edits.length === 0) return input;

  return serializePdfiumOperation(async () => {
    const engine = await loadEngine();
    return withDocument(engine, input, async (document) => {
      const serializedExpectations: SerializedPageExpectation[] = [];
      const editsByPage = new Map<number, NativePdfTextEdit[]>();
      edits.forEach((edit) => {
        const pageEdits = editsByPage.get(edit.pageIndex) ?? [];
        pageEdits.push(edit);
        editsByPage.set(edit.pageIndex, pageEdits);
      });

      for (const [pageIndex, pageEdits] of editsByPage) {
        if (!pageExists(engine, document, pageIndex)) {
          throw new Error(`Direct text edit failed: page ${pageIndex + 1} does not exist.`);
        }
        const page = engine.FPDF_LoadPage(document, pageIndex);
        if (!page) throw new Error(`Direct text edit failed: page ${pageIndex + 1} could not be opened.`);
        let textPage = engine.FPDFText_LoadPage(page);
        if (!textPage) {
          engine.FPDF_ClosePage(page);
          throw new Error(`Direct text edit failed: page ${pageIndex + 1} has no text layer.`);
        }

        try {
          const objects = collectTextObjects(engine, page, textPage);
          const originalObjects = collectPageObjectStates(engine, page, textPage);
          const plan = planNativePdfTextEdits(objects, pageEdits as PlannedNativePdfTextEdit[]);
          if ('reason' in plan) {
            throw new Error(`Direct text edit failed: ${plan.reason}`);
          }
          serializedExpectations.push({
            pageIndex,
            originalObjects,
            changes: plan.changes.map(({ objectIndex, originalText, replacementText }) => {
              let stablePrefixLength = 0;
              const maxPrefixLength = Math.min(originalText.length, replacementText.length);
              while (
                stablePrefixLength < maxPrefixLength
                && originalText[stablePrefixLength] === replacementText[stablePrefixLength]
              ) stablePrefixLength += 1;
              let stableSuffixLength = 0;
              const maxSuffixLength = Math.min(
                originalText.length - stablePrefixLength,
                replacementText.length - stablePrefixLength,
              );
              while (
                stableSuffixLength < maxSuffixLength
                && originalText[originalText.length - stableSuffixLength - 1]
                  === replacementText[replacementText.length - stableSuffixLength - 1]
              ) stableSuffixLength += 1;
              return {
                objectIndex,
                replacementText,
                stablePrefixLength,
                originalStableSuffixStart: originalText.length - stableSuffixLength,
                replacementStableSuffixStart: replacementText.length - stableSuffixLength,
              };
            }),
          });

          for (const change of plan.changes) {
            if (change.originalText === change.replacementText) continue;
            const object = engine.FPDFPage_GetObject(page, change.objectIndex);
            if (!object || engine.FPDFPageObj_GetType(object) !== PDF_PAGE_OBJECT_TEXT) {
              throw new Error('Direct text edit failed: the source text object changed before save.');
            }
            const textPointer = utf16Pointer(engine, change.replacementText);
            try {
              if (!engine.FPDFText_SetText(object, textPointer)) {
                throw new Error('Direct text edit failed: the original font cannot draw the replacement text.');
              }
            } finally {
              free(engine, textPointer);
            }
          }

          engine.FPDFText_ClosePage(textPage);
          textPage = 0;
          if (!engine.FPDFPage_GenerateContent(page)) {
            throw new Error(`Direct text edit failed: page ${pageIndex + 1} could not be regenerated.`);
          }

          const verificationTextPage = engine.FPDFText_LoadPage(page);
          if (!verificationTextPage) {
            throw new Error('Direct text edit failed: the saved text could not be verified.');
          }
          try {
            for (const change of plan.changes) {
              const object = engine.FPDFPage_GetObject(page, change.objectIndex);
              const verified = object
                && engine.FPDFPageObj_GetType(object) === PDF_PAGE_OBJECT_TEXT
                && readTextObject(engine, object, verificationTextPage) === change.replacementText;
              if (!verified) {
                throw new Error('Direct text edit failed: read-back verification disagreed. Use Visual fallback for this word.');
              }
            }
          } finally {
            engine.FPDFText_ClosePage(verificationTextPage);
          }
        } finally {
          if (textPage) engine.FPDFText_ClosePage(textPage);
          engine.FPDF_ClosePage(page);
        }
      }

      const output = saveDocument(engine, document);
      await verifySerializedOutput(engine, output, serializedExpectations);
      return output;
    });
  });
};
