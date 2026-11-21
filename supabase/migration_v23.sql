-- v23 (fs-v46): Eventos (Natal, aniversários, Páscoa, batizados…). Só acrescenta; nada é apagado.
-- Os eventos da família vivem só nesta tabela (nunca no repositório). Retirar = is_deleted (histórico fica).
-- O Natal continua compatível: despesas com categoria «Natal» contam no evento Natal da época, e o orçamento
-- de Natal continua também em family_settings.natal_budget_cents/_year (mesmo significado da v22).
create table if not exists public.events (
  id uuid primary key,
  family_id uuid not null references public.families(id),
  name text not null check (length(name) between 1 and 60),
  emoji text check (emoji is null or length(emoji) <= 16),
  kind text not null default 'outro' check (kind in ('natal', 'outro')),
  start_date date not null,
  end_date date not null,
  budget_cents bigint check (budget_cents is null or budget_cents between 0 and 100000000),
  is_deleted boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_dates_chk check (end_date >= start_date)
);
create index if not exists events_family_idx on public.events (family_id, start_date);
-- Despesas: ligação opcional a um evento (o Natal também conta pela categoria).
alter table public.expenses add column if not exists event_id uuid references public.events(id);

do $$ declare t text; begin
  foreach t in array array['events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_family_member(family_id))', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_family_member(family_id))', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id))', t || '_update', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke delete on public.%I from authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
