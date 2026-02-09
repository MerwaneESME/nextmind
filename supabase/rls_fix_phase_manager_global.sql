-- Global fix: make Phase Manager able to create lots everywhere (RLS)
-- Run in Supabase SQL Editor as an admin role (e.g. postgres).

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
    from public.phases phm
    where phm.id = p_phase_id
      and phm.phase_manager_id = auth.uid()
  )
  or exists (
    select 1
    from public.phases ph
    where ph.id = p_phase_id
      and public.is_project_manager(ph.project_id)
  );
$$;

create or replace function public.can_view_lot(p_lot_id uuid)
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
      and public.is_project_member(ph.project_id)
  )
  and (
    exists (
      select 1
      from public.lots l2
      join public.phases ph2 on ph2.id = l2.phase_id
      where l2.id = p_lot_id
        and public.is_project_manager(ph2.project_id)
    )
    or exists (
      select 1
      from public.lots lpm
      join public.phases phpm on phpm.id = lpm.phase_id
      where lpm.id = p_lot_id
        and phpm.phase_manager_id = auth.uid()
        and public.is_project_member(phpm.project_id)
    )
    or exists (
      select 1
      from public.lots l3
      join public.phase_members pm on pm.phase_id = l3.phase_id
      where l3.id = p_lot_id
        and pm.user_id = auth.uid()
        and (
          pm.can_view_other_lots = true
          or p_lot_id = any(pm.assigned_lots)
          or pm.role in ('phase_manager')
        )
    )
    or exists (
      select 1
      from public.lots l4
      join public.phases ph4 on ph4.id = l4.phase_id
      join public.project_members pr on pr.project_id = ph4.project_id
      where l4.id = p_lot_id
        and pr.user_id = auth.uid()
        and lower(btrim(coalesce(pr.role,''))) = 'client'
        and lower(btrim(coalesce(pr.status,''))) in ('accepted','active')
    )
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
    from public.lots lpm
    join public.phases phpm on phpm.id = lpm.phase_id
    where lpm.id = p_lot_id
      and phpm.phase_manager_id = auth.uid()
      and public.is_project_member(phpm.project_id)
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

-- Ensure phase manager always has a phase_members row (UI + lots visibility).
create or replace function public.ensure_phase_manager_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.phase_manager_id is null then
    return new;
  end if;

  insert into public.phase_members (phase_id, user_id, role, can_edit, can_view_other_lots)
  values (new.id, new.phase_manager_id, 'phase_manager', true, true)
  on conflict (phase_id, user_id) do update
    set role = 'phase_manager',
        can_edit = true,
        can_view_other_lots = true;

  return new;
end;
$$;

drop trigger if exists phases_ensure_phase_manager_membership on public.phases;
create trigger phases_ensure_phase_manager_membership
after insert or update of phase_manager_id on public.phases
for each row
execute function public.ensure_phase_manager_membership();

-- Keep policy aligned (insert lots must check the phase permissions).
drop policy if exists lots_insert on public.lots;
create policy lots_insert
on public.lots
for insert
with check (public.can_edit_phase(phase_id));

commit;

notify pgrst, 'reload schema';

