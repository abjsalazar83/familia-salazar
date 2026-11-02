import { describe, it, expect } from 'vitest';
import { parseLines, matchLines } from './receiptLines';
// Talão fictício (formato tipo Continente/Pingo Doce/Lidl).
const T = `CONTINENTE MODELO EXEMPLO
NIF 500000000
BANANA CAT I            1,79 C
 1,205 kg x 1,49 EUR/kg
LEITE M/GORDO 1L  2 x 0,89   1,78 A
IOGURTE GREGO NATURAL   2,49 C
DESC. PROMO            -0,50
PAO DE FORMA INTEGRAL   1,35 C
SUBTOTAL               6,91
TOTAL A PAGAR          6,91
MULTIBANCO             6,91
IVA 6%  0,39`;
describe('linhas do talão', () => {
  const ls = parseLines(T);
  it('extrai cada produto com quantidade, preço unitário e total', () => {
    expect(ls).toEqual([
      { name: 'BANANA CAT I', qty: 1.205, unit: 'kg', unitPrice: 149, total: 179 },
      { name: 'LEITE M/GORDO 1L', qty: 2, unit: 'un', unitPrice: 89, total: 178 },
      { name: 'IOGURTE GREGO NATURAL', qty: null, unit: null, unitPrice: null, total: 199 },
      { name: 'PAO DE FORMA INTEGRAL', qty: null, unit: null, unitPrice: null, total: 135 },
    ]);
  });
  it('liga as linhas aos itens da lista (aproximado) e deixa o resto por adicionar', () => {
    const m = matchLines(ls, [{ id: 'b', name: 'Bananas' }, { id: 'l', name: 'Leite' }, { id: 'p', name: 'Pão de forma integral' }, { id: 'o', name: 'Ovos' }]);
    expect(m).toEqual({ 0: 'b', 1: 'l', 3: 'p' });
  });
});
