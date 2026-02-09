-- ============================================================================
-- NextMind Supabase schema (single file)
-- This file is intended to be run in Supabase SQL Editor (admin role).
-- Generated from former supabase/migrations/*.sql on 2026-02-09 11:52:02
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/0000_fix_project_members_unique.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/0001_base_policies.sql
-- ---------------------------------------------------------------------------
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
      and lower(btrim(coalesce(pm.status, ''))) not in ('declined', 'removed')
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
      and lower(btrim(coalesce(pm.role, ''))) in ('owner', 'collaborator', 'pro', 'professionnel')
      and lower(btrim(coalesce(pm.status, ''))) in ('accepted', 'active')
  )
  or exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.projects p2
    where p2.id = p_project_id
      and p2.project_manager_id = auth.uid()
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

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/0002_phases_lots_schema.sql
-- ---------------------------------------------------------------------------
-- Schema additions for Projet â†’ Phases â†’ Lots (v1).
-- Apply in Supabase SQL editor with an admin role.

begin;

-- Projects (enrich existing table)
alter table public.projects
  add column if not exists client_name text,
  add column if not exists client_email text,
  add column if not exists client_phone text,
  add column if not exists total_budget numeric,
  add column if not exists project_manager_id uuid references public.profiles(id),
  add column if not exists status_v2 text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conname = 'projects_status_v2_check'
      and c.conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_status_v2_check
      check (status_v2 is null or status_v2 = any (array['planification','en_cours','termine','archive']));
  end if;
end
$$;

-- Phases
create table if not exists public.phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  phase_order integer not null default 1,
  start_date date,
  end_date date,
  estimated_duration_days integer,
  budget_estimated numeric not null default 0,
  budget_actual numeric not null default 0,
  status text not null default 'planifiee'
    check (status = any (array['planifiee','devis','validee','en_cours','terminee','receptionnee'])),
  phase_manager_id uuid references public.profiles(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists phases_project_idx on public.phases(project_id);
create index if not exists phases_status_idx on public.phases(status);

-- Lots
create table if not exists public.lots (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases(id) on delete cascade,
  name text not null,
  description text,
  lot_type text,
  company_name text,
  company_contact_name text,
  company_contact_email text,
  company_contact_phone text,
  responsible_user_id uuid references public.profiles(id),
  start_date date,
  end_date date,
  estimated_duration_days integer,
  actual_duration_days integer,
  delay_days integer not null default 0,
  budget_estimated numeric not null default 0,
  budget_actual numeric not null default 0,
  status text not null default 'planifie'
    check (status = any (array['planifie','devis_en_cours','devis_valide','en_cours','termine','valide'])),
  progress_percentage integer not null default 0 check (progress_percentage >= 0 and progress_percentage <= 100),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists lots_phase_idx on public.lots(phase_id);
create index if not exists lots_status_idx on public.lots(status);
create index if not exists lots_responsible_idx on public.lots(responsible_user_id);

-- Lot tasks (separate from existing project_tasks)
create table if not exists public.lot_tasks (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots(id) on delete cascade,
  title text not null,
  description text,
  order_index integer not null default 0,
  status text not null default 'todo' check (status = any (array['todo','in_progress','done'])),
  assigned_to uuid references public.profiles(id),
  due_date date,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists lot_tasks_lot_idx on public.lot_tasks(lot_id);
create index if not exists lot_tasks_status_idx on public.lot_tasks(status);

-- Quotes (new model, independent of existing devis for now)
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots(id) on delete cascade,
  quote_number text,
  title text not null,
  amount numeric not null default 0,
  status text not null default 'en_attente' check (status = any (array['en_attente','valide','refuse'])),
  file_url text,
  issued_date date,
  valid_until date,
  validated_at timestamp with time zone,
  validated_by uuid references public.profiles(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists quotes_quote_number_uq on public.quotes(quote_number) where quote_number is not null;
create index if not exists quotes_lot_idx on public.quotes(lot_id);
create index if not exists quotes_status_idx on public.quotes(status);

-- Invoices (new model, independent of existing factures for now)
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots(id) on delete cascade,
  quote_id uuid references public.quotes(id),
  invoice_number text,
  title text not null,
  amount numeric not null default 0,
  status text not null default 'emise' check (status = any (array['emise','validee','payee','contestee'])),
  file_url text,
  issued_date date,
  due_date date,
  paid_date date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists invoices_invoice_number_uq on public.invoices(invoice_number) where invoice_number is not null;
create index if not exists invoices_lot_idx on public.invoices(lot_id);
create index if not exists invoices_status_idx on public.invoices(status);

-- Phase members (granular permissions)
create table if not exists public.phase_members (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role = any (array['entreprise','sous_traitant','observateur','phase_manager'])),
  can_edit boolean not null default false,
  can_view_other_lots boolean not null default false,
  assigned_lots uuid[] not null default '{}'::uuid[],
  created_at timestamp with time zone not null default now(),
  unique(phase_id, user_id)
);

create index if not exists phase_members_phase_idx on public.phase_members(phase_id);
create index if not exists phase_members_user_idx on public.phase_members(user_id);

commit;

-- PostgREST schema cache reload (utile dans l'Ã©diteur SQL Supabase)
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/0003_phases_lots_policies.sql
-- ---------------------------------------------------------------------------
-- RLS policies for Projet â†’ Phases â†’ Lots (v1).
-- Apply after `phases_lots_schema.sql` in Supabase SQL editor with an admin role.

begin;

-- Helpers
create or replace function public.is_phase_member(p_phase_id uuid)
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
  );
$$;

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
    -- Project manager sees everything
    exists (
      select 1
      from public.lots l2
      join public.phases ph2 on ph2.id = l2.phase_id
      where l2.id = p_lot_id
        and public.is_project_manager(ph2.project_id)
    )
    -- Phase manager (direct on phase) sees everything in the phase
    or exists (
      select 1
      from public.lots lpm
      join public.phases phpm on phpm.id = lpm.phase_id
      where lpm.id = p_lot_id
        and phpm.phase_manager_id = auth.uid()
        and public.is_project_member(phpm.project_id)
    )
    -- Phase member sees assigned lots, or all lots if allowed
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
    -- Client (project member role=client) sees all lots read-only
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
  -- Project manager can edit all lots
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

-- Ensure phase manager always has a phase_members row (for UI lists, lots visibility, etc.)
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

-- Enable RLS
alter table public.phases enable row level security;
alter table public.lots enable row level security;
alter table public.lot_tasks enable row level security;
alter table public.quotes enable row level security;
alter table public.invoices enable row level security;
alter table public.phase_members enable row level security;

-- Phases: project members can read; managers/phase editors can write
drop policy if exists phases_select on public.phases;
create policy phases_select
on public.phases
for select
using (
  public.is_project_member(project_id)
  or public.is_project_invited(project_id)
  or public.is_project_manager(project_id)
);

drop policy if exists phases_insert on public.phases;
create policy phases_insert
on public.phases
for insert
with check (public.is_project_manager(project_id));

drop policy if exists phases_update on public.phases;
create policy phases_update
on public.phases
for update
using (public.can_edit_phase(id))
with check (public.can_edit_phase(id));

drop policy if exists phases_delete on public.phases;
create policy phases_delete
on public.phases
for delete
using (public.can_edit_phase(id));

-- Phase members: project manager manages; users can read their own membership
drop policy if exists phase_members_select on public.phase_members;
create policy phase_members_select
on public.phase_members
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.phases ph
    where ph.id = phase_id and public.is_project_manager(ph.project_id)
  )
);

drop policy if exists phase_members_insert on public.phase_members;
create policy phase_members_insert
on public.phase_members
for insert
with check (
  exists (
    select 1
    from public.phases ph
    where ph.id = phase_id and public.is_project_manager(ph.project_id)
  )
);

drop policy if exists phase_members_update on public.phase_members;
create policy phase_members_update
on public.phase_members
for update
using (
  exists (
    select 1
    from public.phases ph
    where ph.id = phase_id and public.is_project_manager(ph.project_id)
  )
)
with check (
  exists (
    select 1
    from public.phases ph
    where ph.id = phase_id and public.is_project_manager(ph.project_id)
  )
);

drop policy if exists phase_members_delete on public.phase_members;
create policy phase_members_delete
on public.phase_members
for delete
using (
  exists (
    select 1
    from public.phases ph
    where ph.id = phase_id and public.is_project_manager(ph.project_id)
  )
);

-- Lots: view based on phase membership rules; write based on can_edit_lot
drop policy if exists lots_select on public.lots;
create policy lots_select
on public.lots
for select
using (public.can_view_lot(id));

drop policy if exists lots_insert on public.lots;
create policy lots_insert
on public.lots
for insert
with check (
  public.can_edit_phase(phase_id)
);

drop policy if exists lots_update on public.lots;
create policy lots_update
on public.lots
for update
using (public.can_edit_lot(id))
with check (public.can_edit_lot(id));

drop policy if exists lots_delete on public.lots;
create policy lots_delete
on public.lots
for delete
using (public.can_edit_lot(id));

-- Lot tasks: inherit lot access
drop policy if exists lot_tasks_select on public.lot_tasks;
create policy lot_tasks_select
on public.lot_tasks
for select
using (public.can_view_lot(lot_id));

drop policy if exists lot_tasks_insert on public.lot_tasks;
create policy lot_tasks_insert
on public.lot_tasks
for insert
with check (public.can_edit_lot(lot_id));

drop policy if exists lot_tasks_update on public.lot_tasks;
create policy lot_tasks_update
on public.lot_tasks
for update
using (public.can_edit_lot(lot_id))
with check (public.can_edit_lot(lot_id));

drop policy if exists lot_tasks_delete on public.lot_tasks;
create policy lot_tasks_delete
on public.lot_tasks
for delete
using (public.can_edit_lot(lot_id));

-- Quotes / invoices: inherit lot access
drop policy if exists quotes_select on public.quotes;
create policy quotes_select
on public.quotes
for select
using (public.can_view_lot(lot_id));

drop policy if exists quotes_write on public.quotes;
create policy quotes_write
on public.quotes
for all
using (public.can_edit_lot(lot_id))
with check (public.can_edit_lot(lot_id));

drop policy if exists invoices_select on public.invoices;
create policy invoices_select
on public.invoices
for select
using (public.can_view_lot(lot_id));

drop policy if exists invoices_write on public.invoices;
create policy invoices_write
on public.invoices
for all
using (public.can_edit_lot(lot_id))
with check (public.can_edit_lot(lot_id));

commit;

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/0004_migrate_projects_to_phases_lots.sql
-- ---------------------------------------------------------------------------
-- One-time migration helper: convert existing 1-project model into Project â†’ Phase â†’ Lot.
-- Apply AFTER creating phases/lots tables. Review before running in production.

begin;

-- Create a main phase for projects that have no phases yet.
insert into public.phases (project_id, name, description, phase_order, start_date, end_date, budget_estimated, status, phase_manager_id)
select
  p.id,
  'Phase principale',
  'Migration automatique (ancien modÃ¨le)',
  1,
  coalesce(p.start_date, (p.created_at::date)),
  coalesce(p.end_date, (coalesce(p.start_date, (p.created_at::date)) + interval '90 days')::date),
  coalesce(p.total_budget, p.budget_total, 0),
  case
    when lower(coalesce(p.status,'')) in ('completed','termine','done') then 'terminee'
    when lower(coalesce(p.status,'')) in ('in_progress','en_cours','active') then 'en_cours'
    else 'planifiee'
  end,
  p.created_by
from public.projects p
where not exists (select 1 from public.phases ph where ph.project_id = p.id);

-- Create a main lot for phases created above (when lots absent).
insert into public.lots (phase_id, name, description, lot_type, company_name, start_date, end_date, budget_estimated, status, progress_percentage)
select
  ph.id,
  p.name,
  p.description,
  p.project_type,
  'Ã€ dÃ©finir',
  coalesce(p.start_date, (p.created_at::date)),
  coalesce(p.end_date, (coalesce(p.start_date, (p.created_at::date)) + interval '90 days')::date),
  coalesce(p.total_budget, p.budget_total, 0),
  case
    when lower(coalesce(p.status,'')) in ('completed','termine','done') then 'termine'
    when lower(coalesce(p.status,'')) in ('in_progress','en_cours','active') then 'en_cours'
    else 'planifie'
  end,
  0
from public.phases ph
join public.projects p on p.id = ph.project_id
where ph.name = 'Phase principale'
  and not exists (select 1 from public.lots l where l.phase_id = ph.id);

commit;

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/0005_add_context_to_messages_documents.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- Migration: Ajouter contexte phase/lot aux messages et documents
-- Compatible Postgres (Ã©vite ADD CONSTRAINT IF NOT EXISTS).
-- ============================================================================

begin;

-- 0) Tables (create if missing)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  attachments text[] not null default '{}'::text[],
  project_id uuid references public.projects(id) on delete cascade,
  phase_id uuid references public.phases(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_url text not null,
  storage_path text,
  file_type text not null default 'autre'::text,
  file_size integer not null default 0,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  phase_id uuid references public.phases(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- 1) Ajouter colonnes de contexte si les tables existaient dÃ©jÃ 
alter table public.messages
  add column if not exists author_id uuid references public.profiles(id) on delete cascade,
  add column if not exists content text,
  add column if not exists attachments text[] not null default '{}'::text[],
  add column if not exists project_id uuid references public.projects(id) on delete cascade,
  add column if not exists phase_id uuid references public.phases(id) on delete cascade,
  add column if not exists lot_id uuid references public.lots(id) on delete cascade,
  add column if not exists created_at timestamp with time zone not null default now(),
  add column if not exists updated_at timestamp with time zone not null default now();

alter table public.documents
  add column if not exists name text,
  add column if not exists content text not null default ''::text,
  add column if not exists file_url text,
  add column if not exists file_type text not null default 'autre'::text,
  add column if not exists file_size integer not null default 0,
  add column if not exists uploaded_by uuid references public.profiles(id) on delete cascade,
  add column if not exists project_id uuid references public.projects(id) on delete cascade,
  add column if not exists phase_id uuid references public.phases(id) on delete cascade,
  add column if not exists lot_id uuid references public.lots(id) on delete cascade,
  add column if not exists storage_path text,
  add column if not exists created_at timestamp with time zone not null default now(),
  add column if not exists updated_at timestamp with time zone not null default now();

-- 1b) Ensure `id` has a default generator (important when the table already existed)
do $$
declare
  messages_id_type text;
  documents_id_type text;
begin
  select c.data_type
  into messages_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'messages'
    and c.column_name = 'id';

  if messages_id_type = 'uuid' then
    execute 'alter table public.messages alter column id set default gen_random_uuid()';
  elsif messages_id_type in ('text','character varying') then
    execute 'alter table public.messages alter column id set default gen_random_uuid()::text';
  end if;

  select c.data_type
  into documents_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'documents'
    and c.column_name = 'id';

  if documents_id_type = 'uuid' then
    execute 'alter table public.documents alter column id set default gen_random_uuid()';
  elsif documents_id_type in ('text','character varying') then
    execute 'alter table public.documents alter column id set default gen_random_uuid()::text';
  end if;
end
$$;

-- 1c) Ensure `content` has a safe default (some legacy schemas require it NOT NULL)
do $$
declare
  documents_content_type text;
begin
  select c.data_type
  into documents_content_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'documents'
    and c.column_name = 'content';

  if documents_content_type in ('text','character varying') then
    execute 'alter table public.documents alter column content set default ''''::text';
    -- In case legacy data contains NULLs
    execute 'update public.documents set content = ''''::text where content is null';
  end if;
end
$$;

-- 1d) Relax legacy embedding constraint if present (not required for basic Documents feature)
do $$
declare
  embedding_nullable text;
begin
  select c.is_nullable
  into embedding_nullable
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'documents'
    and c.column_name = 'embedding';

  if embedding_nullable = 'NO' then
    execute 'alter table public.documents alter column embedding drop not null';
  end if;
end
$$;

-- 2) Index pour performances
create index if not exists idx_messages_project on public.messages(project_id);
create index if not exists idx_messages_phase on public.messages(phase_id);
create index if not exists idx_messages_lot on public.messages(lot_id);

create index if not exists idx_documents_project on public.documents(project_id);
create index if not exists idx_documents_phase on public.documents(phase_id);
create index if not exists idx_documents_lot on public.documents(lot_id);
create index if not exists idx_documents_file_type on public.documents(file_type);

-- 3) Contraintes: un message/document appartient Ã  UN SEUL contexte
do $$
begin
  -- Normalize legacy data so we can add/validate the constraint.
  -- Precedence: lot > phase > project.
  update public.messages
    set project_id = null,
        phase_id = null
  where lot_id is not null;

  update public.messages
    set project_id = null,
        lot_id = null
  where lot_id is null and phase_id is not null;

  update public.messages
    set phase_id = null,
        lot_id = null
  where lot_id is null and phase_id is null and project_id is not null;

  if not exists (
    select 1 from pg_constraint c
    where c.conname = 'check_message_single_context'
      and c.conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint check_message_single_context
      check (
        (project_id is not null and phase_id is null and lot_id is null)
        or (project_id is null and phase_id is not null and lot_id is null)
        or (project_id is null and phase_id is null and lot_id is not null)
      )
      not valid;
  end if;

  begin
    alter table public.messages validate constraint check_message_single_context;
  exception when others then
    raise notice 'check_message_single_context left NOT VALID (some rows still violate).';
  end;
end
$$;

do $$
begin
  -- Normalize legacy data so we can add/validate the constraint.
  -- Precedence: lot > phase > project.
  update public.documents
    set project_id = null,
        phase_id = null
  where lot_id is not null;

  update public.documents
    set project_id = null,
        lot_id = null
  where lot_id is null and phase_id is not null;

  update public.documents
    set phase_id = null,
        lot_id = null
  where lot_id is null and phase_id is null and project_id is not null;

  if not exists (
    select 1 from pg_constraint c
    where c.conname = 'check_document_single_context'
      and c.conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint check_document_single_context
      check (
        (project_id is not null and phase_id is null and lot_id is null)
        or (project_id is null and phase_id is not null and lot_id is null)
        or (project_id is null and phase_id is null and lot_id is not null)
      )
      not valid;
  end if;

  begin
    alter table public.documents validate constraint check_document_single_context;
  exception when others then
    raise notice 'check_document_single_context left NOT VALID (some rows still violate).';
  end;
end
$$;

-- 4) Commentaires
comment on column public.messages.phase_id is 'ID de la phase si message contextualisÃ© phase';
comment on column public.messages.lot_id is 'ID du lot si message contextualisÃ© lot';
comment on column public.documents.phase_id is 'ID de la phase si document contextualisÃ© phase';
comment on column public.documents.lot_id is 'ID du lot si document contextualisÃ© lot';
comment on column public.documents.storage_path is 'Chemin storage (bucket) pour suppression';

-- 5) Migration legacy: project_messages -> messages (niveau projet)
do $$
declare
  col_project text;
  col_sender text;
  col_message text;
  col_created text;
begin
  if exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = 'project_messages'
  ) then
    -- Detect column names (some databases use camelCase or different conventions)
    select
      case
        when exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='project_messages' and c.column_name='project_id') then 'project_id'
        when exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='project_messages' and c.column_name='projectId') then 'projectId'
        when exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='project_messages' and c.column_name='project') then 'project'
        else null
      end,
      case
        when exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='project_messages' and c.column_name='sender_id') then 'sender_id'
        when exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='project_messages' and c.column_name='author_id') then 'author_id'
        when exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='project_messages' and c.column_name='user_id') then 'user_id'
        else null
      end,
      case
        when exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='project_messages' and c.column_name='message') then 'message'
        when exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='project_messages' and c.column_name='content') then 'content'
        else null
      end,
      case
        when exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='project_messages' and c.column_name='created_at') then 'created_at'
        when exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='project_messages' and c.column_name='createdAt') then 'createdAt'
        else null
      end
    into col_project, col_sender, col_message, col_created;

    if col_project is null or col_sender is null or col_message is null then
      raise notice 'Skip legacy migration: public.project_messages schema not recognized (project=% sender=% message=%).', col_project, col_sender, col_message;
    else
      execute format(
        'insert into public.messages (id, author_id, content, attachments, project_id, phase_id, lot_id, created_at, updated_at)
         select pm.id, pm.%1$I, pm.%2$I, ''{}''::text[], pm.%3$I, null, null, %4$s, %4$s
         from public.project_messages pm
         where pm.%1$I is not null
         on conflict (id) do nothing;',
        col_sender,
        col_message,
        col_project,
        case when col_created is null then 'now()' else format('pm.%I', col_created) end
      );
    end if;
  end if;
end
$$;

commit;

-- PostgREST schema cache reload (utile dans l'Ã©diteur SQL Supabase)
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/0006_add_context_policies.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- Policies RLS pour messages et documents contextualisÃ©s
-- DÃ©pendances attendues:
-- - public.is_project_member(uuid)
-- - public.is_project_manager(uuid)
-- - public.is_phase_member(uuid) (crÃ©Ã©e dans phases_lots_policies.sql)
-- - public.can_view_lot(uuid)
-- - public.can_edit_phase(uuid)
-- - public.can_edit_lot(uuid)
-- ============================================================================

begin;

alter table public.messages enable row level security;
alter table public.documents enable row level security;

-- Helpers (phase view)
create or replace function public.can_view_phase(p_phase_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.phases ph
    join public.projects p on p.id = ph.project_id
    where ph.id = p_phase_id
      and (
        public.is_project_manager(p.id)
        or public.is_phase_member(ph.id)
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p.id
            and pm.user_id = auth.uid()
            and lower(btrim(coalesce(pm.role,''))) = 'client'
            and lower(btrim(coalesce(pm.status,''))) in ('accepted','active')
        )
      )
  );
$$;

-- ====================
-- MESSAGES
-- ====================

drop policy if exists select_messages_by_context on public.messages;
create policy select_messages_by_context
on public.messages
for select
using (
  (project_id is not null and (public.is_project_member(project_id) or public.is_project_manager(project_id)))
  or (phase_id is not null and public.can_view_phase(phase_id))
  or (lot_id is not null and public.can_view_lot(lot_id))
);

drop policy if exists insert_messages_by_context on public.messages;
create policy insert_messages_by_context
on public.messages
for insert
with check (
  author_id = auth.uid()
  and (
    (project_id is not null and (public.is_project_member(project_id) or public.is_project_manager(project_id)))
    or (phase_id is not null and public.can_edit_phase(phase_id))
    or (lot_id is not null and public.can_edit_lot(lot_id))
  )
);

drop policy if exists update_own_messages on public.messages;
create policy update_own_messages
on public.messages
for update
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists delete_own_messages on public.messages;
create policy delete_own_messages
on public.messages
for delete
using (author_id = auth.uid());

-- ====================
-- DOCUMENTS
-- ====================

drop policy if exists select_documents_by_context on public.documents;
create policy select_documents_by_context
on public.documents
for select
using (
  (project_id is not null and (public.is_project_member(project_id) or public.is_project_manager(project_id)))
  or (phase_id is not null and public.can_view_phase(phase_id))
  or (lot_id is not null and public.can_view_lot(lot_id))
);

drop policy if exists insert_documents_by_context on public.documents;
create policy insert_documents_by_context
on public.documents
for insert
with check (
  uploaded_by = auth.uid()
  and (
    (project_id is not null and (public.is_project_member(project_id) or public.is_project_manager(project_id)))
    or (phase_id is not null and public.can_edit_phase(phase_id))
    or (lot_id is not null and public.can_edit_lot(lot_id))
  )
);

drop policy if exists delete_documents_by_permission on public.documents;
create policy delete_documents_by_permission
on public.documents
for delete
using (
  uploaded_by = auth.uid()
  or (project_id is not null and public.is_project_manager(project_id))
  or (
    phase_id is not null
    and exists (
      select 1
      from public.phases ph
      where ph.id = documents.phase_id
        and public.is_project_manager(ph.project_id)
    )
  )
  or (
    lot_id is not null
    and exists (
      select 1
      from public.lots l
      join public.phases ph on ph.id = l.phase_id
      where l.id = documents.lot_id
        and public.is_project_manager(ph.project_id)
    )
  )
);

commit;

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/0007_backfill_phase_lot_dates.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- Backfill dates for migrated phases/lots (legacy projects often have NULL dates)
-- Safe to run multiple times.
-- ============================================================================

begin;

-- Phase dates: fill from project dates or project.created_at (+90 days fallback)
update public.phases ph
set
  start_date = coalesce(ph.start_date, p.start_date, (p.created_at::date)),
  end_date = coalesce(
    ph.end_date,
    p.end_date,
    (coalesce(ph.start_date, p.start_date, (p.created_at::date)) + interval '90 days')::date
  )
from public.projects p
where p.id = ph.project_id
  and (ph.start_date is null or ph.end_date is null);

-- Lot dates: fill from parent phase (or project) if missing
update public.lots l
set
  start_date = coalesce(l.start_date, ph.start_date, p.start_date, (p.created_at::date)),
  end_date = coalesce(
    l.end_date,
    ph.end_date,
    p.end_date,
    (coalesce(l.start_date, ph.start_date, p.start_date, (p.created_at::date)) + interval '90 days')::date
  )
from public.phases ph
join public.projects p on p.id = ph.project_id
where ph.id = l.phase_id
  and (l.start_date is null or l.end_date is null);

commit;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/0008_create_documents_storage_bucket.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- Optional helper: create the Storage bucket used by DocumentsList.
-- If you already have a bucket, you can skip this and set
-- NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET accordingly.
-- ============================================================================

-- Create bucket if missing (Supabase Storage)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/0009_documents_storage_policies.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- Supabase Storage policies for the `documents` bucket
-- This fixes "new row violates row-level security policy" during upload.
-- ============================================================================

begin;

-- Allow authenticated users to upload files to bucket `documents`.
-- Supabase sets `owner` automatically to auth.uid() on upload.
drop policy if exists documents_objects_insert on storage.objects;
create policy documents_objects_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and auth.uid() = owner
);

-- Allow owners to delete their own uploaded files (optional but useful).
drop policy if exists documents_objects_delete on storage.objects;
create policy documents_objects_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and auth.uid() = owner
);

commit;
