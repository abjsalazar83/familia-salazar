// Fila de escrita local (outbox). Lógica pura, sem React nem rede, para poder ser testada.
export type Table = 'expenses' | 'settlements' | 'shopping_items' | 'recurring_bills' | 'budgets' | 'shared_incomes' | 'income_rules';
export type OpKind = 'create' | 'patch' | 'delete';
export type Op = {
  opId: string; table: Table; kind: OpKind; id: string;
  row: Record<string, unknown>;          // create: linha completa (com id gerado no cliente); patch: só os campos alterados
  status: 'pending' | 'failed'; error?: string; attempts: number; nextAt: number; createdAt: number;
};
export type Snapshot = Record<Table, Array<Record<string, unknown> & { id: string }>>;

export const uuid = () => crypto.randomUUID();

/** Junta uma operação à fila. Sem fusões: cada alteração é enviada por ordem, nada se perde durante um envio em curso. */
export function enqueue(q: Op[], op: Omit<Op, 'opId' | 'status' | 'attempts' | 'nextAt' | 'createdAt'>, now = Date.now()): Op[] {
  return [...q, { ...op, opId: uuid(), status: 'pending', attempts: 0, nextAt: 0, createdAt: now }];
}

/** Junta o resultado de um envio com o estado atual da fila (operações novas entretanto, ou descartadas entretanto). */
export function mergeAfterFlush(start: Op[], result: Op[], current: Op[]): Op[] {
  const startIds = new Set(start.map((o) => o.opId)); const cur = new Set(current.map((o) => o.opId));
  return [...result.filter((o) => cur.has(o.opId)), ...current.filter((o) => !startIds.has(o.opId))];
}

/** Aplica a fila por cima dos dados do servidor (vista otimista). Devolve também os ids com alterações por sincronizar/falhadas. */
export function applyOps(s: Snapshot, q: Op[]) {
  const out: Snapshot = { expenses: [...s.expenses], settlements: [...s.settlements], shopping_items: [...s.shopping_items], recurring_bills: [...(s.recurring_bills ?? [])], budgets: [...(s.budgets ?? [])], shared_incomes: [...(s.shared_incomes ?? [])], income_rules: [...(s.income_rules ?? [])] };
  const state: Record<string, 'pending' | 'failed'> = {};
  for (const o of q) {
    const list = out[o.table]; const i = list.findIndex((r) => r.id === o.id);
    if (o.kind === 'create') { if (i < 0) list.unshift({ ...(o.row as { id: string }) }); }
    else if (o.kind === 'patch') { if (i >= 0) list[i] = { ...list[i], ...o.row }; }
    else if (i >= 0) list.splice(i, 1);
    if (state[o.id] !== 'failed') state[o.id] = o.status;
  }
  return { data: out, state };
}

export type ExecResult = { ok: true } | { ok: false; retry: boolean; error: string };
export const backoff = (attempts: number) => Math.min(60_000, 2_000 * 2 ** Math.max(0, attempts - 1));

/**
 * Envia as operações pendentes por ordem. Só remove uma operação quando o servidor confirma.
 * Erro de rede → fica pendente com espera crescente e pára (a ordem importa). Erro do servidor/conflito → 'failed', nunca descartada.
 */
export async function flush(q: Op[], exec: (o: Op) => Promise<ExecResult>, now = Date.now()) {
  let cur = q; let sent = 0;
  for (const o of q) {
    if (o.status !== 'pending') continue;
    if (o.nextAt > now) break;
    // Dependência: não atualizar um registo cujo "create" falhou.
    if (cur.some((x) => x.id === o.id && x.status === 'failed' && x.createdAt <= o.createdAt)) continue;
    const r = await exec(o);
    if (r.ok) { cur = cur.filter((x) => x.opId !== o.opId); sent++; continue; }
    const attempts = o.attempts + 1;
    cur = cur.map((x) => (x.opId === o.opId ? (r.retry ? { ...x, attempts, nextAt: now + backoff(attempts), error: r.error } : { ...x, attempts, status: 'failed' as const, error: r.error }) : x));
    if (r.retry) break;
  }
  return { queue: cur, sent };
}

export const retryOp = (q: Op[], opId: string): Op[] => q.map((o) => (o.opId === opId ? { ...o, status: 'pending', nextAt: 0, error: undefined } : o));
/** Descartar só existe para alterações locais ainda não aceites pelo servidor; remove também as que dependem dela. */
export function discardOp(q: Op[], opId: string): Op[] {
  const o = q.find((x) => x.opId === opId); if (!o) return q;
  return q.filter((x) => x.opId !== opId && !(o.kind === 'create' && x.id === o.id));
}

/** Classifica o erro: falha de rede/servidor indisponível → tentar de novo; regra/validação/conflito → falhou. */
export function classify(e: unknown): ExecResult {
  const m = (e as { message?: string })?.message || String(e);
  const code = String((e as { code?: string })?.code ?? '');
  const status = Number((e as { status?: number })?.status ?? 0);
  if (/Failed to fetch|NetworkError|Load failed|fetch failed|timeout/i.test(m) || status >= 500 || (status === 0 && !code) || code === 'PGRST301' || /JWT/i.test(m))
    return { ok: false, retry: true, error: m };
  return { ok: false, retry: false, error: m };
}
