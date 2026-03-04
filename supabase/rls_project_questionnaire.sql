-- =============================================================================
-- Questionnaire adapté par type de travaux (projet particulier)
-- =============================================================================
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query.
-- Ce script ajoute la colonne questionnaire_data et met à jour la RPC.
-- =============================================================================

begin;

-- Colonne pour stocker les réponses au questionnaire (champs spécifiques par type)
alter table public.projects
  add column if not exists questionnaire_data jsonb default '{}';

-- Mise à jour de la RPC pour accepter questionnaire_data
create or replace function public.rpc_create_project(
  p_name text,
  p_description text default null,
  p_project_type text default null,
  p_address text default null,
  p_city text default null,
  p_postal_code text default null,
  p_budget_min numeric default null,
  p_budget_max numeric default null,
  p_desired_start_date date default null,
  p_surface_sqm numeric default null,
  p_questionnaire_data jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_project_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  insert into public.projects (
    name,
    description,
    project_type,
    address,
    city,
    postal_code,
    budget_min,
    total_budget,
    desired_start_date,
    surface_sqm,
    questionnaire_data,
    created_by,
    status
  ) values (
    nullif(trim(p_name), ''),
    nullif(trim(p_description), ''),
    nullif(trim(p_project_type), ''),
    nullif(trim(p_address), ''),
    nullif(trim(p_city), ''),
    nullif(trim(p_postal_code), ''),
    p_budget_min,
    p_budget_max,
    p_desired_start_date,
    p_surface_sqm,
    coalesce(p_questionnaire_data, '{}'),
    v_user_id,
    'draft'
  )
  returning id into v_project_id;

  if v_project_id is null then
    raise exception 'Création du projet échouée';
  end if;

  insert into public.project_members (
    project_id,
    user_id,
    role,
    status,
    invited_by,
    accepted_at
  ) values (
    v_project_id,
    v_user_id,
    'owner',
    'accepted',
    v_user_id,
    now()
  )
  on conflict (project_id, user_id) do update set
    role = excluded.role,
    status = excluded.status,
    invited_by = excluded.invited_by,
    accepted_at = excluded.accepted_at;

  return v_project_id;
end;
$$;

grant execute on function public.rpc_create_project(text, text, text, text, text, text, numeric, numeric, date, numeric, jsonb)
  to authenticated;

commit;
