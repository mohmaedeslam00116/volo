// Extract the three canvases from the screenshot and write standalone PNGs.
// Dependency-free: inflate (zlib) + manual unfilter + minimal PNG encoder.
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const buf = readFileSync(".tmp-raster.png");
let pos = 8;
let width = 0, height = 0, channels = 0;
const idat = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString("ascii", pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + len);
  if (type === "IHDR") {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 1;
  } else if (type === "IDAT") idat.push(data);
  pos += 12 + len;
  if (type === "IEND") break;
}
const raw = inflateSync(Buffer.concat(idat));
const stride = width * channels;

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

const lines = [];
let offset = 0;
let prev = Buffer.alloc(stride);
for (let y = 0; y < height; y++) {
  const filter = raw[offset++];
  const line = Buffer.from(raw.subarray(offset, offset + stride));
  offset += stride;
  for (let x = 0; x < stride; x++) {
    const a = x >= channels ? line[x - channels] : 0;
    const b = prev[x];
    const c = x >= channels ? prev[x - channels] : 0;
    if (filter === 1) line[x] = (line[x] + a) & 0xff;
    else if (filter === 2) line[x] = (line[x] + b) & 0xff;
    else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 0xff;
    else if (filter === 4) line[x] = (line[x] + paeth(a, b, c)) & 0xff;
  }
  lines.push(line);
  prev = line;
}

// --- CRC32 for PNG chunks ---
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(bufv) {
  let c = 0xffffffff;
  for (const byte of bufv) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function writePng(px, py, size, out) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const rows = [];
  for (let y = 0; y < size; y++) {
    const line = Buffer.alloc(size * 3);
    const src = lines[py + y];
    for (let x = 0; x < size; x++) {
      line[x * 3] = src[(px + x) * channels];
      line[x * 3 + 1] = src[(px + x) * channels + 1];
      line[x * 3 + 2] = src[(px + x) * channels + 2];
    }
    rows.push(Buffer.concat([Buffer.from([0]), line])); // filter 0
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(out, png);
  console.log(out, size + "x" + size, png.length, "bytes");
}

// Canvas layout: absolute-positioned side by side from (0,0) in a 1792x1024 body.
writePng(0, 0, 1024, ".tmp-icon-1024.png");
writePng(1024, 0, 512, ".tmp-icon-512.png");
writePng(1536, 0, 256, ".tmp-icon-256.png");
