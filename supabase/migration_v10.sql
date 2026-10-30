-- v10: lista de compras — quantidade/unidade, secção, básicos, arquivo (nunca apagar), preferências/preços por item.
alter table public.shopping_items
  add column if not exists qty numeric check (qty is null or (qty > 0 and qty < 10000)),
  add column if not exists unit text check (unit is null or unit in ('un','kg','g','L','pack')),
  add column if not exists section text check (section is null or length(section) <= 40),
  add column if not exists basic boolean not null default false,
  add column if not exists price_cents integer check (price_cents is null or price_cents between 0 and 10000000),
  add column if not exists archived_at timestamptz,
  add column if not exists expense_id uuid;
create index if not exists shopping_active_idx on public.shopping_items (family_id) where archived_at is null;

-- Memória da família por item (nome normalizado): secção escolhida, básico, último preço, frequência.
create table if not exists public.shopping_prefs (
  family_id uuid not null references public.families(id),
  key text not null check (length(key) between 1 and 120),
  name text not null check (length(name) between 1 and 120),
  section text check (section is null or length(section) <= 40),
  basic boolean not null default false,
  unit text check (unit is null or unit in ('un','kg','g','L','pack')),
  last_price_cents integer check (last_price_cents is null or last_price_cents between 0 and 10000000),
  uses integer not null default 0,
  last_used timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, key)
);

do $$ declare t text := 'shopping_prefs'; begin
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
  foreach t in array array['shopping_prefs', 'shopping_items'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
