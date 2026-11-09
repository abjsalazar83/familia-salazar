-- v21: Viagens, calendário de pagamentos, subscrições, «Meninas & escola», inflação manual. Só acrescenta; nada é apagado.
-- 1) Viagens: ficha da viagem (orçamento a bordo opcional, divisão por omissão).
create table if not exists public.trips (
  id uuid primary key,
  family_id uuid not null references public.families(id),
  name text not null check (length(name) between 1 and 80),
  start_date date,
  end_date date,
  budget_cents integer check (budget_cents is null or budget_cents between 0 and 100000000),
  default_split text not null default '50/50' check (default_split in ('50/50', 'personalizada')),
  note text,
  is_deleted boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 2) Reservas já pagas (informativas): não entram no acerto. Quem pagou/divisão podem ficar por confirmar (null).
create table if not exists public.trip_items (
  id uuid primary key,
  family_id uuid not null references public.families(id),
  trip_id uuid not null references public.trips(id),
  description text not null check (length(description) between 1 and 120),
  amount_cents integer check (amount_cents is null or amount_cents between 0 and 100000000),
  paid_by uuid references public.family_members(id),
  split text check (split is null or split in ('50/50', 'personalizada')),
  expense_id uuid references public.expenses(id),
  note text,
  is_deleted boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trip_items_trip_idx on public.trip_items (trip_id);
-- 3) Despesas: ligação à viagem (fica fora do mês normal) e subcategoria («Meninas & escola»).
alter table public.expenses add column if not exists trip_id uuid references public.trips(id);
alter table public.expenses add column if not exists subcat text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_subcat_chk') then
    alter table public.expenses add constraint expenses_subcat_chk check (subcat is null or subcat in ('refeições', 'material', 'atividades', 'roupa'));
  end if;
end $$;
-- 4) Pagamentos: marca de subscrição (inventário no ecrã Subscrições).
alter table public.payments add column if not exists subscription boolean not null default false;
-- 5) Inflação: valor introduzido à mão (quando o INE não está disponível na app).
alter table public.family_settings add column if not exists cpi_manual numeric(5,2) check (cpi_manual is null or cpi_manual between -50 and 100);
alter table public.family_settings add column if not exists cpi_manual_ym text check (cpi_manual_ym is null or cpi_manual_ym ~ '^\d{4}-\d{2}$');

do $$ declare t text; begin
  foreach t in array array['trips', 'trip_items'] loop
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
