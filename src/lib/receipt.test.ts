import { describe, it, expect } from 'vitest';
import { parseReceipt, money } from './receipt';
const T = new Date('2026-10-28');
describe('talões', () => {
  it('Pingo Doce', () => {
    const t = `PINGO DOCE\nDistribuição Alimentar SA\nLoja Exemplo\nFATURA SIMPLIFICADA\nLeite meio gordo   0,89\nPão  1,20\nSUBTOTAL  12,30\nTOTAL A PAGAR    12,30\nIVA 6%  0,70\nCartão  12,30\nData: 14/10/2026 18:22`;
    expect(parseReceipt(t, T)).toEqual({ store: 'Pingo Doce', category: 'Supermercado', date: '2026-10-14', total: 1230 });
  });
  it('Continente com total na linha seguinte e milhares', () => {
    const t = `Continente Bom Dia\nNIF 500000000\n05-10-26 10:01\nTotal Poupança 3,10\nTOTAL\n1.034,56\nTroco 0,00`;
    expect(parseReceipt(t, T)).toMatchObject({ store: 'Continente', date: '2026-10-05', total: 103456 });
  });
  it('Mercadona e OCR com espaços', () => {
    const t = `MERCADONA, S.A.\n02/09/2026\nTOTAL (€)  45, 67\nTARJETA BANCARIA 45,67`;
    expect(parseReceipt(t, T)).toMatchObject({ store: 'Mercadona', total: 4567, date: '2026-09-02' });
  });
  it('loja desconhecida: primeira linha, sem categoria', () => {
    const t = `Café Exemplo Lda\nRua X\nA PAGAR 3,40\n28.10.2026`;
    expect(parseReceipt(t, T)).toEqual({ store: 'Café Exemplo Lda', category: null, date: '2026-10-28', total: 340 });
  });
  it('sem total', () => { expect(parseReceipt('Lidl\nqualquer coisa', T).total).toBeNull(); expect(money('7,05')).toBe(705); });
});
