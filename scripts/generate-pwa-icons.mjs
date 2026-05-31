// PWA アイコン生成スクリプト (依存なし)。
// Topos のブランド (アクセント #2f7d79 / 背景 #f5f3ee) に合わせ、
// マスカブル対応の単色背景 + 中央の "重力点" を描いた PNG を出力する。
//
// 使い方: node scripts/generate-pwa-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
mkdirSync(publicDir, { recursive: true });

const ACCENT = [47, 125, 121]; // #2f7d79
const CREAM = [245, 243, 238]; // #f5f3ee

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// size: 画像ピクセル数, maskable: true なら安全領域を考慮して点を小さめにする。
function renderPng(size, maskable) {
  const cx = size / 2;
  const cy = size / 2;
  // マスカブルは外側 10% がトリミングされ得るため、点を内側に収める。
  const dotRadius = size * (maskable ? 0.26 : 0.32);

  // RGBA ピクセル + 各行先頭のフィルタバイト (0)。
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // アンチエイリアス用に 1px のソフトエッジ。
      const t = Math.max(0, Math.min(1, dotRadius + 0.5 - dist));
      const r = Math.round(ACCENT[0] * (1 - t) + CREAM[0] * t);
      const g = Math.round(ACCENT[1] * (1 - t) + CREAM[1] * t);
      const b = Math.round(ACCENT[2] * (1 - t) + CREAM[2] * t);
      const off = y * (stride + 1) + 1 + x * 4;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = 255;
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const targets = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-512-maskable.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: false },
];

for (const t of targets) {
  const png = renderPng(t.size, t.maskable);
  writeFileSync(join(publicDir, t.file), png);
  console.log(`generated public/${t.file} (${png.length} bytes)`);
}
