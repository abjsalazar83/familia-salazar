import { describe, expect, it } from 'vitest';
import { applyOps, classify, discardOp, enqueue, flush, mergeAfterFlush, retryOp, type ExecResult, type Op, type Snapshot } from './outbox';
import { calculateHouseholdBalance } from './balance';

const A = 'a', N = 'n';
const exp = (id: string, cents: number, payer: string) => ({ id, family_id: 'f', amount_cents: cents, description: id, category: 'Outros', paid_by: payer, type: 'partilhada', split_mode: '50/50', shares: { [A]: cents / 2, [N]: cents / 2 }, date: '2026-10-28', is_deleted: false, created_at: '' });
const empty = (): Snapshot => ({ expenses: [], settlements: [], shopping_items: [], recurring_bills: [] });
const ok = async (): Promise<ExecResult> => ({ ok: true });

describe('outbox', () => {
  it('cria com id do cliente e aplica de forma otimista, marcado como por sincronizar', () => {
    const q = enqueue([], { table: 'expenses', kind: 'create', id: 'e1', row: exp('e1', 10000, A) });
    const { data, state } = applyOps(empty(), q);
    expect(data.expenses).toHaveLength(1); expect(state.e1).toBe('pending');
  });
  it('create repetido depois de chegar ao servidor não duplica', () => {
    const q = enqueue([], { table: 'expenses', kind: 'create', id: 'e1', row: exp('e1', 10000, A) });
    const s = empty(); s.expenses.push(exp('e1', 10000, A));
    expect(applyOps(s, q).data.expenses).toHaveLength(1);
  });
  it('patch e delete aplicam-se por ordem', () => {
    const s = empty(); s.shopping_items.push({ id: 'i1', name: 'Leite', bought: false });
    let q = enqueue([], { table: 'shopping_items', kind: 'patch', id: 'i1', row: { bought: true } });
    expect(applyOps(s, q).data.shopping_items[0].bought).toBe(true);
    q = enqueue(q, { table: 'shopping_items', kind: 'delete', id: 'i1', row: {} });
    expect(applyOps(s, q).data.shopping_items).toHaveLength(0);
  });
  it('só remove da fila o que o servidor confirmou; erro de rede fica pendente com espera e pára', async () => {
    let q = enqueue([], { table: 'expenses', kind: 'create', id: 'e1', row: {} });
    q = enqueue(q, { table: 'expenses', kind: 'create', id: 'e2', row: {} });
    const calls: string[] = [];
    const r = await flush(q, async (o) => { calls.push(o.id); return { ok: false, retry: true, error: 'Failed to fetch' }; }, 1000);
    expect(calls).toEqual(['e1']); expect(r.queue).toHaveLength(2);
    expect(r.queue[0].status).toBe('pending'); expect(r.queue[0].nextAt).toBe(3000); expect(r.queue[0].attempts).toBe(1);
    const r2 = await flush(r.queue, ok, 2000); expect(r2.sent).toBe(0); // ainda em espera
    const r3 = await flush(r.queue, ok, 3000); expect(r3.queue).toHaveLength(0); expect(r3.sent).toBe(2);
  });
  it('backoff cresce e tem limite', async () => {
    let q: Op[] = enqueue([], { table: 'expenses', kind: 'create', id: 'e1', row: {} });
    const fail = async (): Promise<ExecResult> => ({ ok: false, retry: true, error: 'x' });
    const waits: number[] = [];
    for (let i = 0; i < 8; i++) { q = (await flush(q, fail, q[0].nextAt)).queue; waits.push(q[0].nextAt - (waits.length ? 0 : 0)); }
    const gaps = waits.map((w, i) => w - (i ? waits[i - 1] : 0));
    expect(gaps.slice(0, 4)).toEqual([2000, 4000, 8000, 16000]); expect(Math.max(...gaps)).toBe(60000);
  });
  it('erro do servidor → Falhou, nunca descartado; continua com outros registos mas não com dependentes', async () => {
    let q = enqueue([], { table: 'expenses', kind: 'create', id: 'e1', row: {} });
    q = enqueue(q, { table: 'expenses', kind: 'patch', id: 'e1', row: { description: 'x' } });
    q = enqueue(q, { table: 'shopping_items', kind: 'create', id: 'i1', row: {} });
    const sent: string[] = [];
    const r = await flush(q, async (o) => { sent.push(o.kind + o.id); return o.id === 'e1' ? { ok: false, retry: false, error: 'regra' } : { ok: true }; });
    expect(sent).toEqual(['createe1', 'createi1']);
    expect(r.queue.map((o) => [o.id, o.status])).toEqual([['e1', 'failed'], ['e1', 'pending']]);
    expect(applyOps(empty(), r.queue).state.e1).toBe('failed');
  });
  it('tentar de novo e descartar (descartar um create leva as alterações dependentes)', () => {
    let q = enqueue([], { table: 'expenses', kind: 'create', id: 'e1', row: {} });
    q = enqueue(q, { table: 'expenses', kind: 'patch', id: 'e1', row: {} });
    q = q.map((o, i) => (i === 0 ? { ...o, status: 'failed', error: 'x' } : o));
    expect(retryOp(q, q[0].opId)[0]).toMatchObject({ status: 'pending', nextAt: 0 });
    expect(discardOp(q, q[0].opId)).toHaveLength(0);
  });
  it('alterações feitas durante um envio não se perdem; descartadas durante o envio não voltam', () => {
    const start = enqueue(enqueue([], { table: 'expenses', kind: 'create', id: 'a', row: {} }), { table: 'expenses', kind: 'create', id: 'b', row: {} });
    const result = [start[1]]; // 'a' enviado
    const current = enqueue(start.filter((o) => o.id !== 'b'), { table: 'expenses', kind: 'create', id: 'c', row: {} });
    expect(mergeAfterFlush(start, result, current).map((o) => o.id)).toEqual(['c']);
  });
  it('classifica erros', () => {
    expect(classify(new TypeError('Failed to fetch'))).toMatchObject({ retry: true });
    expect(classify({ message: 'violates check', code: '23514' })).toMatchObject({ retry: false });
    expect(classify({ message: 'boom', code: '', status: 503 })).toMatchObject({ retry: true });
  });
  it('saldo com despesa offline + liquidação confirmada offline', () => {
    const s = empty(); s.expenses.push(exp('e1', 10000, A));
    s.settlements.push({ id: 's1', from_member: N, to_member: A, amount_cents: 1000, confirmed: false, is_deleted: false });
    let q = enqueue([], { table: 'expenses', kind: 'create', id: 'e2', row: exp('e2', 2000, N) });
    q = enqueue(q, { table: 'settlements', kind: 'patch', id: 's1', row: { confirmed: true } });
    const { data } = applyOps(s, q);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = calculateHouseholdBalance([A, N], data.expenses as any, data.settlements as any);
    expect(b.debt).toEqual({ from: N, to: A, cents: 3000 });
  });
});
