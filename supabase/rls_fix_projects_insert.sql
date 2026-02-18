-- =============================================================================
-- Fix: "new row violates row-level security policy for table projects"
-- =============================================================================
-- IMPORTANT : ce fichier ne modifie pas ta base tout seul.
-- Tu DOIS exécuter ce SQL dans le projet Supabase :
--   1. Ouvre https://supabase.com/dashboard
--   2. Sélectionne ton projet (nextmind)
--   3. Menu de gauche : SQL Editor
--   4. New query
--   5. Copie-colle TOUT le bloc ci-dessous (entre BEGIN et COMMIT)
--   6. Clique sur Run (ou Ctrl+Enter)
-- =============================================================================

-- Optionnel : voir les politiques actuelles sur projects (avant correction)
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'projects';

begin;

-- Supprimer l'ancienne politique d'insert (celle qui exige is_pro())
drop policy if exists projects_insert on public.projects;

-- Nouvelle politique : tout utilisateur connecté peut créer un projet
-- dont il est le créateur (created_by = son propre id).
create policy projects_insert
on public.projects
for insert
with check (created_by = auth.uid());

commit;

-- =============================================================================
-- Si tu as ENCORE l'erreur après avoir exécuté le bloc ci-dessus :
-- décommenter et exécuter ce second bloc (politique encore plus permissive).
-- =============================================================================
/*
begin;
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert
with check (auth.uid() is not null);
commit;
*/
