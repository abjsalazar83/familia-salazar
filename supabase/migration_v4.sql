-- Família Salazar · v4: limites de gastos mensais. Idempotente: pode correr-se mais de uma vez.
-- member_id nulo = limite da casa (despesas partilhadas). Preenchido = despesas pessoais dessa pessoa.
-- category '*' = todas as categorias. Apagar = is_deleted (soft-delete), sem DELETE pela API.
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  category text not null check (length(trim(category)) between 1 and 40),
  member_id uuid references public.family_members(id) on delete cascade,
  limit_cents bigint not null check (limit_cents > 0),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists budgets_one_active
  on public.budgets (family_id, category, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid)) where not is_deleted;

-- A pessoa do limite tem de ser da mesma família.
create or replace function public.budgets_check_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.member_id is not null and not exists (select 1 from family_members where id = new.member_id and family_id = new.family_id) then
    raise exception 'member_id não pertence a esta família';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists budgets_check on public.budgets;
create trigger budgets_check before insert or update on public.budgets for each row execute function public.budgets_check_member();

alter table public.budgets enable row level security;
drop policy if exists budgets_select on public.budgets;
create policy budgets_select on public.budgets for select to authenticated using (public.is_family_member(family_id));
drop policy if exists budgets_insert on public.budgets;
create policy budgets_insert on public.budgets for insert to authenticated with check (public.is_family_member(family_id));
drop policy if exists budgets_update on public.budgets;
create policy budgets_update on public.budgets for update to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
drop policy if exists budgets_delete on public.budgets;

revoke delete on public.budgets from authenticated, anon;
grant select, insert, update on public.budgets to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'budgets') then
    alter publication supabase_realtime add table public.budgets;
  end if;
end $$;
