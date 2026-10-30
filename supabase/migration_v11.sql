-- v11: receitas partilhadas (abono, reembolsos, IRS) e receitas fixas. Só acrescenta; nunca apaga histórico.
create table if not exists public.income_rules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  name text not null check (length(name) between 1 and 120),
  category text not null check (category in ('Abono','Reembolso','IRS','Outro')),
  received_by uuid not null references public.family_members(id),
  receiver_pct integer not null default 50 check (receiver_pct between 0 and 100),
  day integer not null default 1 check (day between 1 and 31),
  active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.shared_incomes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  amount_cents integer check (amount_cents is null or amount_cents between 1 and 100000000),
  received_by uuid not null references public.family_members(id),
  category text not null check (category in ('Abono','Reembolso','IRS','Outro')),
  date date not null default current_date,
  note text check (note is null or length(note) <= 120),
  receiver_pct integer not null default 50 check (receiver_pct between 0 and 100),
  rule_id uuid references public.income_rules(id),
  ym text check (ym is null or ym ~ '^\d{4}-\d{2}$'),
  confirmed_by uuid references public.family_members(id),
  confirmed_at timestamptz,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shared_incomes_family_idx on public.shared_incomes (family_id, date desc);
-- Uma entrada por receita fixa e mês (dois telemóveis a abrir ao mesmo tempo não duplicam).
create unique index if not exists shared_incomes_rule_month_uq on public.shared_incomes (rule_id, ym) where rule_id is not null;

do $$ declare t text; begin
  foreach t in array array['income_rules', 'shared_incomes'] loop
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
