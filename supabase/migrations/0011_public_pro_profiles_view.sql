-- Vue public_pro_profiles : profils pro publics avec rating
-- Crée ou remplace la vue pour inclure rating_avg et rating_count.
-- Les colonnes doivent correspondre à ce que l'app attend : pro_id, display_name, company_name, city, postal_code, etc.

begin;

drop view if exists public.public_pro_profiles;

create view public.public_pro_profiles as
select
  p.id as pro_id,
  coalesce(p.display_name, p.company_name, p.full_name) as display_name,
  p.company_name,
  p.city,
  p.postal_code,
  p.company_description,
  p.company_website,
  p.email,
  p.phone,
  p.address,
  p.latitude,
  p.longitude,
  p.rating_avg,
  p.rating_count
from public.profiles p
where lower(coalesce(p.user_type, '')) = 'pro';

-- Grant pour anon/authenticated
grant select on public.public_pro_profiles to anon;
grant select on public.public_pro_profiles to authenticated;

commit;

notify pgrst, 'reload schema';
