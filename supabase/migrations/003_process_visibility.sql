-- Administrador e editor enxergam o processo sem depender da linha
-- já estar visível na mesma instrução de insert.

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

revoke all on function public.can_view_process(uuid) from public, anon;
revoke all on function public.can_edit_process(uuid) from public, anon;
grant execute on function public.can_view_process(uuid) to authenticated;
grant execute on function public.can_edit_process(uuid) to authenticated;
