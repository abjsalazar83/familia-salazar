-- v20: Receitas — histórico «cozinhei» e «planeado para» (só acrescenta; nunca se altera nem apaga).
create table if not exists public.meal_log (
  id uuid primary key,
  family_id uuid not null references public.families(id),
  recipe_id text not null check (length(recipe_id) between 1 and 60),
  meal text not null check (meal in ('almoco','jantar')),
  kind text not null default 'cozinhei' check (kind in ('cozinhei','plano')),
  on_date date not null,
  doses numeric(5,2) check (doses is null or doses between 0 and 50),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists meal_log_family_date_idx on public.meal_log (family_id, on_date desc);
do $$ declare t text := 'meal_log'; begin
  execute format('alter table public.%I enable row level security', t);
  execute format('drop policy if exists %I on public.%I', t || '_select', t);
  execute format('create policy %I on public.%I for select to authenticated using (public.is_family_member(family_id))', t || '_select', t);
  execute format('drop policy if exists %I on public.%I', t || '_insert', t);
  execute format('create policy %I on public.%I for insert to authenticated with check (public.is_family_member(family_id))', t || '_insert', t);
  execute format('revoke all on public.%I from anon', t);
  execute format('revoke update, delete on public.%I from authenticated', t);
  execute format('grant select, insert on public.%I to authenticated', t);
end $$;
