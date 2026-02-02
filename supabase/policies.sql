-- RLS policies for messaging and project collaboration.
-- Apply in Supabase SQL editor with an admin role.

begin;

create or replace function public.current_email()
returns text
language sql
stable
as $$
  select lower((auth.jwt() ->> 'email')::text);
$$;

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and coalesce(pm.status, '') not in ('declined', 'removed')
  );
$$;

create or replace function public.is_project_invited(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and lower(coalesce(pm.invited_email, '')) = public.current_email()
  );
$$;

create or replace function public.is_project_manager(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and lower(coalesce(pm.role, '')) in ('owner', 'collaborator', 'pro', 'professionnel')
      and coalesce(pm.status, '') in ('accepted', 'active')
  )
  or exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.created_by = auth.uid()
  );
$$;

create or replace function public.is_pro()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and lower(coalesce(pr.user_type, '')) = 'pro'
  );
$$;

create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.network_conversation_members m
    where m.conversation_id = p_conversation_id
      and m.user_id = auth.uid()
  );
$$;

-- Projects
alter table public.projects enable row level security;

drop policy if exists projects_select on public.projects;
create policy projects_select
on public.projects
for select
using (
  public.is_project_member(id)
  or public.is_project_invited(id)
  or created_by = auth.uid()
);

drop policy if exists projects_insert on public.projects;
create policy projects_insert
on public.projects
for insert
with check (
  public.is_pro()
  and created_by = auth.uid()
);

drop policy if exists projects_update on public.projects;
create policy projects_update
on public.projects
for update
using (public.is_project_manager(id))
with check (public.is_project_manager(id));

drop policy if exists projects_delete on public.projects;
create policy projects_delete
on public.projects
for delete
using (public.is_project_manager(id));

-- Project members
alter table public.project_members enable row level security;

drop policy if exists project_members_select on public.project_members;
create policy project_members_select
on public.project_members
for select
using (
  public.is_project_member(project_id)
  or public.is_project_invited(project_id)
);

drop policy if exists project_members_insert on public.project_members;
create policy project_members_insert
on public.project_members
for insert
with check (public.is_project_manager(project_id));

drop policy if exists project_members_update on public.project_members;
create policy project_members_update
on public.project_members
for update
using (
  public.is_project_manager(project_id)
  or user_id = auth.uid()
  or lower(coalesce(invited_email, '')) = public.current_email()
)
with check (
  public.is_project_manager(project_id)
  or user_id = auth.uid()
  or lower(coalesce(invited_email, '')) = public.current_email()
);

drop policy if exists project_members_delete on public.project_members;
create policy project_members_delete
on public.project_members
for delete
using (public.is_project_manager(project_id));

-- Project messages
alter table public.project_messages enable row level security;

drop policy if exists project_messages_select on public.project_messages;
create policy project_messages_select
on public.project_messages
for select
using (public.is_project_member(project_id));

drop policy if exists project_messages_insert on public.project_messages;
create policy project_messages_insert
on public.project_messages
for insert
with check (
  public.is_project_member(project_id)
  and sender_id = auth.uid()
);

drop policy if exists project_messages_delete on public.project_messages;
create policy project_messages_delete
on public.project_messages
for delete
using (public.is_project_manager(project_id));

-- Project tasks
alter table public.project_tasks enable row level security;

drop policy if exists project_tasks_select on public.project_tasks;
create policy project_tasks_select
on public.project_tasks
for select
using (public.is_project_member(project_id));

drop policy if exists project_tasks_insert on public.project_tasks;
create policy project_tasks_insert
on public.project_tasks
for insert
with check (public.is_project_manager(project_id));

drop policy if exists project_tasks_update on public.project_tasks;
create policy project_tasks_update
on public.project_tasks
for update
using (public.is_project_manager(project_id))
with check (public.is_project_manager(project_id));

drop policy if exists project_tasks_delete on public.project_tasks;
create policy project_tasks_delete
on public.project_tasks
for delete
using (public.is_project_manager(project_id));

-- Project tags
alter table public.project_tags enable row level security;

drop policy if exists project_tags_select on public.project_tags;
create policy project_tags_select
on public.project_tags
for select
using (public.is_project_member(project_id));

drop policy if exists project_tags_insert on public.project_tags;
create policy project_tags_insert
on public.project_tags
for insert
with check (public.is_project_manager(project_id));

drop policy if exists project_tags_delete on public.project_tags;
create policy project_tags_delete
on public.project_tags
for delete
using (public.is_project_manager(project_id));

-- Devis (allow detaching project)
drop policy if exists devis_update_project on public.devis;
create policy devis_update_project
on public.devis
for update
using (
  user_id = auth.uid()
  or (project_id is not null and public.is_project_manager(project_id))
)
with check (
  user_id = auth.uid()
  or (project_id is not null and public.is_project_manager(project_id))
);

-- Network conversations (messagerie)
alter table public.network_conversations enable row level security;
alter table public.network_conversation_members enable row level security;
alter table public.network_messages enable row level security;

drop policy if exists network_conversations_select on public.network_conversations;
create policy network_conversations_select
on public.network_conversations
for select
using (public.is_conversation_member(id));

drop policy if exists network_conversations_insert on public.network_conversations;
create policy network_conversations_insert
on public.network_conversations
for insert
with check (auth.uid() is not null);

drop policy if exists network_conversation_members_select on public.network_conversation_members;
create policy network_conversation_members_select
on public.network_conversation_members
for select
using (public.is_conversation_member(conversation_id));

drop policy if exists network_conversation_members_insert on public.network_conversation_members;
create policy network_conversation_members_insert
on public.network_conversation_members
for insert
with check (
  auth.uid() = user_id
  or public.is_conversation_member(conversation_id)
);

drop policy if exists network_messages_select on public.network_messages;
create policy network_messages_select
on public.network_messages
for select
using (public.is_conversation_member(conversation_id));

drop policy if exists network_messages_insert on public.network_messages;
create policy network_messages_insert
on public.network_messages
for insert
with check (
  public.is_conversation_member(conversation_id)
  and sender_id = auth.uid()
);

commit;
