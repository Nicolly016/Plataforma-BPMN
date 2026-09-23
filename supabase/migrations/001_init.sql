-- Plataforma de processos BPMN
-- Papéis: administrador, editor, visualizador
-- O primeiro administrador é promovido manualmente após o cadastro no Auth:
--   update public.profiles set role = 'administrador' where email = 'voce@empresa.com';

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'visualizador' check (role in ('administrador', 'editor', 'visualizador')),
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create table public.processes (
  id uuid primary key default gen_random_uuid(),
  code text not null check (char_length(btrim(code)) between 2 and 40),
  name text not null check (char_length(btrim(name)) between 3 and 160),
  description text,
  objective text,
  department text not null check (char_length(btrim(department)) between 2 and 120),
  responsible_id uuid references public.profiles (id) on delete set null,
  category text not null check (char_length(btrim(category)) between 2 and 80),
  status text not null default 'rascunho' check (status in ('rascunho', 'em_revisao', 'publicado', 'arquivado')),
  current_version text not null default '1.0',
  bpmn_xml text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.process_versions (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes (id) on delete cascade,
  version_number text not null,
  bpmn_xml text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  notes text,
  unique (process_id, version_number)
);

create table public.process_element_metadata (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes (id) on delete cascade,
  bpmn_element_id text not null,
  element_type text not null,
  responsible text,
  department text,
  role text,
  description text,
  documentation text,
  estimated_time text,
  systems text,
  channel text,
  inputs text,
  outputs text,
  documents text,
  risks text,
  controls text,
  regulations text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (process_id, bpmn_element_id)
);

create table public.process_tags (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes (id) on delete cascade,
  tag text not null check (char_length(btrim(tag)) between 1 and 40),
  unique (process_id, tag)
);

create unique index processes_code_key on public.processes (code);
create index processes_status_idx on public.processes (status);
create index processes_department_idx on public.processes (department);
create index processes_responsible_id_idx on public.processes (responsible_id);
create index processes_created_by_idx on public.processes (created_by);
create index processes_updated_at_idx on public.processes (updated_at desc);
create index process_versions_process_id_idx on public.process_versions (process_id);
create index process_element_metadata_process_id_idx on public.process_element_metadata (process_id);
create index process_tags_process_id_idx on public.process_tags (process_id);
create index profiles_email_idx on public.profiles (email);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger processes_set_updated_at
before update on public.processes
for each row execute function public.set_updated_at();

create trigger process_element_metadata_set_updated_at
before update on public.process_element_metadata
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'usuario'), '@', 1)),
    'visualizador'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'O identificador do perfil não pode ser alterado';
  end if;

  if new.role is distinct from old.role and public.current_role() is distinct from 'administrador' then
    raise exception 'Apenas administradores podem alterar perfis de acesso';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_role
before update on public.profiles
for each row execute function public.protect_profile_role();

create or replace function public.enforce_process_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
begin
  actor := public.current_role();

  if actor is null or actor not in ('administrador', 'editor') then
    raise exception 'Sem permissão para alterar processos';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.status := 'rascunho';
    new.archived_at := null;
    new.current_version := coalesce(nullif(btrim(new.current_version), ''), '1.0');
    return new;
  end if;

  new.id := old.id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if actor = 'editor' then
    if old.status = 'arquivado' or new.status is distinct from old.status then
      raise exception 'Editores não podem alterar o status do processo';
    end if;
  end if;

  if new.status = 'arquivado' and old.status is distinct from 'arquivado' then
    new.archived_at := coalesce(new.archived_at, now());
  elsif new.status is distinct from 'arquivado' then
    new.archived_at := null;
  end if;

  return new;
end;
$$;

create trigger processes_enforce_permissions
before insert or update on public.processes
for each row execute function public.enforce_process_permissions();

create or replace function public.can_view_process(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_role() in ('administrador', 'editor') then true
    when public.current_role() = 'visualizador' then exists (
      select 1
      from public.processes as process
      where process.id = target
        and process.status = 'publicado'
    )
    else false
  end;
$$;

create or replace function public.can_edit_process(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_role() = 'administrador' then true
    when public.current_role() = 'editor' then exists (
      select 1
      from public.processes as process
      where process.id = target
        and process.status <> 'arquivado'
    )
    else false
  end;
$$;

alter table public.profiles enable row level security;
alter table public.processes enable row level security;
alter table public.process_versions enable row level security;
alter table public.process_element_metadata enable row level security;
alter table public.process_tags enable row level security;

revoke all on public.profiles from anon;
revoke all on public.processes from anon;
revoke all on public.process_versions from anon;
revoke all on public.process_element_metadata from anon;
revoke all on public.process_tags from anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.processes to authenticated;
grant select, insert on public.process_versions to authenticated;
grant select, insert, update, delete on public.process_element_metadata to authenticated;
grant select, insert, delete on public.process_tags to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.protect_profile_role() from public, anon, authenticated;
revoke all on function public.enforce_process_permissions() from public, anon, authenticated;
revoke all on function public.current_role() from public, anon;
revoke all on function public.can_view_process(uuid) from public, anon;
revoke all on function public.can_edit_process(uuid) from public, anon;
grant execute on function public.current_role() to authenticated;
grant execute on function public.can_view_process(uuid) to authenticated;
grant execute on function public.can_edit_process(uuid) to authenticated;

create policy profiles_select on public.profiles
for select to authenticated
using (true);

create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid() or public.current_role() = 'administrador')
with check (id = auth.uid() or public.current_role() = 'administrador');

create policy processes_select on public.processes
for select to authenticated
using (public.can_view_process(id));

create policy processes_insert on public.processes
for insert to authenticated
with check (public.current_role() in ('administrador', 'editor') and created_by = auth.uid());

create policy processes_update on public.processes
for update to authenticated
using (
  public.current_role() = 'administrador'
  or (public.current_role() = 'editor' and status <> 'arquivado')
)
with check (
  public.current_role() = 'administrador'
  or (public.current_role() = 'editor' and status <> 'arquivado')
);

create policy process_versions_select on public.process_versions
for select to authenticated
using (public.can_view_process(process_id));

create policy process_versions_insert on public.process_versions
for insert to authenticated
with check (public.can_edit_process(process_id));

create policy process_element_metadata_select on public.process_element_metadata
for select to authenticated
using (public.can_view_process(process_id));

create policy process_element_metadata_insert on public.process_element_metadata
for insert to authenticated
with check (public.can_edit_process(process_id));

create policy process_element_metadata_update on public.process_element_metadata
for update to authenticated
using (public.can_edit_process(process_id))
with check (public.can_edit_process(process_id));

create policy process_element_metadata_delete on public.process_element_metadata
for delete to authenticated
using (public.can_edit_process(process_id));

create policy process_tags_select on public.process_tags
for select to authenticated
using (public.can_view_process(process_id));

create policy process_tags_insert on public.process_tags
for insert to authenticated
with check (public.can_edit_process(process_id));

create policy process_tags_delete on public.process_tags
for delete to authenticated
using (public.can_edit_process(process_id));
