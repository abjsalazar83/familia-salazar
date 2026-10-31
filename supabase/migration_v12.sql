-- v12: despesas importadas de extrato ficam «por rever» e não contam no saldo até alguém confirmar.
-- Só acrescenta colunas; nada é apagado.
alter table public.expenses add column if not exists review text check (review is null or review in ('por_rever','descartada'));
alter table public.expenses add column if not exists source text check (source is null or length(source) <= 40);
create index if not exists expenses_review_idx on public.expenses(family_id) where review is not null;
