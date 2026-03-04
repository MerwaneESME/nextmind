-- =============================================================================
-- Création de projet par un particulier (contourne RLS de façon contrôlée)
-- =============================================================================
-- À exécuter dans Supabase : Dashboard → ton projet → SQL Editor → New query.
-- Collez TOUT le script ci-dessous (de begin à commit inclus), puis Run.
--
-- Ce script :
--   1. Ajoute des colonnes optionnelles sur projects (postal_code, budget_min, etc.)
--   2. Crée la fonction public.rpc_create_project (SECURITY DEFINER)
--   3. Donne GRANT EXECUTE à authenticated pour que l'API expose la RPC
--
-- Si l'insert échoue avec "column total_budget does not exist", remplacez total_budget
-- par budget_total dans la liste des colonnes de l'INSERT.
--
-- Après exécution : en cas d'erreur "function not found in schema cache", redémarrez
-- le projet Supabase (Settings → General → Restart project) ou attendez quelques minutes.
-- =============================================================================

begin;

-- Colonnes optionnelles pour la demande de projet (particulier)
alter table public.projects
  add column if not exists postal_code text,
  add column if not exists budget_min numeric,
  add column if not exists desired_start_date date,
  add column if not exists surface_sqm numeric;

-- RPC : création projet par l'utilisateur connecté (particulier ou pro)
-- Utilise SECURITY DEFINER pour que l'insert ne soit pas bloqué par RLS.
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
  p_surface_sqm numeric default null
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
    v_user_id,
    'draft'
  )
  returning id into v_project_id;

  if v_project_id is null then
    raise exception 'Création du projet échouée';
  end if;

  -- Upsert : évite "duplicate key project_members_unique_project_user" (trigger ou double soumission)
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

-- Exposer la RPC à l'API (rôle authenticated = utilisateurs connectés)
grant execute on function public.rpc_create_project(text, text, text, text, text, text, numeric, numeric, date, numeric)
  to authenticated;

commit;
