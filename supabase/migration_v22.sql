-- v22 (fs-v43): orçamento de Natal opcional, por época. Só acrescenta; nada é apagado.
-- A categoria «Natal» é texto livre em expenses.category (não precisa de alteração de esquema).
alter table public.family_settings add column if not exists natal_budget_cents bigint check (natal_budget_cents is null or natal_budget_cents between 0 and 100000000);
alter table public.family_settings add column if not exists natal_budget_year int check (natal_budget_year is null or natal_budget_year between 2020 and 2100);
