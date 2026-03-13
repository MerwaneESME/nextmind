-- Drop the role CHECK constraint on project_members to allow custom role names
-- The constraint 'project_members_role_check' restricted roles to a fixed list
-- which conflicts with the custom roles feature (stored in projects.metadata).
alter table public.project_members
  drop constraint if exists project_members_role_check;
