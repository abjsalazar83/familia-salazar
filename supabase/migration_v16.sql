-- v16: pagamentos fixos com «valor variável» (água, luz, SAD): cada mês ficam por confirmar com o valor do mês anterior como sugestão. Aditivo.
alter table public.payments add column if not exists variable boolean not null default false;
