-- v14: receitas numa só tabela de leitura (aditivo: nada é apagado nem alterado).
-- Junta salários mensais (incomes) e receitas partilhadas (shared_incomes) numa vista.
create or replace view public.receitas
with (security_invoker = true) as
  select id, family_id, 'salario'::text as origem, member_id as member_id, ym, null::date as date,
         amount_cents::bigint as amount_cents, null::text as category, note, null::uuid as rule_id,
         null::timestamptz as confirmed_at, is_deleted, created_at
    from public.incomes
  union all
  select id, family_id, 'partilhada', received_by, coalesce(ym, to_char(date, 'YYYY-MM')), date,
         amount_cents, category, note, rule_id, confirmed_at, is_deleted, created_at
    from public.shared_incomes;
grant select on public.receitas to authenticated;
