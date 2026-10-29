import { describe, it, expect } from 'vitest';
import { fitOcr, progressText, receiptErrorText } from './ocr';
import { parseReceipt, parseTotal } from './receipt';
describe('fitOcr', () => {
  it('foto de 50 MP fica pequena', () => { const r = fitOcr(6120, 8160); expect(r.w).toBeLessThanOrEqual(1400); expect(r.h).toBeLessThanOrEqual(3200); });
  it('talão comprido limitado em altura', () => expect(fitOcr(1400, 6400)).toEqual({ w: 700, h: 3200 }));
  it('não amplia', () => expect(fitOcr(800, 1000)).toEqual({ w: 800, h: 1000 }));
});
describe('mensagens', () => {
  it('progresso', () => { expect(progressText('recognizing text', 0.42)).toBe('a ler o talão… 42%'); expect(progressText('loading language traineddata', 1)).toMatch(/dicionário/); });
  it('erros em PT', () => { expect(receiptErrorText(new Error('RuntimeError: Aborted(OOM)'))).toMatch(/memória/); expect(receiptErrorText(new TypeError('Failed to fetch'))).toMatch(/internet/); });
});
describe('parse com OCR imperfeito', () => {
  it('T0TAL com zero', () => expect(parseTotal('PAO 1,35\nT0TAL 12,72')).toBe(1272));
  it('sem TOTAL: valor repetido (total + multibanco)', () => expect(parseTotal('LEITE 0,89\nFRANG0 6,49\nXXXX 12,72\nMULTIBANCO 12,72')).toBe(1272));
  it('sem TOTAL nem repetição: null', () => expect(parseTotal('LEITE 0,89\nPAO 1,35')).toBeNull());
  it('texto real do teste headless', () => expect(parseReceipt('MERCADONA, S.A.\n\nNIF A46103834\n\nData 12/10/2026 18:32\nLEITE MAGRO 0,89\nTOTAL (EUR) 12,72\nMULTIBANCO 12,72\n', new Date('2026-10-29'))).toEqual({ store: 'Mercadona', category: 'Supermercado', date: '2026-10-12', total: 1272 }));
});
