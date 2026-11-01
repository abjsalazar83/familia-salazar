-- v15: pagamentos conjuntos podem ser «100% do outro» (quem paga adianta, o outro deve tudo). Aditivo; 50/50 continua o padrão.
alter table public.payments drop constraint if exists payments_split_chk;
alter table public.payments add constraint payments_split_chk check (split in ('50/50', 'outro100'));
