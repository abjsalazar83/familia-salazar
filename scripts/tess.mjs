// Copia o motor OCR (Tesseract.js) e o idioma «por» para public/tess — servidos pela própria app, sem CDN.
import { mkdirSync, copyFileSync } from 'node:fs';
const o = 'public/tess/'; mkdirSync(o, { recursive: true });
const c = 'node_modules/tesseract.js-core/';
copyFileSync('node_modules/tesseract.js/dist/worker.min.js', o + 'worker.min.js');
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js']) copyFileSync(c + f, o + f);
copyFileSync('node_modules/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz', o + 'por.traineddata.gz');
