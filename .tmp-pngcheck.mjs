// Minimal PNG sampler: verifies the headless Chrome screenshot actually
// contains the icon (dark tile + blue chevron), not a blank page.
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const buf = readFileSync(".tmp-raster.png");
let pos = 8;
let width = 0, height = 0, bitDepth = 0, colorType = 0;
const idat = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString("ascii", pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + len);
  if (type === "IHDR") {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    bitDepth = data[8];
    colorType = data[9];
  } else if (type === "IDAT") idat.push(data);
  pos += 12 + len;
  if (type === "IEND") break;
}
console.log(`PNG ${width}x${height} depth=${bitDepth} colorType=${colorType}`);
const raw = inflateSync(Buffer.concat(idat));
const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
const stride = width * channels;

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// Unfilter all rows (enough to sample arbitrary pixels).
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

function sample(px, py) {
  const line = lines[py];
  if (!line) return null;
  const r = line[px * channels], g = line[px * channels + 1], b = line[px * channels + 2];
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

// Canvas layout in the 1100x1100 window: c1024 at (0,0), c512 below, c256 below.
console.log("tile corner  (10,10)   =", sample(10, 10), "(expect ~#0c0c0e)");
console.log("chevron area (500,500) =", sample(500, 500), "(expect ~#3b82f6)");
console.log("tile mid     (700,900) =", sample(700, 900), "(expect ~#0c0c0e)");
console.log("amber bar    (650,725) =", sample(650, 725), "(expect ~#d97706)");
