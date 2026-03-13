-- Add metadata JSONB to projects (persists custom roles, config)
alter table public.projects
  add column if not exists metadata jsonb default '{}';

-- Add task_type and attendees to project_tasks (RDV support)
alter table public.project_tasks
  add column if not exists task_type text default 'task',
  add column if not exists attendees jsonb default '[]';
