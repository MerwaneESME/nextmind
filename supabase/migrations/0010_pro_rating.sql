-- Ajout des colonnes de note (1-5 étoiles) pour les profils pro
-- rating_avg : note moyenne (1 à 5)
-- rating_count : nombre d'avis
-- La vue public_pro_profiles (si elle existe) hérite des nouvelles colonnes via profiles.

begin;

alter table public.profiles
  add column if not exists rating_avg numeric(3,2) check (rating_avg is null or (rating_avg >= 1 and rating_avg <= 5)),
  add column if not exists rating_count integer default 0 check (rating_count is null or rating_count >= 0);

comment on column public.profiles.rating_avg is 'Note moyenne du pro (1 à 5 étoiles)';
comment on column public.profiles.rating_count is 'Nombre d''avis pour cette note';

-- Mise à jour des pros sans note : attribuer une note aléatoire entre 3 et 5
update public.profiles
set
  rating_avg = round((3 + random() * 2)::numeric, 2),
  rating_count = greatest(0, floor(random() * 50)::integer + 5)
where lower(coalesce(user_type, '')) = 'pro'
  and (rating_avg is null or rating_count is null or rating_count = 0);

commit;

notify pgrst, 'reload schema';
