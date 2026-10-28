-- v8: fotos de talões (privadas). Idempotente.
alter table public.expenses add column if not exists receipt_path text;
do $$ begin
  alter table public.expenses add constraint expenses_receipt_path_family check (receipt_path is null or receipt_path like family_id::text || '/%');
exception when duplicate_object then null; end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('taloes', 'taloes', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Caminho: <family_id>/<expense_id>.jpg — só membros dessa família leem/escrevem.
create or replace function public.taloes_ok(path text) returns boolean language sql stable security definer set search_path = public as $$
  select split_part(path, '/', 1) ~ '^[0-9a-f-]{36}$' and public.is_family_member(split_part(path, '/', 1)::uuid);
$$;
drop policy if exists taloes_select on storage.objects;
drop policy if exists taloes_insert on storage.objects;
drop policy if exists taloes_update on storage.objects;
create policy taloes_select on storage.objects for select to authenticated using (bucket_id = 'taloes' and public.taloes_ok(name));
create policy taloes_insert on storage.objects for insert to authenticated with check (bucket_id = 'taloes' and public.taloes_ok(name));
create policy taloes_update on storage.objects for update to authenticated using (bucket_id = 'taloes' and public.taloes_ok(name)) with check (bucket_id = 'taloes' and public.taloes_ok(name));
-- Sem política de delete: o histórico não se apaga.
