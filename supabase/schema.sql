-- Família Salazar · esquema Supabase (idempotente: pode correr-se várias vezes)
-- Colar no SQL Editor do projeto e executar.

-- gen_random_uuid() é nativo do PostgreSQL 13+ (sem extensões).

-- ===== Tabelas =====
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  user_id uuid not null references auth.users(id),
  display_name text not null check (length(trim(display_name)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (user_id),              -- cada conta pertence a uma só família
  unique (family_id, display_name)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  description text not null check (length(trim(description)) between 1 and 200),
  category text not null default 'Outros' check (length(category) <= 40),
  paid_by uuid not null references public.family_members(id),
  type text not null check (type in ('pessoal', 'partilhada')),
  split_mode text not null default '50/50' check (split_mode in ('50/50', 'personalizada')),
  shares jsonb not null default '{}'::jsonb,   -- { "<member_id>": cents, ... }
  date date not null default current_date,
  is_deleted boolean not null default false,   -- apagar = esconder; o histórico fica
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  from_member uuid not null references public.family_members(id),
  to_member uuid not null references public.family_members(id),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  date date not null default current_date,
  method text check (method is null or length(method) <= 40),
  confirmed boolean not null default false,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (from_member <> to_member)
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  name text not null check (length(trim(name)) between 1 and 120),
  quantity text check (quantity is null or length(quantity) <= 40),
  note text check (note is null or length(note) <= 200),
  bought boolean not null default false,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Notas históricas importadas (resumos de meses antigos, fixas). NÃO contam para o saldo.
create table if not exists public.history_notes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  kind text not null check (kind in ('acerto', 'fixa', 'referencia')),
  title text not null check (length(title) <= 120),
  value_text text check (value_text is null or length(value_text) <= 80),
  period text check (period is null or length(period) <= 20),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (family_id, kind, title)
);

create index if not exists expenses_family_idx on public.expenses (family_id, date desc);
create index if not exists settlements_family_idx on public.settlements (family_id, date desc);
create index if not exists shopping_family_idx on public.shopping_items (family_id);

-- ===== Funções auxiliares =====
create or replace function public.is_family_member(fid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.family_members where family_id = fid and user_id = auth.uid());
$$;

-- Validação no servidor das despesas: pagador e partes pertencem à família; partes somam o total.
create or replace function public.validate_expense()
returns trigger language plpgsql set search_path = public as $$
declare k text; v jsonb; total bigint := 0;
begin
  if not exists (select 1 from family_members where id = new.paid_by and family_id = new.family_id) then
    raise exception 'Quem pagou não pertence a esta família';
  end if;
  if new.type = 'pessoal' then
    new.shares := '{}'::jsonb;
  else
    if jsonb_typeof(new.shares) <> 'object' or new.shares = '{}'::jsonb then
      raise exception 'Despesa partilhada sem divisão';
    end if;
    for k, v in select * from jsonb_each(new.shares) loop
      if jsonb_typeof(v) <> 'number' or (v::text)::numeric < 0 or (v::text)::numeric <> trunc((v::text)::numeric) then
        raise exception 'Parte inválida';
      end if;
      if not exists (select 1 from family_members where id = k::uuid and family_id = new.family_id) then
        raise exception 'Parte atribuída a quem não é da família';
      end if;
      total := total + (v::text)::bigint;
    end loop;
    if total <> new.amount_cents then
      raise exception 'As partes (%) não somam o total (%)', total, new.amount_cents;
    end if;
  end if;
  if tg_op = 'UPDATE' then
    new.family_id := old.family_id; new.created_by := old.created_by; new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists expenses_validate on public.expenses;
create trigger expenses_validate before insert or update on public.expenses
  for each row execute function public.validate_expense();

create or replace function public.validate_settlement()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from family_members where id = new.from_member and family_id = new.family_id)
     or not exists (select 1 from family_members where id = new.to_member and family_id = new.family_id) then
    raise exception 'Liquidação entre pessoas fora da família';
  end if;
  if tg_op = 'UPDATE' then
    new.family_id := old.family_id; new.created_by := old.created_by; new.created_at := old.created_at;
    if old.confirmed and not new.confirmed then
      raise exception 'Uma liquidação confirmada não pode voltar atrás';
    end if;
  end if;
  if new.confirmed and (tg_op = 'INSERT' or not old.confirmed) then
    new.confirmed_at := now(); new.confirmed_by := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists settlements_validate on public.settlements;
