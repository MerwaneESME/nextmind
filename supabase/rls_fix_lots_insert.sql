-- Fix RLS for `lots` insert/edit when user is a phase manager/editor.
-- Apply in Supabase SQL editor (run as a privileged role).

begin;

create or replace function public.can_edit_phase(p_phase_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.phase_members pm
    where pm.phase_id = p_phase_id
      and pm.user_id = auth.uid()
      and (pm.can_edit = true or pm.role = 'phase_manager')
  )
  or exists (
    select 1
    from public.phases ph
    where ph.id = p_phase_id
      and public.is_project_manager(ph.project_id)
  );
$$;

create or replace function public.can_edit_lot(p_lot_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lots l
    join public.phases ph on ph.id = l.phase_id
    where l.id = p_lot_id
      and public.is_project_manager(ph.project_id)
  )
  or exists (
    select 1
    from public.lots l
    join public.phase_members pm on pm.phase_id = l.phase_id
    where l.id = p_lot_id
      and pm.user_id = auth.uid()
      and (pm.can_edit = true or pm.role = 'phase_manager')
      and (
        pm.role <> 'entreprise'
        or l.id = any(pm.assigned_lots)
      )
  );
$$;

drop policy if exists lots_insert on public.lots;
create policy lots_insert
on public.lots
for insert
with check (public.can_edit_phase(phase_id));

commit;

