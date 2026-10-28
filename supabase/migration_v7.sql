-- v7: pagamentos periódicos conjuntos/pessoais que geram despesas («por lançar»). Só esquema; sem dados.
-- Idempotente. Não apaga nada (recurring_bills fica como arquivo).
alter table public.payments add column if not exists kind text not null default 'conjunta';
alter table public.payments add column if not exists split text not null default '50/50';
alter table public.payments add column if not exists category text not null default 'Casa';
alter table public.payments add column if not exists owner_member uuid references public.family_members(id);  -- dono (pessoal) ou quem paga (conjunta)
alter table public.payments add column if not exists last_posted date;
alter table public.payments add column if not exists expense_id uuid references public.expenses(id);
alter table public.payments add column if not exists legacy_bill_id uuid references public.recurring_bills(id);
do $$ begin
  alter table public.payments add constraint payments_kind_chk check (kind in ('conjunta', 'pessoal'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.payments add constraint payments_split_chk check (split in ('50/50'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.payments add constraint payments_category_chk check (length(category) between 1 and 40);
exception when duplicate_object then null; end $$;
-- períodos: aceita também bimestral (vindo das contas antigas)
alter table public.payments drop constraint if exists payments_period_check;
alter table public.payments add constraint payments_period_check check (period in ('mensal', 'bimestral', 'trimestral', 'anual'));
alter table public.payments drop constraint if exists payments_new_period_check;
alter table public.payments add constraint payments_new_period_check check (new_period is null or new_period in ('mensal', 'bimestral', 'trimestral', 'anual'));

-- Ligação despesa ↔ ocorrência do pagamento; impede lançar a mesma ocorrência duas vezes (mesmo nos dois telemóveis).
alter table public.expenses add column if not exists payment_id uuid references public.payments(id);
alter table public.expenses add column if not exists payment_due date;
create unique index if not exists expenses_payment_once on public.expenses (payment_id, payment_due) where payment_id is not null and not is_deleted;

-- O dono tem de ser da mesma família.
create or replace function public.check_payment_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_member is not null and not exists (select 1 from family_members m where m.id = new.owner_member and m.family_id = new.family_id) then
    raise exception 'owner_member fora da família';
  end if;
  if new.kind = 'pessoal' and new.owner_member is null then raise exception 'pagamento pessoal precisa de dono'; end if;
  return new;
end $$;
drop trigger if exists payments_owner_chk on public.payments;
create trigger payments_owner_chk before insert or update on public.payments for each row execute function public.check_payment_owner();
