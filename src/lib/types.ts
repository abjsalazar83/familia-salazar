export type Member = { id: string; family_id: string; user_id: string; display_name: string };
export type Family = { id: string; name: string; invite_code: string };
export type Expense = {
  id: string; family_id: string; amount_cents: number; description: string; category: string;
  paid_by: string; type: 'pessoal' | 'partilhada'; split_mode: '50/50' | 'personalizada';
  shares: Record<string, number>; date: string; is_deleted: boolean; created_at: string; receipt_path?: string | null;
  confirmed_by?: string | null; confirmed_at?: string | null; extraordinary?: boolean; reason?: string | null;
  review?: 'por_rever' | 'descartada' | null; source?: string | null;
};
export type Settlement = {
  id: string; family_id: string; from_member: string; to_member: string; amount_cents: number;
  date: string; method: string | null; confirmed: boolean; confirmed_at: string | null; is_deleted: boolean; created_at: string;
};
export type Item = { id: string; family_id: string; name: string; quantity: string | null; note: string | null; bought: boolean; created_at: string; created_by?: string; qty?: number | null; unit?: Unit | null; section?: string | null; basic?: boolean; price_cents?: number | null; archived_at?: string | null; expense_id?: string | null };
export type Unit = 'un' | 'kg' | 'g' | 'L' | 'pack';
export type Note = { id: string; kind: 'acerto' | 'fixa' | 'referencia'; title: string; value_text: string | null; period: string | null; sort: number };
export const CATS = ['Supermercado', 'Casa', 'Lazer', 'Saúde', 'Escola', 'Transporte', 'Subscrições', 'Outros'];
export type HistoryMonth = { id: string; ym: string; total_cents: number; extra_cents: number; cats: Record<string, number>; provisional: boolean; note: string | null };
export type Bill = { id: string; family_id: string; name: string; amount_cents: number | null; period: 'mensal' | 'bimestral' | 'trimestral' | 'anual' | 'variável'; estimate: boolean; payer: string | null; method: string | null; note: string | null; sort: number };
export type Budget = { id: string; family_id: string; category: string; member_id: string | null; limit_cents: number; is_deleted: boolean; created_at: string };
