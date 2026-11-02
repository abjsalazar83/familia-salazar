-- v17: preço pago por linha do talão em cada item comprado (base para €/kg, €/L, €/un, mín/máx e loja mais barata). Aditivo.
alter table public.shopping_items add column if not exists paid_cents integer check (paid_cents is null or paid_cents >= 0);
