// Gera os ícones PNG sem dependências (geometria simples: quadrados sobre fundo escuro).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(size, pad) {
  const bg = [15, 17, 21], acc = [122, 162, 247], dim = [42, 47, 58], ok = [158, 206, 106];
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const inner = size * (1 - 2 * pad), o = size * pad, cell = inner / 2, gap = inner * 0.06;
  for (let y = 0; y < size; y++) { raw[y * (size * 3 + 1)] = 0; for (let x = 0; x < size; x++) {
    let col = bg; const rx = x - o, ry = y - o;
    if (rx >= 0 && ry >= 0 && rx < inner && ry < inner) {
      const cx = Math.floor(rx / cell), cy = Math.floor(ry / cell), lx = rx - cx * cell, ly = ry - cy * cell;
      if (lx > gap / 2 && ly > gap / 2 && lx < cell - gap / 2 && ly < cell - gap / 2) col = cx === cy ? acc : cx === 1 ? ok : dim;
    }
    raw.set(col, y * (size * 3 + 1) + 1 + x * 3);
  } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(size, 0); ih.writeUInt32BE(size, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
mkdirSync('public', { recursive: true });
writeFileSync('public/icon-180.png', png(180, 0.18));
writeFileSync('public/icon-192.png', png(192, 0.18));
writeFileSync('public/icon-512.png', png(512, 0.18));
writeFileSync('public/icon-maskable-512.png', png(512, 0.28));
console.log('ícones gerados');
