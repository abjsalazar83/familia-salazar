-- v13 (aditiva): fechar mês pela fila local. Ao inserir um fecho, o mês do histórico deixa de estar «em aberto».
-- Nada é apagado nem reescrito; a função set_month_open continua a existir.
create or replace function public.month_close_marks_history() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update history_months set provisional = false where family_id = new.family_id and ym = new.ym;
  return new;
end $$;
drop trigger if exists trg_month_close_marks_history on public.month_closes;
create trigger trg_month_close_marks_history after insert on public.month_closes for each row execute function public.month_close_marks_history();
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'month_closes') then
    alter publication supabase_realtime add table public.month_closes;
  end if;
end $$;
