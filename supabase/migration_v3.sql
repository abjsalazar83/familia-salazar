-- Família Salazar · migração v3: histórico mensal e contas recorrentes (privados, só membros da família).
-- Idempotente: pode correr várias vezes. Correr DEPOIS de schema.sql e ANTES do seed privado.

create table if not exists public.history_months (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  ym text not null check (ym ~ '^\d{4}-\d{2}$'),
  total_cents bigint not null check (total_cents >= 0),
  extra_cents bigint not null default 0 check (extra_cents >= 0),
  cats jsonb not null default '{}'::jsonb,          -- { "Supermercado": cêntimos, ... }
  provisional boolean not null default false,
  note text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (family_id, ym)
);

create table if not exists public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  amount_cents bigint check (amount_cents is null or amount_cents >= 0), -- null = valor por registar
  period text not null default 'mensal' check (period in ('mensal', 'bimestral', 'trimestral', 'anual', 'variável')),
  estimate boolean not null default false,          -- true = média histórica, não fatura
  payer text check (payer is null or length(payer) <= 40),
  method text check (method is null or length(method) <= 60),
  note text check (note is null or length(note) <= 200),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, name)
);

-- Dados à espera de uma família (o seed pode correr antes de alguém criar a conta). Inacessível pela API.
create table if not exists public.seed_pending (
  id bigserial primary key,
  family_name text not null,
  kind text not null check (kind in ('month', 'bill', 'note')),
  payload jsonb not null,
  unique (family_name, kind, payload)
);

create or replace function public.attach_pending_seed(fid uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare fname text; n integer := 0; r record;
begin
  select name into fname from families where id = fid;
  if fname is null then return 0; end if;
  for r in select * from seed_pending where family_name = fname order by id loop
    if r.kind = 'month' then
      insert into history_months (family_id, ym, total_cents, extra_cents, cats, provisional, note)
      values (fid, r.payload->>'ym', (r.payload->>'total_cents')::bigint, coalesce((r.payload->>'extra_cents')::bigint, 0),
              coalesce(r.payload->'cats', '{}'::jsonb), coalesce((r.payload->>'provisional')::boolean, false), r.payload->>'note')
      on conflict (family_id, ym) do update set total_cents = excluded.total_cents, extra_cents = excluded.extra_cents,
        cats = excluded.cats, provisional = excluded.provisional, note = excluded.note;
    elsif r.kind = 'bill' then
      insert into recurring_bills (family_id, name, amount_cents, period, estimate, payer, method, note, sort)
      values (fid, r.payload->>'name', (r.payload->>'amount_cents')::bigint, coalesce(r.payload->>'period', 'mensal'),
              coalesce((r.payload->>'estimate')::boolean, false), r.payload->>'payer', r.payload->>'method', r.payload->>'note', coalesce((r.payload->>'sort')::int, 0))
      on conflict (family_id, name) do nothing;   -- não estragar valores já editados na app
    else
      insert into history_notes (family_id, kind, title, value_text, period, sort)
      values (fid, coalesce(r.payload->>'kind', 'acerto'), r.payload->>'title', r.payload->>'value_text', r.payload->>'period', coalesce((r.payload->>'sort')::int, 0))
      on conflict (family_id, kind, title) do update set value_text = excluded.value_text, period = excluded.period, sort = excluded.sort;
    end if;
    n := n + 1;
  end loop;
  delete from seed_pending where family_name = fname;
  return n;
end $$;
revoke all on function public.attach_pending_seed(uuid) from public, anon, authenticated;

create or replace function public.families_attach_seed()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.attach_pending_seed(new.id); return new; end $$;
drop trigger if exists families_attach_seed on public.families;
create trigger families_attach_seed after insert on public.families for each row execute function public.families_attach_seed();

drop trigger if exists recurring_touch on public.recurring_bills;
create trigger recurring_touch before insert or update on public.recurring_bills for each row execute function public.touch_item();

alter table public.history_months enable row level security;
alter table public.recurring_bills enable row level security;
alter table public.seed_pending enable row level security;   -- sem políticas: ninguém lhe chega pela API

drop policy if exists history_months_select on public.history_months;
create policy history_months_select on public.history_months for select to authenticated using (public.is_family_member(family_id));
drop policy if exists recurring_bills_select on public.recurring_bills;
create policy recurring_bills_select on public.recurring_bills for select to authenticated using (public.is_family_member(family_id));
drop policy if exists recurring_bills_insert on public.recurring_bills;
create policy recurring_bills_insert on public.recurring_bills for insert to authenticated with check (public.is_family_member(family_id));
drop policy if exists recurring_bills_update on public.recurring_bills;
create policy recurring_bills_update on public.recurring_bills for update to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
drop policy if exists recurring_bills_delete on public.recurring_bills;
create policy recurring_bills_delete on public.recurring_bills for delete to authenticated using (public.is_family_member(family_id));

revoke all on public.seed_pending from anon, authenticated;
revoke all on public.history_months, public.recurring_bills from anon;
revoke insert, update, delete on public.history_months from authenticated;
grant select on public.history_months to authenticated;
grant select, insert, update, delete on public.recurring_bills to authenticated;

do $$
declare t text;
begin
  foreach t in array array['history_months', 'recurring_bills'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
