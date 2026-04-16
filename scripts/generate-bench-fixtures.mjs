import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'benchmarks', 'fixtures');

const TEXT_FIXTURE_NAME = 'text-80-pages.pdf';
const IMAGE_FIXTURE_NAME = 'image-12-pages.pdf';

function createPngBytes(size = 1200) {
  const pixelCount = size * size;
  const bytesPerPixel = 4;
  const raw = Buffer.alloc(pixelCount * bytesPerPixel);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * bytesPerPixel;
      raw[offset] = Math.round((x / size) * 255);
      raw[offset + 1] = Math.round((y / size) * 255);
      raw[offset + 2] = Math.round((((x + y) / (size * 2)) * 255));
      raw[offset + 3] = 255;
    }
  }

  const chunks = [];
  const compressed = deflateSync(rawToScanlines(raw, size));

  chunks.push(pngChunk('IHDR', Buffer.from([
    (size >>> 24) & 255,
    (size >>> 16) & 255,
    (size >>> 8) & 255,
    size & 255,
    (size >>> 24) & 255,
    (size >>> 16) & 255,
    (size >>> 8) & 255,
    size & 255,
    8,
    6,
    0,
    0,
    0,
  ])));
  chunks.push(pngChunk('IDAT', compressed));
  chunks.push(pngChunk('IEND', Buffer.alloc(0)));

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, ...chunks]);
}

function rawToScanlines(raw, size) {
  const stride = size * 4;
  const out = Buffer.alloc((stride + 1) * size);

  for (let y = 0; y < size; y += 1) {
    const outOffset = y * (stride + 1);
    out[outOffset] = 0;
    raw.copy(out, outOffset + 1, y * stride, (y + 1) * stride);
  }

  return out;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

async function createTextFixture() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  for (let pageIndex = 0; pageIndex < 80; pageIndex += 1) {
    const page = pdf.addPage([612, 792]);
    page.drawText(`Benchmark text fixture page ${pageIndex + 1}`, {
      x: 48,
      y: 744,
      font,
      size: 20,
      color: rgb(0.1, 0.12, 0.18),
    });

    for (let row = 0; row < 28; row += 1) {
      page.drawText(
        `Row ${row + 1}: The quick brown fox jumps over the lazy dog. Page ${pageIndex + 1}.`,
        {
          x: 48,
          y: 700 - row * 22,
          font,
          size: 11,
          color: rgb(0.24, 0.28, 0.36),
        },
      );
    }
  }

  return pdf.save();
}

async function createImageFixture() {
  const pdf = await PDFDocument.create();
  const pngBytes = createPngBytes();
  const image = await pdf.embedPng(pngBytes);

  for (let pageIndex = 0; pageIndex < 12; pageIndex += 1) {
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }

  return pdf.save();
}

async function ensureFixtures() {
  await fs.mkdir(outputDir, { recursive: true });

  const [textFixture, imageFixture] = await Promise.all([
    createTextFixture(),
    createImageFixture(),
  ]);

  await Promise.all([
    fs.writeFile(path.join(outputDir, TEXT_FIXTURE_NAME), textFixture),
    fs.writeFile(path.join(outputDir, IMAGE_FIXTURE_NAME), imageFixture),
  ]);

  const textStats = await fs.stat(path.join(outputDir, TEXT_FIXTURE_NAME));
  const imageStats = await fs.stat(path.join(outputDir, IMAGE_FIXTURE_NAME));

  console.log(JSON.stringify({
    outputDir,
    fixtures: [
      { file: TEXT_FIXTURE_NAME, sizeBytes: textStats.size },
      { file: IMAGE_FIXTURE_NAME, sizeBytes: imageStats.size },
    ],
  }, null, 2));
}

await ensureFixtures();
