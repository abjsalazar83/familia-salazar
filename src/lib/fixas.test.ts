// fs-v44: despesas fixas = só lembretes. Nada é lançado sozinho.
import { describe, it, expect } from 'vitest';
import monthSrc from '../Month.tsx?raw';
import inboxSrc from '../Inbox.tsx?raw';
import faltamSrc from '../Faltam.tsx?raw';
import paySrc from './payments.ts?raw';
import { keyword, launchedByName, pendentes, pendentesText, type Payment } from './payments';

const P = (o: Partial<Payment>): Payment => ({ id: 'p', family_id: 'f', name: 'X', amount_cents: 1000, period: 'mensal', next_date: null, payer: null, account: null, note: null, new_amount_cents: null, new_period: null, new_from: null, is_deleted: false, kind: 'conjunta', split: '50/50', category: 'Casa', owner_member: 'a', last_posted: null, ...o });
const T = '2026-11-27';

describe('Faltam lançar', () => {
  it('fixo de valor certo com dono aparece no lembrete (não é lançado sozinho)', () => {
    const r = pendentes([P({ id: 'pr', name: 'Prestação Bankinter', amount_cents: 45000, next_date: '2026-11-26' })], [], T);
    expect(r).toHaveLength(1); expect(r[0]).toMatchObject({ date: '2026-11-26', amount: 45000, undated: false });
  });
  it('variável: sem valor, com o último como sugestão', () => {
    const r = pendentes([P({ id: 'luz', name: 'Luz Goldenergy', variable: true, amount_cents: 3900, next_date: '2026-11-24' })], [{ payment_id: 'luz', payment_due: '2026-10-24', date: '2026-10-24', is_deleted: false, amount_cents: 4120, description: 'Luz Goldenergy' }], T);
    expect(r[0].amount).toBeNull(); expect(r[0].hint).toBe(4120);
  });
  it('mensal sem data aparece uma vez por mês, até haver despesa ou «já registado»', () => {
    const digi = P({ id: 'digi', name: 'Digi', amount_cents: 1000 });
    expect(pendentes([digi], [], T)[0]).toMatchObject({ undated: true, amount: 1000, date: T });
    expect(pendentes([{ ...digi, last_posted: '2026-11-03' }], [], T)).toEqual([]);
    expect(pendentes([{ ...digi, last_posted: '2026-10-03' }], [], T)).toHaveLength(1);
    expect(pendentes([digi], [{ description: 'DIGI fatura', date: '2026-11-10', is_deleted: false }], T)).toEqual([]);
    expect(pendentes([digi], [{ description: 'DIGI fatura', date: '2026-10-10', is_deleted: false }], T)).toHaveLength(1);
    expect(pendentes([{ ...digi, period: 'anual' }], [], T)).toEqual([]);
  });
  it('despesa lançada à mão no mesmo mês (mesmo nome) conta como lançada; retirada não conta', () => {
    const pr = P({ id: 'pr', name: 'Prestação Bankinter', next_date: '2026-11-26' });
    expect(pendentes([pr], [{ description: 'prestacao casa', date: '2026-11-26', is_deleted: false }], T)).toEqual([]);
    expect(pendentes([pr], [{ description: 'Prestação', date: '2026-11-26', is_deleted: true }], T)).toHaveLength(1);
    expect(pendentes([pr], [{ payment_id: 'pr', payment_due: '2026-11-26', date: '2026-11-27', is_deleted: false }], T)).toEqual([]);
  });
  it('apagadas e futuras não aparecem; texto curto', () => {
    expect(pendentes([P({ is_deleted: true }), P({ id: 'f', next_date: '2026-12-09' })], [], T)).toEqual([]);
    const xs = pendentes([P({ id: '1', name: 'Luz Goldenergy', next_date: '2026-11-24' }), P({ id: '2', name: 'Digi' }), P({ id: '3', name: 'Prestação Bankinter', next_date: '2026-11-26' }), P({ id: '4', name: 'Escola', amount_cents: null, variable: true })], [], T);
    expect(pendentesText(xs)).toBe('Faltam lançar 4: Luz, Prestação, Digi +1');
    expect(keyword('Google One / AI Plus (Fotos)')).toBe('google'); expect(keyword('Águas de Gaia')).toBe('aguas');
    expect(launchedByName(P({ name: 'Águas de Gaia' }), [{ description: 'Aguas', date: '2026-11-02', is_deleted: false }], '2026-11')).toBe(true);
  });
  it('não existe nenhum caminho de lançamento automático de fixas', () => {
    expect([monthSrc, inboxSrc, faltamSrc].join('\n')).not.toMatch(/useAutoPost|autoPost\(/);
    expect(paySrc).not.toMatch(/export const autoPost/);
  });
});
