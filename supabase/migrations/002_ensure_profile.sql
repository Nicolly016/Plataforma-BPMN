-- Cria o perfil de contas que já existiam em auth.users antes do trigger.
-- A primeira conta, quando ainda não há administrador, entra como administrador.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text;
  display_name text;
  assigned_role text;
begin
  perform pg_advisory_xact_lock(842014);

  user_email := coalesce(nullif(btrim(new.email), ''), new.id::text || '@usuario.local');
  display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(user_email, '@', 1), ''),
    'Usuario'
  );
  assigned_role := case
    when not exists (select 1 from public.profiles where role = 'administrador') then 'administrador'
    else 'visualizador'
  end;

  insert into public.profiles (id, email, full_name, role)
  values (new.id, user_email, display_name, assigned_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.ensure_own_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  user_email text;
  display_name text;
  assigned_role text;
begin
  if actor is null then
    raise exception 'Sessão ausente';
  end if;

  if exists (select 1 from public.profiles where id = actor) then
    return;
  end if;

  perform pg_advisory_xact_lock(842014);

  select
    coalesce(nullif(btrim(u.email), ''), actor::text || '@usuario.local'),
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Usuario'
    )
  into user_email, display_name
  from auth.users as u
  where u.id = actor;

  if user_email is null then
    raise exception 'Usuário de autenticação não encontrado';
  end if;

  assigned_role := case
    when not exists (select 1 from public.profiles where role = 'administrador') then 'administrador'
    else 'visualizador'
  end;

  insert into public.profiles (id, email, full_name, role)
  values (actor, user_email, display_name, assigned_role)
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.ensure_own_profile() from public, anon;
grant execute on function public.ensure_own_profile() to authenticated;

with missing as (
  select
    u.id,
    coalesce(nullif(btrim(u.email), ''), u.id::text || '@usuario.local') as email,
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Usuario'
    ) as full_name,
    u.created_at
  from auth.users as u
  where not exists (select 1 from public.profiles as profile where profile.id = u.id)
)
insert into public.profiles (id, email, full_name, role)
select
  missing.id,
  missing.email,
  missing.full_name,
  case
    when not exists (select 1 from public.profiles where role = 'administrador')
      and missing.id = (select id from missing order by created_at limit 1)
      then 'administrador'
    else 'visualizador'
  end
from missing
on conflict (id) do nothing;
