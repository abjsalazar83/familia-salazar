-- v19: comparar Mercadona × Lidl. Aditivo.
-- 1) web_prices: país e cadeia normalizados (filtrar Portugal; Espanha fica de fora).
alter table public.web_prices add column if not exists country text;
alter table public.web_prices add column if not exists chain text;
create index if not exists web_prices_country_chain_idx on public.web_prices (country, chain);
-- 2) Preço de prateleira por loja (manual ou referência da internet escolhida). Nunca se apaga: o mais recente vale.
create table if not exists public.shelf_prices (
  id uuid primary key,
  family_id uuid not null references public.families(id),
  key text not null check (length(key) between 1 and 120),
  chain text not null check (chain in ('mercadona','lidl')),
  source text not null default 'manual' check (source in ('manual','web')),
  web_id text,
  price_cents integer not null check (price_cents between 0 and 10000000),
  base text check (base is null or base in ('kg','L','un')),
  seen_on date not null default current_date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists shelf_prices_family_key_idx on public.shelf_prices (family_id, key, chain, created_at desc);
do $$ declare t text := 'shelf_prices'; begin
  execute format('alter table public.%I enable row level security', t);
  execute format('drop policy if exists %I on public.%I', t || '_select', t);
  execute format('create policy %I on public.%I for select to authenticated using (public.is_family_member(family_id))', t || '_select', t);
  execute format('drop policy if exists %I on public.%I', t || '_insert', t);
  execute format('create policy %I on public.%I for insert to authenticated with check (public.is_family_member(family_id))', t || '_insert', t);
  execute format('revoke all on public.%I from anon', t);
  execute format('revoke update, delete on public.%I from authenticated', t);
  execute format('grant select, insert on public.%I to authenticated', t);
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
    execute format('alter publication supabase_realtime add table public.%I', t);
  end if;
end $$;
