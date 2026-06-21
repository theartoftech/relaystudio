import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const outPath = resolve("src-tauri/icons/icon.png");
const size = 256;
const bytesPerPixel = 4;
const stride = size * bytesPerPixel;
const raw = Buffer.alloc((stride + 1) * size);

function writePixel(row, x, r, g, b, a = 255) {
  const offset = row * (stride + 1) + 1 + x * bytesPerPixel;
  raw[offset] = r;
  raw[offset + 1] = g;
  raw[offset + 2] = b;
  raw[offset + 3] = a;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function drawBackground() {
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < size; x += 1) {
      const mix = Math.round((x / size) * 24 + (y / size) * 18);
      writePixel(y, x, 7, 27 + mix, 51 + mix);
    }
  }
}

function fillRect(x0, y0, width, height, color) {
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        writePixel(y, x, ...color);
      }
    }
  }
}

function drawLogo() {
  const white = [245, 249, 255, 255];
  const blue = [23, 111, 223, 255];
  const silver = [196, 208, 220, 255];

  fillRect(47, 58, 24, 132, white);
  fillRect(47, 58, 76, 24, white);
  fillRect(47, 110, 68, 22, white);
  fillRect(103, 78, 24, 32, white);
  fillRect(104, 132, 30, 58, white);

  fillRect(151, 58, 60, 24, white);
  fillRect(151, 58, 24, 66, white);
  fillRect(151, 111, 60, 24, white);
  fillRect(187, 111, 24, 79, white);
  fillRect(151, 166, 60, 24, white);

  fillRect(197, 58, 10, 132, silver);
  fillRect(211, 42, 12, 55, blue);
  fillRect(199, 88, 35, 12, blue);
  fillRect(198, 96, 12, 58, blue);
}

drawBackground();
drawLogo();

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0))
]);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, png);
console.log(outPath);
