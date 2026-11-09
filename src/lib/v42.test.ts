import { describe, expect, it } from 'vitest';
import { agenda, agendaTotal, reminders, subscriptions } from './agenda';
import { tripShares, tripSummary, upcomingTrip, inNormalMonth, type Trip, type TripItem } from './trips';
import { goalState, goalForToday, median, midMonthWarning } from './goal';
import { cpiFor, hasYoY, lastYearYm, yoy } from './yoy';
import { kidsMonths, kidsAvg, isKids } from './kids';
import type { Payment } from './payments';
import type { HistoryMonth } from './types';

const P = (x: Partial<Payment>): Payment => ({ id: x.name ?? 'p', family_id: 'f', name: 'p', amount_cents: null, period: 'mensal', next_date: null, payer: null, account: null, note: null, new_amount_cents: null, new_period: null, new_from: null, is_deleted: false, kind: 'conjunta', split: '50/50', category: 'Casa', owner_member: 'a', ...x });

describe('agenda (calendário de pagamentos)', () => {
  const today = '2026-11-09';
  it('lista as ocorrências dos próximos 60 dias, por data, com periodicidade', () => {
    const a = agenda([P({ name: 'Casa', amount_cents: 50000, next_date: '2026-11-15' }), P({ name: 'Seguro', amount_cents: 12000, period: 'trimestral', next_date: '2026-10-20' })], [], today, 60);
    expect(a.items.map((x) => [x.p.name, x.date])).toEqual([['Casa', '2026-11-15'], ['Casa', '2026-12-15']]); // seguro só a 20/01 (fora dos 60 dias)
    expect(a.items.every((x) => x.days >= 0 && x.days <= 60)).toBe(true);
  });
  it('valor variável: último valor lançado marcado ≈; sem lançamento → null (nunca inventa)', () => {
    const sad = P({ name: 'SAD', variable: true, next_date: '2026-11-30' });
    const agua = P({ name: 'Águas', variable: true, next_date: '2026-11-30' });
    const a = agenda([sad, agua], [{ payment_id: null, payment_due: null, is_deleted: false, amount_cents: 3000, date: '2026-10-31', description: 'Águas' }], today);
    const s = a.items.find((x) => x.p.name === 'SAD')!; const g = a.items.find((x) => x.p.name === 'Águas')!;
    expect(s.amount).toBeNull(); expect(s.approx).toBe(false);
    expect(g.amount).toBe(3000); expect(g.approx).toBe(true);
    expect(agendaTotal(a.items)).toEqual({ known: 6000, unknown: 2, approx: true }); // 30/11 e 30/12
  });
  it('sem data → «undated» com o que falta definir (IUC, escola)', () => {
    const a = agenda([P({ name: 'IUC', period: 'anual' }), P({ name: 'Escola', amount_cents: 18000 })], [], today);
    expect(a.items).toEqual([]);
    expect(a.undated.map((u) => [u.p.name, u.missing])).toEqual([['Escola', ['data']], ['IUC', ['data', 'valor']]]);
  });
  it('lembretes: só o que vence dentro dos dias de antecedência', () => {
    const a = agenda([P({ name: 'A', amount_cents: 1, next_date: '2026-11-09' }), P({ name: 'B', amount_cents: 1, next_date: '2026-11-12' }), P({ name: 'C', amount_cents: 1, next_date: '2026-11-13' })], [], today);
    expect(reminders(a, 3).map((x) => x.p.name)).toEqual(['A', 'B']);
  });
  it('marca o dia em que entra o preço novo', () => {
    const a = agenda([P({ name: 'S', amount_cents: 2997, period: 'trimestral', next_date: '2027-01-05', new_amount_cents: 1299, new_period: 'mensal', new_from: '2027-01-05' })], [], '2026-11-20', 60);
    expect(a.items).toHaveLength(1); expect(a.items[0].amount).toBe(1299); expect(a.items[0].priceChange).toBe(true);
  });
});

