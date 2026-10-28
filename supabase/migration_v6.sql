-- Família Salazar · v6: rendimentos, pagamentos/subscrições, fechos de mês e definições da família.
-- Idempotente. Sem DELETE pela API (soft-delete com is_deleted). RLS: só membros da própria família.
create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  ym text not null check (ym ~ '^\d{4}-\d{2}$'),
  amount_cents bigint not null check (amount_cents >= 0),
  note text check (note is null or length(note) <= 200),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists incomes_one on public.incomes (family_id, member_id, ym) where not is_deleted;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  period text not null default 'mensal' check (period in ('mensal', 'trimestral', 'anual')),
  next_date date,
  payer text check (payer is null or length(payer) <= 40),
  account text check (account is null or length(account) <= 60),
  note text check (note is null or length(note) <= 300),
  new_amount_cents bigint check (new_amount_cents is null or new_amount_cents >= 0),
  new_period text check (new_period is null or new_period in ('mensal', 'trimestral', 'anual')),
  new_from date,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.month_closes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  ym text not null check (ym ~ '^\d{4}-\d{2}$'),
  creditor uuid references public.family_members(id),
  debtor uuid references public.family_members(id),
  lists jsonb not null default '{}'::jsonb,      -- totais das duas listas (já a metade) e linhas «mês X»
  diff_cents bigint not null default 0,
  paid_cents bigint not null default 0,          -- máx. 750 € por MB WAY
  carry_cents bigint not null default 0,         -- passa para o mês seguinte como «mês X» na lista do credor
  settlement_id uuid references public.settlements(id),
  is_deleted boolean not null default false,
  closed_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists month_closes_one on public.month_closes (family_id, ym) where not is_deleted;

create table if not exists public.family_settings (
  family_id uuid primary key references public.families(id) on delete cascade,
  savings_goal_cents bigint not null default 60000 check (savings_goal_cents >= 0),
  notify_days int not null default 3 check (notify_days between 0 and 30),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create or replace function public.check_member_family() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.member_id is not null and not exists (select 1 from family_members where id = new.member_id and family_id = new.family_id) then
    raise exception 'member_id não pertence a esta família';
  end if;
  return new;
end $$;
drop trigger if exists incomes_member on public.incomes;
create trigger incomes_member before insert or update on public.incomes for each row execute function public.check_member_family();

do $$ declare t text; begin
  foreach t in array array['incomes', 'payments', 'month_closes', 'family_settings'] loop
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