create trigger settlements_validate before insert or update on public.settlements
  for each row execute function public.validate_settlement();

create or replace function public.touch_item()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then new.family_id := old.family_id; end if;
  new.updated_at := now(); return new;
end $$;
drop trigger if exists shopping_touch on public.shopping_items;
create trigger shopping_touch before insert or update on public.shopping_items
  for each row execute function public.touch_item();

-- Criar a família (primeiro utilizador). Se já pertence a uma, devolve-a.
create or replace function public.create_family(p_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Sessão necessária'; end if;
  select family_id into fid from family_members where user_id = auth.uid();
  if fid is not null then return fid; end if;
  insert into families (name, created_by) values (coalesce(nullif(trim(p_name), ''), 'Família Salazar'), auth.uid())
    returning id into fid;
  insert into family_members (family_id, user_id, display_name) values (fid, auth.uid(), trim(p_display_name));
  return fid;
end $$;

-- Entrar numa família com o código de convite (segundo utilizador). Idempotente.
create or replace function public.join_family(code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid; cur uuid;
begin
  if auth.uid() is null then raise exception 'Sessão necessária'; end if;
  select id into fid from families where invite_code = upper(trim(code));
  if fid is null then raise exception 'Código de convite inválido'; end if;
  select family_id into cur from family_members where user_id = auth.uid();
  if cur is not null then
    if cur = fid then return fid; end if;
    raise exception 'Esta conta já pertence a outra família';
  end if;
  if (select count(*) from family_members where family_id = fid) >= 6 then
    raise exception 'Família cheia';
  end if;
  insert into family_members (family_id, user_id, display_name) values (fid, auth.uid(), trim(p_display_name));
  return fid;
end $$;

revoke all on function public.create_family(text, text) from public, anon;
revoke all on function public.join_family(text, text) from public, anon;
grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.join_family(text, text) to authenticated;

-- ===== RLS =====
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.expenses enable row level security;
alter table public.settlements enable row level security;
alter table public.shopping_items enable row level security;
alter table public.history_notes enable row level security;

drop policy if exists families_select on public.families;
create policy families_select on public.families for select to authenticated using (public.is_family_member(id));

drop policy if exists members_select on public.family_members;
create policy members_select on public.family_members for select to authenticated using (public.is_family_member(family_id));
drop policy if exists members_update_self on public.family_members;
create policy members_update_self on public.family_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['expenses', 'settlements', 'shopping_items', 'history_notes'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_family_member(family_id))', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_family_member(family_id))', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id))', t);
  end loop;
end $$;

-- Só os itens de compras e as notas importadas podem ser apagados. Despesas e liquidações nunca.
drop policy if exists shopping_items_delete on public.shopping_items;
create policy shopping_items_delete on public.shopping_items for delete to authenticated using (public.is_family_member(family_id));
drop policy if exists history_notes_delete on public.history_notes;
create policy history_notes_delete on public.history_notes for delete to authenticated using (public.is_family_member(family_id));

revoke delete on public.expenses, public.settlements, public.families, public.family_members from anon, authenticated;
revoke insert on public.families, public.family_members from anon, authenticated;
revoke all on all tables in schema public from anon;

-- ===== Realtime =====
do $$
declare t text;
begin
  foreach t in array array['expenses', 'settlements', 'shopping_items', 'family_members', 'history_notes'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
