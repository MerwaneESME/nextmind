-- Fix project_members unique constraint to allow one user across multiple projects.
-- Run in Supabase SQL editor (admin).

begin;

do $$
declare
  constraint_name text;
begin
  select conname
  into constraint_name
  from pg_constraint
  where conrelid = 'public.project_members'::regclass
    and contype = 'u'
    and conname = 'project_members_unique_user_id';

  if constraint_name is not null then
    execute format('alter table public.project_members drop constraint %I', constraint_name);
  end if;
end $$;

-- Optional: drop any existing unique index that only covers user_id.
drop index if exists public.project_members_unique_user_id;

alter table public.project_members
  add constraint project_members_unique_project_user unique (project_id, user_id);

commit;
