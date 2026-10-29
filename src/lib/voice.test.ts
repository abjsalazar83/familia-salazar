import { describe, it, expect } from 'vitest';
import { parseVoice as p } from './voice';
describe('parseVoice', () => {
  it('Mercadona 80 euros e 30', () => expect(p('Mercadona 80 euros e 30')).toMatchObject({ total: 8030, store: 'Mercadona', category: 'Supermercado', payer: 'me', personal: false }));
  it('45,50 gasolina', () => expect(p('45,50 gasolina')).toMatchObject({ total: 4550, store: 'Gasolina', category: 'Transporte' }));
  it('45.5 e €', () => { expect(p('farmácia 12.5').total).toBe(1250); expect(p('pingo doce 20€').total).toBe(2000); });
  it('pagou a Ana', () => expect(p('pingo doce 32 euros pagou a Ana')).toMatchObject({ total: 3200, store: 'Pingo Doce', payer: 'other' }));
  it('paguei eu', () => expect(p('Lidl 10 euros paguei eu').payer).toBe('me'));
  it('só minha / pessoal', () => { expect(p('cabeleireiro 25 só minha')).toMatchObject({ personal: true, store: 'Cabeleireiro' }); expect(p('livros 15 pessoal').personal).toBe(true); });
  it('número por extenso', () => expect(p('oitenta euros continente').total).toBe(8000));
  it('cêntimos', () => expect(p('café 3 euros e 5 cêntimos').total).toBe(305));
  it('sem valor', () => expect(p('jantar fora').total).toBeNull());
});