describe('subscrições', () => {
  const sg = P({ name: 'Streaming', subscription: true, kind: 'pessoal', amount_cents: 2997, period: 'trimestral', next_date: '2027-01-05', new_amount_cents: 1299, new_period: 'mensal', new_from: '2027-01-05', account: 'Visa …0000' });
  it('equivalente mensal, renovação e aviso de subida', () => {
    const s = subscriptions([sg, P({ name: 'Nuvem', subscription: true }), P({ name: 'Luz', amount_cents: 5000 })], '2026-11-09');
    expect(s.rows.map((r) => r.p.name)).toEqual(['Streaming', 'Nuvem']);
    expect(s.monthly).toBe(999); expect(s.unknown).toBe(1);
    const r = s.rows[0]; expect(r.renewal).toBe('2027-01-05'); expect(r.rise).toEqual({ from: '2027-01-05', amount: 1299, period: 'mensal', monthly: 1299 });
    expect(s.rows[1].amount).toBeNull();
  });
  it('depois da data, o preço novo é o atual e o aviso desaparece', () => {
    const s = subscriptions([sg], '2027-02-01');
    expect(s.rows[0].amount).toBe(1299); expect(s.rows[0].period).toBe('mensal'); expect(s.rows[0].rise).toBeNull(); expect(s.rows[0].renewal).toBe('2027-02-05');
  });
});

describe('viagens', () => {
  const t: Trip = { id: 't', family_id: 'f', name: 'Viagem X', start_date: '2026-12-01', end_date: '2026-12-08', budget_cents: null, default_split: '50/50', note: null, is_deleted: false };
  const items: TripItem[] = [{ id: 'i1', family_id: 'f', trip_id: 't', description: 'Viagem X', amount_cents: 120000, paid_by: null, split: null, expense_id: 'e1', note: null, is_deleted: false },
    { id: 'i2', family_id: 'f', trip_id: 't', description: 'Voos X', amount_cents: 24000, paid_by: null, split: null, expense_id: null, note: null, is_deleted: false }];
  const exps = [{ id: 'e1', trip_id: 't', amount_cents: 120000, paid_by: 'a', is_deleted: false }, { id: 'e2', trip_id: 't', amount_cents: 4000, paid_by: 'b', is_deleted: false }, { id: 'e3', trip_id: null, amount_cents: 999, paid_by: 'a', is_deleted: false }];
  it('reservas não contam duas vezes; gastos da viagem à parte; orçamento vazio por omissão', () => {
    const s = tripSummary(t, items, exps, '2026-11-09');
    expect(s.reservas).toBe(144000); expect(s.spent).toBe(4000); expect(s.total).toBe(148000);
    expect(s.budget).toBeNull(); expect(s.left).toBeNull(); expect(s.byMember).toEqual({ b: 4000 });
    expect(s.phase).toBe('antes'); expect(s.days).toBe(22); expect(s.nights).toBe(7);
  });
  it('orçamento: sobra e excesso', () => {
    expect(tripSummary({ ...t, budget_cents: 3000 }, items, exps, '2026-12-08')).toMatchObject({ left: -1000, phase: 'durante' });
  });
  it('divisão 50/50 por omissão (cêntimo para quem pagou) ou parte indicada', () => {
    expect(tripShares(1001, 'a', 'b')).toEqual({ a: 501, b: 500 });
    expect(tripShares(1000, 'a', 'b', 300)).toEqual({ a: 300, b: 700 });
    expect(tripShares(1000, 'a', null)).toEqual({});
  });
  it('viagem no Mês só até 60 dias antes; despesas de viagem fora do mês normal', () => {
    expect(upcomingTrip([t], '2026-11-09')?.id).toBe('t'); expect(upcomingTrip([t], '2026-09-01')).toBeNull(); expect(upcomingTrip([t], '2026-12-15')).toBeNull();
    expect(inNormalMonth({ trip_id: 't' })).toBe(false); expect(inNormalMonth({ category: 'Viagem' })).toBe(false); expect(inNormalMonth({ category: 'Lazer' })).toBe(true);
  });
});

