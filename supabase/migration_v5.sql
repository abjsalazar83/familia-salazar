-- v5: reabrir / fechar um mês do histórico (sem apagar nada).
-- O mês fica "provisório" (= em aberto) ou volta a fechado. Só membros da própria família.
create or replace function public.set_month_open(p_ym text, p_open boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare fid uuid; n integer;
begin
  select family_id into fid from family_members where user_id = auth.uid();
  if fid is null then raise exception 'sem família'; end if;
  update history_months set provisional = p_open where family_id = fid and ym = p_ym;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.set_month_open(text, boolean) from public, anon;
grant execute on function public.set_month_open(text, boolean) to authenticated;

-- Outubro de 2026 continua em aberto com a Ana.
update public.history_months set provisional = true where ym = '2026-10';
