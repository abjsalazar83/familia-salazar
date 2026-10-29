-- v9: confirmar valores (cada despesa partilhada é confirmada pelo outro membro)
--     + meses fora do normal (despesa extraordinária, razão por despesa e por mês).
-- Não apaga nada.

alter table public.expenses add column if not exists confirmed_by uuid references public.family_members(id);
alter table public.expenses add column if not exists confirmed_at timestamptz;
alter table public.expenses add column if not exists extraordinary boolean not null default false;
alter table public.expenses add column if not exists reason text;

-- Só quem NÃO pagou pode confirmar (ou retirar a sua confirmação).
-- Se o valor, o pagador, a divisão ou o tipo mudarem, a confirmação cai.
create or replace function public.guard_expense_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
declare me uuid;
begin
  if auth.uid() is null then return new; end if; -- service role / SQL editor
  select id into me from family_members where user_id = auth.uid() and family_id = new.family_id;
  if tg_op = 'INSERT' then
    new.confirmed_by := null; new.confirmed_at := null; return new;
  end if;
  if new.confirmed_by is distinct from old.confirmed_by then
    if new.confirmed_by is null then
      if old.confirmed_by is distinct from me then raise exception 'Só quem confirmou pode retirar a confirmação'; end if;
      new.confirmed_at := null;
    else
      if new.confirmed_by is distinct from me then raise exception 'Só podes confirmar em teu nome'; end if;
      if me = new.paid_by then raise exception 'Quem pagou não confirma a própria despesa'; end if;
      new.confirmed_at := now();
    end if;
  elsif new.amount_cents is distinct from old.amount_cents or new.paid_by is distinct from old.paid_by
     or new.shares is distinct from old.shares or new.type is distinct from old.type then
    new.confirmed_by := null; new.confirmed_at := null;
  else
    new.confirmed_at := old.confirmed_at;
  end if;
  return new;
end $$;

drop trigger if exists expenses_confirm_guard on public.expenses;
create trigger expenses_confirm_guard before insert or update on public.expenses
  for each row execute function public.guard_expense_confirm();

-- Razão de um mês fora do normal (um registo por mês e família).
create table if not exists public.month_reasons (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  ym text not null check (ym ~ '^\d{4}-\d{2}$'),
  reason text not null default '',
  updated_by uuid references public.family_members(id),
  updated_at timestamptz not null default now(),
  unique (family_id, ym)
);
alter table public.month_reasons enable row level security;
drop policy if exists month_reasons_select on public.month_reasons;
create policy month_reasons_select on public.month_reasons for select to authenticated using (public.is_family_member(family_id));
drop policy if exists month_reasons_insert on public.month_reasons;
create policy month_reasons_insert on public.month_reasons for insert to authenticated with check (public.is_family_member(family_id));
drop policy if exists month_reasons_update on public.month_reasons;
create policy month_reasons_update on public.month_reasons for update to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
revoke all on public.month_reasons from anon;
revoke delete on public.month_reasons from authenticated;
grant select, insert, update on public.month_reasons to authenticated;
