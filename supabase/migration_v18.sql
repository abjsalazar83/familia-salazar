-- v18: preços de referência da internet (Open Prices / Open Food Facts, dados abertos ODbL) + preço unitário do talão + escolha de referência por item. Aditivo.
create table if not exists public.web_prices (
  id text primary key,                       -- 'off:<price id>'
  source text not null default 'open_prices',
  name text not null check (length(name) between 1 and 200),
  terms text not null default '',            -- nome + categorias normalizados (pesquisa)
  store text, city text,
  price_cents integer not null check (price_cents >= 0),
  base text check (base in ('kg','L','un')),
  unit_price_cents integer check (unit_price_cents is null or unit_price_cents >= 0),
  seen_on date,                              -- data do preço (etiqueta/talão submetido)
  url text,
  fetched_at timestamptz not null default now()
);
alter table public.web_prices enable row level security;
drop policy if exists web_prices_read on public.web_prices;
create policy web_prices_read on public.web_prices for select to authenticated using (true);
-- escrita só pela Edge Function (service role).
alter table public.shopping_items add column if not exists unit_price_cents integer check (unit_price_cents is null or unit_price_cents >= 0);
alter table public.shopping_prefs add column if not exists web_ref text;
