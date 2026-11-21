import { describe, expect, it } from 'vitest';
import { activeChips, allEvents, eventSummary, inEvent, isActive, showCard, validEvent, type FamEvent } from './events';
import mig from '../../supabase/migration_v23.sql?raw';

const EV = (o: Partial<FamEvent>): FamEvent => ({ id: 'ev1', family_id: 'f', name: 'Aniversário (exemplo)', emoji: '🎂', kind: 'outro', start_date: '2027-03-01', end_date: '2027-03-10', budget_cents: null, is_deleted: false, ...o });
const E = (o: Record<string, unknown>) => ({ category: 'Lazer', amount_cents: 1000, date: '2027-03-05', is_deleted: false, type: 'partilhada' as const, paid_by: 'a', event_id: null as string | null, ...o });

describe('Eventos', () => {
  it('Natal virtual só quando não há Natal real na época; orçamento antigo mantém o significado', () => {
    const st = { natal_budget_cents: 40000, natal_budget_year: 2026 };
    const v = allEvents([], '2026-11-21', st); expect(v).toHaveLength(1); expect(v[0]).toMatchObject({ kind: 'natal', virtual: true, budget_cents: 40000, start_date: '2026-09-01', end_date: '2027-01-31' });
    const real = EV({ id: 'n26', kind: 'natal', name: 'Natal', emoji: '🎄', start_date: '2026-09-01', end_date: '2027-01-31' });
    const r = allEvents([real], '2026-11-21', st); expect(r.map((x) => x.id)).toEqual(['n26']); expect(r[0].budget_cents).toBe(40000);
    expect(allEvents([{ ...real, budget_cents: 30000 }], '2026-11-21', st)[0].budget_cents).toBe(30000);
    expect(allEvents([{ ...real, is_deleted: true }], '2026-11-21', null)[0].virtual).toBe(true);
    expect(allEvents([], '2027-03-05', st)).toEqual([]);
  });
  it('despesas do evento: event_id; no Natal também a categoria «Natal» na época (sem outro evento)', () => {
    const ev = EV({}); const natal = EV({ id: 'n', kind: 'natal', start_date: '2026-09-01', end_date: '2027-01-31' });
    expect(inEvent(ev, E({ event_id: 'ev1' }))).toBe(true); expect(inEvent(ev, E({}))).toBe(false); expect(inEvent(ev, E({ event_id: 'ev1', is_deleted: true }))).toBe(false);
    expect(inEvent(natal, E({ category: 'Natal', date: '2026-12-01' }))).toBe(true);
    expect(inEvent(natal, E({ category: 'Natal', date: '2026-12-01', event_id: 'ev1' }))).toBe(false);
    expect(inEvent(natal, E({ category: 'Natal', date: '2027-02-01' }))).toBe(false);
  });
  it('resumo: total, conjunta vs pessoal, quem pagou, n.º, orçamento (80% / acima)', () => {
    const s = eventSummary(EV({ budget_cents: 5000 }), [E({ event_id: 'ev1', amount_cents: 3000 }), E({ event_id: 'ev1', amount_cents: 1200, type: 'pessoal', paid_by: 'b' }), E({ amount_cents: 999 })]);
    expect(s).toMatchObject({ total: 4200, shared: 3000, personal: 1200, count: 2, paid: { a: 3000, b: 1200 }, budget: 5000, left: 800 }); expect(s.ratio).toBeCloseTo(0.84);
    expect(eventSummary(EV({ budget_cents: 1000 }), [E({ event_id: 'ev1', amount_cents: 1500 })]).left).toBe(-500);
  });
  it('atalho ao lançar durante o evento; cartão até 30 dias depois se tiver despesas', () => {
    const ev = EV({});
    expect(isActive(ev, '2027-03-01')).toBe(true); expect(isActive(ev, '2027-03-11')).toBe(false); expect(activeChips([ev], '2027-02-28')).toEqual([]);
    expect(showCard(eventSummary(ev, []), '2027-03-11')).toBe(false);
    expect(showCard(eventSummary(ev, [E({ event_id: 'ev1' })]), '2027-04-09')).toBe(true);
    expect(showCard(eventSummary(ev, [E({ event_id: 'ev1' })]), '2027-04-10')).toBe(false);
    const natal = EV({ kind: 'natal', start_date: '2026-09-01', end_date: '2027-01-31' });
    expect(isActive(natal, '2026-10-20')).toBe(false); expect(isActive(natal, '2026-11-01')).toBe(true);
  });
  it('validação do formulário', () => {
    expect(validEvent({ name: '', start: '2027-03-01', end: '2027-03-02' })).toMatch(/nome/);
    expect(validEvent({ name: 'X', start: '2027-03-02', end: '2027-03-01' })).toMatch(/fim/);
    expect(validEvent({ name: 'X', start: '2027-03-01', end: '2027-03-01' })).toBe('');
  });
  it('migração só acrescenta (sem dados da família, sem apagar)', () => {
    expect(mig).toMatch(/create table if not exists public\.events/); expect(mig).toMatch(/add column if not exists event_id/);
    expect(mig).not.toMatch(/insert into|delete from|drop table|drop column/i);
  });
});
