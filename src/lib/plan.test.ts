import { describe, it, expect } from 'vitest';
import { closeCalc, halvedLists, nextDue, upcoming, termsAt, savings, closeMessage, type Payment } from './plan';
const P = (o: Partial<Payment>): Payment => ({ id: 'x', family_id: 'f', name: 'X', amount_cents: 1000, period: 'mensal', next_date: '2026-10-08', payer: null, account: null, note: null, new_amount_cents: null, new_period: null, new_from: null, is_deleted: false, ...o });
describe('pagamentos', () => {
  it('avança pela periodicidade e muda de preço', () => {
    const p = P({ amount_cents: 2500, period: 'trimestral', next_date: '2026-10-08', new_amount_cents: 1100, new_period: 'mensal', new_from: '2027-01-08' });
    expect(nextDue(p, '2026-10-28')).toBe('2027-01-08');
    expect(termsAt(p, '2027-01-08')).toEqual({ amount: 1100, period: 'mensal' });
    expect(nextDue(p, '2027-01-09')).toBe('2027-02-08');
  });
  it('fim de mês e sem data', () => {
    expect(nextDue(P({ next_date: '2026-01-31' }), '2026-02-01')).toBe('2026-02-28');
    const u = upcoming([P({ next_date: null, name: 'b' }), P({ next_date: '2026-11-01', name: 'a' })], '2026-10-28');
    expect(u[0].p.name).toBe('a'); expect(u[0].days).toBe(4); expect(u[0].soon).toBe(true); expect(u[1].date).toBeNull();
  });
});
describe('fecho de mês', () => {
  it('limite MB WAY 750 € e resto para o mês seguinte', () => {
    const c = closeCalc({ ana: 150000, ant: 63000 });
    expect(c).toEqual({ creditor: 'ana', debtor: 'ant', diff: 87000, paid: 75000, carry: 12000 });
    expect(closeCalc({ a: 100, b: 100 }).debtor).toBeNull();
  });
  it('listas a metade a partir das despesas', () => {
    const l = halvedLists(['a', 'b'], [{ paid_by: 'a', amount_cents: 1000, shares: { a: 500, b: 500 }, date: '2026-10-02', is_deleted: false },
      { paid_by: 'b', amount_cents: 400, shares: null, date: '2026-10-03', is_deleted: false }, { paid_by: 'b', amount_cents: 999, shares: null, date: '2026-09-03', is_deleted: false }], '2026-10');
    expect(l).toEqual({ a: 500, b: 200 });
  });
  it('mensagem', () => {
    const m = closeMessage('2026-10', { a: 'Ana', b: 'António' }, { a: 150000, b: 63000 }, closeCalc({ a: 150000, b: 63000 }), (c) => (c / 100).toFixed(2));
    expect(m).toContain('António → Ana: 750.00'); expect(m).toContain('novembro');
  });
});
describe('poupança', () => {
  it('em risco pelo ritmo', () => {
    expect(savings(0, 0, 0, 60000).status).toBe('sem-dados');
    expect(savings(300000, 100000, 250000, 60000).status).toBe('risco');
    expect(savings(300000, 100000, 200000, 60000).status).toBe('ok');
  });
});
import { porLancar, postExpense, hasV7, monthlyTotals } from './plan';
describe('por lançar', () => {
  const base = P({ id: 'p1', next_date: '2026-09-15', kind: 'conjunta', category: 'Casa', owner_member: 'a', last_posted: null });
  it('só depois da migração', () => { expect(porLancar([P({})], [], '2026-10-28')).toEqual([]); expect(hasV7([base])).toBe(true); });
  it('ocorrências vencidas nos últimos 40 dias, sem repetir', () => {
    expect(porLancar([base], [], '2026-10-28').map((x) => x.date)).toEqual(['2026-09-15', '2026-10-15'].filter((d) => d > '2026-09-18'));
    expect(porLancar([base], [{ payment_id: 'p1', payment_due: '2026-10-15', is_deleted: false }], '2026-10-28')).toEqual([]);
    expect(porLancar([{ ...base, last_posted: '2026-10-15' }], [], '2026-10-28')).toEqual([]);
    expect(porLancar([{ ...base, next_date: '2027-01-08' }], [], '2026-10-28')).toEqual([]);
  });
  it('conjunta 50/50 entra no acerto; pessoal só do dono', () => {
    const c = postExpense(base, '2026-10-15', 1001, ['a', 'b'], 'b');
    expect(c).toMatchObject({ type: 'partilhada', paid_by: 'a', shares: { a: 500, b: 501 }, payment_id: 'p1', payment_due: '2026-10-15' });
    const s = postExpense({ ...base, kind: 'pessoal', owner_member: 'b' }, '2026-10-15', 900, ['a', 'b'], 'a');
    expect(s).toMatchObject({ type: 'pessoal', paid_by: 'b', shares: {} });
  });
  it('totais', () => {
    const t = monthlyTotals([base, { ...base, id: 'p2', kind: 'pessoal', owner_member: 'a', amount_cents: 3000, period: 'trimestral' }], '2026-10-28');
    expect(t).toEqual({ conjunta: 1000, pessoal: { a: 1000 } });
  });
});