const H = (ym: string, t: number, cats: Record<string, number> = {}, provisional = false): HistoryMonth => ({ id: ym, ym, total_cents: t, extra_cents: 0, cats, provisional, note: null });
describe('meta de poupança', () => {
  const ms = [H('2026-07', 300000), H('2026-08', 250000), H('2026-09', 260000), H('2026-10', 240000), H('2026-11', 999999, {}, true)];
  it('mediana dos meses fechados', () => { expect(median([3, 1, 2])).toBe(2); expect(median([1, 2, 3, 4])).toBe(3); expect(median([])).toBeNull(); });
  it('acima do habitual a meio do mês → aviso', () => {
    const g = goalState(ms, '2026-11', 150000, 15, 30, 60000);
    expect(g.usual).toBe(255000); expect(g.projected).toBe(300000); expect(g.diff).toBe(45000); expect(g.status).toBe('acima'); expect(g.goalLeft).toBe(15000);
    expect(midMonthWarning(g, '2026-11')).toEqual({ key: 'fs-goal-2026-11', over: 45000 });
  });
  it('antes do dia 15 não avisa; abaixo do habitual → ok; menos de 3 meses → sem dados', () => {
    expect(midMonthWarning(goalState(ms, '2026-11', 150000, 12, 30), '2026-11')).toBeNull();
    expect(goalState(ms, '2026-11', 50000, 15, 30).status).toBe('ok');
    expect(goalState(ms.slice(0, 2), '2026-11', 1, 15, 30).status).toBe('sem-dados');
  });
  it('hoje: ignora pessoais, viagens e outros meses', () => {
    const g = goalForToday(ms, [{ category: 'Supermercado', amount_cents: 1000, date: '2026-11-02', is_deleted: false, type: 'partilhada' }, { category: 'Lazer', amount_cents: 120000, date: '2026-11-04', is_deleted: false, type: 'partilhada', trip_id: 't' }, { category: 'Casa', amount_cents: 500, date: '2026-11-03', is_deleted: false, type: 'pessoal' }, { category: 'Casa', amount_cents: 700, date: '2026-10-03', is_deleted: false }], '2026-11-10');
    expect(g.spent).toBe(1000);
  });
});

describe('ano passado e inflação', () => {
  const cpi = { source: 'INE', series: { '2026-08': 3.3, '2026-09': 3.61 } };
  it('INE do mês, senão o último publicado (≤ 3 meses), senão manual, senão null', () => {
    expect(cpiFor('2026-09', cpi)).toEqual({ ym: '2026-09', pct: 3.61, source: 'ine', exact: true });
    expect(cpiFor('2026-11', cpi)).toEqual({ ym: '2026-09', pct: 3.61, source: 'ine', exact: false });
    expect(cpiFor('2026-11', cpi, { pct: 2.9, ym: '2026-11' })).toMatchObject({ pct: 2.9, source: 'manual', exact: true });
    expect(cpiFor('2027-06', cpi)).toBeNull();
  });
  it('escondido sem 12 meses fechados ou sem o mesmo mês do ano passado', () => {
    const ms = Array.from({ length: 12 }, (_, k) => H(`2025-${String(k + 1).padStart(2, '0')}`, 1000));
    expect(hasYoY(ms, '2026-11')).toBe(true); expect(hasYoY(ms.slice(1), '2026-11')).toBe(false); expect(hasYoY(ms.filter((m) => m.ym !== '2025-11'), '2026-11')).toBe(false);
    expect(lastYearYm('2026-01')).toBe('2025-01');
  });
  it('por categoria: % nominal e pontos acima da inflação; só categorias que existem nos dois anos', () => {
    const r = yoy([H('2025-11', 200000, { Supermercado: 60000, Casa: 40000 })], '2026-11', { Supermercado: 66000, Lazer: 5000 }, 210000, 3.6)!;
    expect(r.total).toEqual({ now: 210000, before: 200000, pct: 5, real: 1.4 });
    expect(r.rows).toEqual([{ cat: 'Supermercado', now: 66000, before: 60000, pct: 10, real: 6.4 }]);
    expect(yoy([], '2026-11', {}, 1, 3)).toBeNull();
  });
});

describe('meninas & escola', () => {
  it('soma por subcategoria por mês; aceita categorias antigas; histórico quando a app não tem dados', () => {
    const ex = [{ category: 'Meninas & escola', subcat: 'roupa', amount_cents: 1000, date: '2026-11-04', is_deleted: false }, { category: 'Meninas & escola', subcat: 'refeições', amount_cents: 4500, date: '2026-11-05', is_deleted: false }, { category: 'Escola', amount_cents: 200, date: '2026-11-06', is_deleted: false }, { category: 'Supermercado', amount_cents: 999, date: '2026-11-06', is_deleted: false }];
    const k = kidsMonths(ex, '2026-11', 3, [{ ym: '2026-10', cats: { 'Filhos/escola': 3000 } }]);
    expect(k.map((m) => m.ym)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(k[2]).toMatchObject({ total: 5700, by: { roupa: 1000, 'refeições': 4500, 'sem subcategoria': 200, material: 0, atividades: 0 } });
    expect(k[1]).toMatchObject({ total: 3000, fromHistory: true }); expect(k[0].total).toBe(0);
    expect(kidsAvg(k.slice(0, -1))).toBe(3000); expect(isKids('Filhos/escola')).toBe(true); expect(isKids('Lazer')).toBe(false);
  });
});
