-- Seed data for NextMind (dev/test).
-- Assumes you run this with service role privileges on an empty database.

begin;

alter table public.profiles
  add column if not exists display_name text;

create temp table seed_users (
  id uuid primary key,
  email text not null,
  full_name text,
  company_name text,
  user_type text not null,
  phone text,
  city text,
  postal_code text,
  address text,
  company_website text,
  company_description text,
  siret text,
  public_portfolio_enabled boolean,
  tier text,
  trade_primary text,
  trade_secondary text,
  trade_tertiary text
);

insert into seed_users (
  id,
  email,
  full_name,
  company_name,
  user_type,
  phone,
  city,
  postal_code,
  address,
  company_website,
  company_description,
  siret,
  public_portfolio_enabled,
  tier,
  trade_primary,
  trade_secondary,
  trade_tertiary
) values
  ('00000000-0000-0000-0000-000000000101', 'pro01@nextmind.test', 'Alex Martin', 'Atelier Nord Renovation', 'pro', '01 10 11 11 01', 'Paris', '75011', '10 Rue des Lilas', 'https://atelier-nord-renovation.test', 'Renovation complete, suivi de chantier et peinture interieure.', '81000000000001', true, 'A', 'renovation', 'peinture', 'plomberie'),
  ('00000000-0000-0000-0000-000000000102', 'pro02@nextmind.test', 'Benoit Leroy', 'Beta Electricite', 'pro', '01 10 11 11 02', 'Lyon', '69003', '22 Rue de la Republique', 'https://beta-electricite.test', 'Electricite batiment, mise aux normes et domotique.', '81000000000002', true, 'A', 'electricite', 'domotique', 'solaire'),
  ('00000000-0000-0000-0000-000000000103', 'pro03@nextmind.test', 'Claire Lopez', 'Cobalt Plomberie', 'pro', '01 10 11 11 03', 'Marseille', '13006', '33 Rue du Prado', 'https://cobalt-plomberie.test', 'Plomberie generale, depannage et chauffage.', '81000000000003', true, 'A', 'plomberie', 'chauffage', 'etancheite'),
  ('00000000-0000-0000-0000-000000000104', 'pro04@nextmind.test', 'David Roux', 'Delta Maconnerie', 'pro', '01 10 11 11 04', 'Lille', '59000', '44 Rue Nationale', 'https://delta-maconnerie.test', 'Maconnerie structurelle et gros oeuvre.', '81000000000004', true, 'A', 'maconnerie', 'gros_oeuvre', 'terrassement'),
  ('00000000-0000-0000-0000-000000000105', 'pro05@nextmind.test', 'Emma Petit', 'Epsilon Toiture', 'pro', '01 10 11 11 05', 'Bordeaux', '33000', '55 Rue Sainte Catherine', 'https://epsilon-toiture.test', 'Toiture, charpente et zinguerie.', '81000000000005', true, 'A', 'toiture', 'charpente', 'zinguerie'),
  ('00000000-0000-0000-0000-000000000106', 'pro06@nextmind.test', 'Fabien Brun', 'Futura Menuiserie', 'pro', '01 10 11 11 06', 'Nantes', '44000', '11 Rue de la Loire', 'https://futura-menuiserie.test', 'Menuiserie sur mesure, parquet et serrurerie.', '81000000000006', true, 'B', 'menuiserie', 'parquet', 'serrurerie'),
  ('00000000-0000-0000-0000-000000000107', 'pro07@nextmind.test', 'Gael Rey', 'Gamme Isolation', 'pro', '01 10 11 11 07', 'Toulouse', '31000', '22 Rue du Capitole', 'https://gamme-isolation.test', 'Isolation thermique, platrerie et peinture.', '81000000000007', true, 'B', 'isolation', 'platrerie', 'peinture'),
  ('00000000-0000-0000-0000-000000000108', 'pro08@nextmind.test', 'Hugo Faure', 'Helios Chauffage', 'pro', '01 10 11 11 08', 'Nice', '06000', '33 Rue Massena', 'https://helios-chauffage.test', 'Chauffage, climatisation et maintenance.', '81000000000008', true, 'B', 'chauffage', 'climatisation', 'plomberie'),
  ('00000000-0000-0000-0000-000000000109', 'pro09@nextmind.test', 'Ines Caron', 'Isatis Carrelage', 'pro', '01 10 11 11 09', 'Rennes', '35000', '44 Rue Antrain', 'https://isatis-carrelage.test', 'Carrelage, sols et finitions.', '81000000000009', true, 'B', 'carrelage', 'sols', 'parquet'),
  ('00000000-0000-0000-0000-000000000110', 'pro10@nextmind.test', 'Julie Henry', 'Jade Etancheite', 'pro', '01 10 11 11 10', 'Strasbourg', '67000', '55 Rue des Orfevres', 'https://jade-etancheite.test', 'Etancheite, facade et protection des batiments.', '81000000000010', true, 'B', 'etancheite', 'facade', 'toiture'),
  ('00000000-0000-0000-0000-000000000111', 'pro11@nextmind.test', 'Kevin Noel', 'Kappa Terrassement', 'pro', '01 10 11 11 11', 'Grenoble', '38000', '11 Rue Felix Viallet', 'https://kappa-terrassement.test', 'Terrassement, vrd et preparation de terrain.', '81000000000011', true, 'C', 'terrassement', 'vrd', 'exterieur'),
  ('00000000-0000-0000-0000-000000000112', 'pro12@nextmind.test', 'Laura Andre', 'Lumen Peinture', 'pro', '01 10 11 11 12', 'Reims', '51100', '22 Rue de Vesle', 'https://lumen-peinture.test', 'Peinture interieure, renovation et platrerie.', '81000000000012', true, 'C', 'peinture', 'renovation', 'platrerie'),
  ('00000000-0000-0000-0000-000000000113', 'pro13@nextmind.test', 'Mehdi Simon', 'Mosaic Sols', 'pro', '01 10 11 11 13', 'Dijon', '21000', '33 Rue de la Liberte', 'https://mosaic-sols.test', 'Sols, parquet et carrelage.', '81000000000013', true, 'C', 'sols', 'parquet', 'carrelage'),
  ('00000000-0000-0000-0000-000000000114', 'pro14@nextmind.test', 'Nadia Denis', 'Nova Piscines', 'pro', '01 10 11 11 14', 'Montpellier', '34000', '44 Rue de la Loge', 'https://nova-piscines.test', 'Piscines, maconnerie et etancheite.', '81000000000014', true, 'C', 'piscine', 'maconnerie', 'etancheite'),
  ('00000000-0000-0000-0000-000000000115', 'pro15@nextmind.test', 'Olivier Diallo', 'Orion Energie', 'pro', '01 10 11 11 15', 'Tours', '37000', '55 Rue Nationale', 'https://orion-energie.test', 'Solaire, electricite et domotique.', '81000000000015', true, 'C', 'solaire', 'electricite', 'domotique'),
  ('00000000-0000-0000-0000-000000000116', 'pro16@nextmind.test', 'Pauline Girard', 'Pulse Domotique', 'pro', '00 00 00 00 00', 'Angers', '49000', '11 Rue Alsace', 'https://pulse-domotique.test', 'Profil test incoherent: domotique annoncee mais description electricite seule.', '81000000000016', true, 'D', 'domotique', 'electricite', 'chauffage'),
  ('00000000-0000-0000-0000-000000000117', 'pro17@nextmind.test', 'Quentin Roche', 'Quartz Couverture', 'pro', '01 10 11 11 17', 'Rouen', '76000', '22 Rue Jeanne d Arc', 'https://quartz-couverture.test', 'Toiture, zinguerie et charpente.', '81000000000017', true, 'D', 'toiture', 'zinguerie', 'charpente'),
  ('00000000-0000-0000-0000-000000000118', 'pro18@nextmind.test', 'Romain Chau', 'Roc Gros Oeuvre', 'pro', '01 10 11 11 18', 'Metz', '57000', '33 Rue Serpenoise', 'https://roc-gros-oeuvre.test', 'Gros oeuvre, maconnerie et terrassement.', '81000000000018', true, 'D', 'gros_oeuvre', 'maconnerie', 'terrassement'),
  ('00000000-0000-0000-0000-000000000119', 'pro19@nextmind.test', 'Sarah Noel', 'Solstice Paysage', 'pro', '01 10 11 11 19', 'Nancy', '54000', '44 Rue Saint Jean', 'https://solstice-paysage.test', 'Paysage, exterieur et amenagements.', '81000000000019', true, 'D', 'paysagiste', 'exterieur', 'terrassement'),
  ('00000000-0000-0000-0000-000000000120', 'pro20@nextmind.test', 'Thomas Garcia', 'Titan Renovation', 'pro', '01 10 11 11 20', 'Clermont-Ferrand', '63000', '55 Rue des Gras', 'https://titan-renovation.test', 'Renovation complete, maconnerie et electricite.', '81000000000020', true, 'D', 'renovation', 'maconnerie', 'electricite'),
  ('00000000-0000-0000-0000-000000000121', 'pro21@nextmind.test', 'Ugo Martin', 'Urbis Facade', 'pro', '01 10 11 11 21', 'Amiens', '80000', '12 Rue des Jacobins', 'https://urbis-facade.test', 'Facade, etancheite et ravalement.', '81000000000021', true, 'B', 'facade', 'etancheite', 'peinture'),
  ('00000000-0000-0000-0000-000000000122', 'pro22@nextmind.test', 'Valerie Petit', 'Vega Plomberie', 'pro', '01 10 11 11 22', 'Nimes', '30000', '23 Rue de la Madeleine', 'https://vega-plomberie.test', 'Plomberie, chauffage et renovation de salles d eau.', '81000000000022', true, 'B', 'plomberie', 'chauffage', 'renovation'),
  ('00000000-0000-0000-0000-000000000123', 'pro23@nextmind.test', 'Wassim Legrand', 'Watt Electricite', 'pro', '01 10 11 11 23', 'Orleans', '45000', '34 Rue Royale', 'https://watt-electricite.test', 'Electricite generale, domotique et solaire.', '81000000000023', true, 'B', 'electricite', 'domotique', 'solaire'),
  ('00000000-0000-0000-0000-000000000124', 'pro24@nextmind.test', 'Yanis Perrin', 'Ypsilon Isolation', 'pro', '01 10 11 11 24', 'Caen', '14000', '45 Rue Saint Pierre', 'https://ypsilon-isolation.test', 'Isolation, platrerie et facade.', '81000000000024', true, 'C', 'isolation', 'platrerie', 'facade'),
  ('00000000-0000-0000-0000-000000000125', 'pro25@nextmind.test', 'Zoe Martin', 'Zinc Couverture', 'pro', '01 10 11 11 25', 'Le Havre', '76600', '56 Rue de Paris', 'https://zinc-couverture.test', 'Profil test incoherent: zinguerie annoncee, description plomberie.', '1234567890001', true, 'C', 'zinguerie', 'toiture', 'charpente'),
  ('00000000-0000-0000-0000-000000000126', 'pro26@nextmind.test', 'Amina Noel', 'Atlas Renovation', 'pro', '01 10 11 11 26', 'Perpignan', '66000', '67 Rue de la Republicque', 'https://atlas-renovation.test', 'Renovation interieure, plomberie et electricite.', '81000000000026', true, 'A', 'renovation', 'plomberie', 'electricite'),
  ('00000000-0000-0000-0000-000000000127', 'pro27@nextmind.test', 'Bruno Meunier', 'Bati Chauffage', 'pro', '01 10 11 11 27', 'Poitiers', '86000', '78 Rue Victor Hugo', 'https://bati-chauffage.test', 'Chauffage, plomberie et maintenance.', '81000000000027', true, 'B', 'chauffage', 'plomberie', 'climatisation'),
  ('00000000-0000-0000-0000-000000000128', 'pro28@nextmind.test', 'Celine Petit', 'Carmin Carrelage', 'pro', '01 10 11 11 28', 'Limoges', '87000', '89 Rue de la Boucherie', 'https://carmin-carrelage.test', 'Carrelage, sols et etancheite.', '81000000000028', true, 'B', 'carrelage', 'sols', 'etancheite'),
  ('00000000-0000-0000-0000-000000000129', 'pro29@nextmind.test', 'Damien Roy', 'Dauphin Piscines', 'pro', '01 10 11 11 29', 'Annecy', '74000', '12 Rue Royale', 'https://dauphin-piscines.test', 'Piscines, maconnerie et exterieur.', '81000000000029', true, 'B', 'piscine', 'maconnerie', 'exterieur'),
  ('00000000-0000-0000-0000-000000000130', 'pro30@nextmind.test', 'Elise Lemoine', 'Eole Solaire', 'pro', '01 10 11 11 30', 'Ajaccio', '20000', '23 Rue Fesch', 'https://eole-solaire.test', 'Solaire, electricite et domotique.', '81000000000030', true, 'A', 'solaire', 'electricite', 'domotique'),
  ('00000000-0000-0000-0000-000000000131', 'pro31@nextmind.test', 'Farid Benali', 'Forte Maconnerie', 'pro', '01 10 11 11 31', 'Brest', '29200', '34 Rue de Siam', 'https://forte-maconnerie.test', 'Maconnerie, gros oeuvre et terrassement.', '81000000000031', true, 'C', 'maconnerie', 'gros_oeuvre', 'terrassement'),
  ('00000000-0000-0000-0000-000000000132', 'pro32@nextmind.test', 'Giselle Lemoine', 'Granite Gros Oeuvre', 'pro', '01 10 11 11 32', 'Avignon', '84000', '45 Rue de la Republique', 'https://granite-gros-oeuvre.test', 'Profil test incoherent: gros oeuvre annonce, description peinture.', '81000000000032', true, 'C', 'gros_oeuvre', 'maconnerie', 'renovation'),
  ('00000000-0000-0000-0000-000000000133', 'pro33@nextmind.test', 'Hector Vidal', 'Horizon Menuiserie', 'pro', '01 10 11 11 33', 'La Rochelle', '17000', '56 Rue du Minage', 'https://horizon-menuiserie.test', 'Menuiserie, parquet et serrurerie.', '81000000000033', true, 'B', 'menuiserie', 'parquet', 'serrurerie'),
  ('00000000-0000-0000-0000-000000000134', 'pro34@nextmind.test', 'Ismael Robert', 'Icone Platrerie', 'pro', '01 10 11 11 34', 'Valence', '26000', '67 Rue Madier de Montjau', 'https://icone-platrerie.test', 'Platrerie, peinture et isolation.', '81000000000034', true, 'C', 'platrerie', 'peinture', 'isolation'),
  ('00000000-0000-0000-0000-000000000135', 'pro35@nextmind.test', 'Jade Lopez', 'Joya Toiture', 'pro', '01 10 11 11 35', 'Toulon', '83000', '78 Rue d Alger', 'https://joya-toiture.test', 'Toiture, zinguerie et etancheite.', '81000000000035', true, 'B', 'toiture', 'zinguerie', 'etancheite'),
  ('00000000-0000-0000-0000-000000000136', 'pro36@nextmind.test', 'Karim Benali', 'Koral Terrassement', 'pro', '00 11 11 11 11', 'Bayonne', '64100', '89 Rue Port Neuf', 'https://koral-terrassement.test', 'Terrassement, vrd et exterieur.', '81000000000036', true, 'C', 'terrassement', 'vrd', 'exterieur'),
  ('00000000-0000-0000-0000-000000000137', 'pro37@nextmind.test', 'Lina Moreau', 'Lys Peinture', 'pro', '01 10 11 11 37', 'Saint-Etienne', '42000', '12 Rue de la Republique', 'https://lys-peinture.test', 'Peinture, facade et renovation.', '81000000000037', true, 'C', 'peinture', 'facade', 'renovation'),
  ('00000000-0000-0000-0000-000000000138', 'pro38@nextmind.test', 'Mathis Dupont', 'Mistral Domotique', 'pro', '01 10 11 11 38', 'Montreuil', '93100', '23 Rue de Paris', 'https://mistral-domotique.test', 'Domotique avancee, electricite et solaire.', '81000000000038', true, 'A', 'domotique', 'electricite', 'solaire'),
  ('00000000-0000-0000-0000-000000000139', 'pro39@nextmind.test', 'Nora Fournier', 'Nacre Paysage', 'pro', '01 10 11 11 39', 'Chambery', '73000', '34 Rue de Boigne', 'https://nacre-paysage.test', 'Profil test incoherent: paysagiste annonce, description electricite.', '81000000000039', true, 'C', 'paysagiste', 'exterieur', 'terrassement'),
  ('00000000-0000-0000-0000-000000000140', 'pro40@nextmind.test', 'Owen Perrin', 'Oxygene Etancheite', 'pro', '01 10 11 11 40', 'Besancon', '25000', '45 Rue Battant', 'https://oxygene-etancheite.test', 'Etancheite, toiture et facade.', '81000000000040', true, 'B', 'etancheite', 'toiture', 'facade'),
  ('00000000-0000-0000-0000-000000000201', 'client01@nextmind.test', 'Camille Durand', 'Client Camille Durand', 'client', '06 10 10 10 01', 'Paris', '75001', '1 Rue du Louvre', 'https://client01.nextmind.test', 'Client particulier pour travaux de renovation.', '90000000000001', false, null, null, null, null),
  ('00000000-0000-0000-0000-000000000202', 'client02@nextmind.test', 'Lucas Bernard', 'Client Lucas Bernard', 'client', '06 10 10 10 02', 'Lyon', '69001', '2 Rue de la Republique', 'https://client02.nextmind.test', 'Client particulier pour travaux.', '90000000000002', false, null, null, null, null),
  ('00000000-0000-0000-0000-000000000203', 'client03@nextmind.test', 'Manon Garcia', 'Client Manon Garcia', 'client', '06 10 10 10 03', 'Marseille', '13001', '3 Rue Paradis', 'https://client03.nextmind.test', 'Client particulier pour renovation.', '90000000000003', false, null, null, null, null),
  ('00000000-0000-0000-0000-000000000204', 'client04@nextmind.test', 'Nathan Morel', 'Client Nathan Morel', 'client', '06 10 10 10 04', 'Lille', '59001', '4 Rue de Paris', 'https://client04.nextmind.test', 'Client particulier pour travaux maison.', '90000000000004', false, null, null, null, null),
  ('00000000-0000-0000-0000-000000000205', 'client05@nextmind.test', 'Oceane Lefevre', 'Client Oceane Lefevre', 'client', '06 10 10 10 05', 'Bordeaux', '33001', '5 Rue des Faussets', 'https://client05.nextmind.test', 'Client particulier pour travaux.', '90000000000005', false, null, null, null, null),
  ('00000000-0000-0000-0000-000000000206', 'client06@nextmind.test', 'Pierre Legrand', 'Client Pierre Legrand', 'client', '06 10 10 10 06', 'Nantes', '44001', '6 Rue de Strasbourg', 'https://client06.nextmind.test', 'Client particulier pour renovation.', '90000000000006', false, null, null, null, null),
  ('00000000-0000-0000-0000-000000000207', 'client07@nextmind.test', 'Rania Benali', 'Client Rania Benali', 'client', '06 10 10 10 07', 'Toulouse', '31001', '7 Rue d Alsace', 'https://client07.nextmind.test', 'Client particulier pour travaux.', '90000000000007', false, null, null, null, null),
  ('00000000-0000-0000-0000-000000000208', 'client08@nextmind.test', 'Samuel Blanc', 'Client Samuel Blanc', 'client', '06 10 10 10 08', 'Nice', '06001', '8 Rue de France', 'https://client08.nextmind.test', 'Client particulier pour travaux.', '90000000000008', false, null, null, null, null),
  ('00000000-0000-0000-0000-000000000209', 'client09@nextmind.test', 'Tess Martin', 'Client Tess Martin', 'client', '06 10 10 10 09', 'Rennes', '35001', '9 Rue Saint Georges', 'https://client09.nextmind.test', 'Client particulier pour renovation.', '90000000000009', false, null, null, null, null),
  ('00000000-0000-0000-0000-000000000210', 'client10@nextmind.test', 'Yasmine Noel', 'Client Yasmine Noel', 'client', '06 10 10 10 10', 'Strasbourg', '67001', '10 Rue du Dome', 'https://client10.nextmind.test', 'Client particulier pour travaux.', '90000000000010', false, null, null, null, null);

-- Normalize seed users: only Paris and Lille, realistic addresses and websites.
update seed_users
set
  city = case
    when right(id::text, 3)::int between 101 and 120 then 'Paris'
    when right(id::text, 3)::int between 201 and 205 then 'Paris'
    else 'Lille'
  end,
  postal_code = case
    when right(id::text, 3)::int between 101 and 120 then '75011'
    when right(id::text, 3)::int between 201 and 205 then '75011'
    else '59000'
  end,
  address = (10 + (right(id::text, 3)::int % 80))::text ||
    case
      when right(id::text, 3)::int between 101 and 120 then ' Rue des Lilas'
      when right(id::text, 3)::int between 201 and 205 then ' Rue des Lilas'
      else ' Rue Nationale'
    end,
  company_website = replace(company_website, '.test', '.fr');

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  su.id,
  (select id from auth.instances limit 1),
  'authenticated',
  'authenticated',
  su.email,
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from seed_users su
where not exists (
  select 1 from auth.users u where u.id = su.id
);

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  su.id,
  jsonb_build_object('sub', su.id::text, 'email', su.email),
  'email',
  su.email,
  now(),
  now()
from seed_users su
where not exists (
  select 1
  from auth.identities i
  where i.user_id = su.id
    and i.provider = 'email'
);

insert into public.profiles (
  id,
  full_name,
  display_name,
  company,
  role,
  created_at,
  email,
  phone,
  company_name,
  siret,
  user_type,
  avatar_url,
  address,
  city,
  postal_code,
  updated_at,
  company_description,
  company_website,
  public_portfolio_enabled,
  preferences
)
select
  su.id,
  su.full_name,
  case when su.user_type = 'pro' then su.company_name else su.full_name end,
  su.company_name,
  case
    when su.user_type = 'pro' then
      case su.trade_primary
        when 'renovation' then 'chef de chantier'
        when 'electricite' then 'gerant'
        when 'plomberie' then 'artisan'
        when 'maconnerie' then 'chef de chantier'
        when 'toiture' then 'gerant'
        when 'charpente' then 'chef d equipe'
        when 'menuiserie' then 'artisan'
        when 'isolation' then 'responsable'
        when 'chauffage' then 'chef de chantier'
        when 'carrelage' then 'artisan'
        when 'etancheite' then 'responsable'
        when 'terrassement' then 'chef de chantier'
        when 'solaire' then 'gerant'
        when 'domotique' then 'responsable'
        when 'gros_oeuvre' then 'chef de chantier'
        when 'paysagiste' then 'artisan'
        when 'facade' then 'responsable'
        when 'platrerie' then 'chef d equipe'
        else 'gerant'
      end
    else 'particulier'
  end,
  now(),
  su.email,
  su.phone,
  su.company_name,
  su.siret,
  su.user_type,
  null,
  su.address,
  su.city,
  su.postal_code,
  now(),
  su.company_description,
  su.company_website,
  coalesce(su.public_portfolio_enabled, false),
  jsonb_build_object('email_notifications', true, 'project_alerts', true, 'message_alerts', true)
from seed_users su
on conflict (id) do update
set
  full_name = excluded.full_name,
  display_name = excluded.display_name,
  company = excluded.company,
  role = excluded.role,
  email = excluded.email,
  phone = excluded.phone,
  company_name = excluded.company_name,
  siret = excluded.siret,
  user_type = excluded.user_type,
  avatar_url = excluded.avatar_url,
  address = excluded.address,
  city = excluded.city,
  postal_code = excluded.postal_code,
  updated_at = excluded.updated_at,
  company_description = excluded.company_description,
  company_website = excluded.company_website,
  public_portfolio_enabled = excluded.public_portfolio_enabled,
  preferences = excluded.preferences;

insert into public.clients (
  id,
  name,
  contact,
  address,
  created_at
)
select
  su.id,
  su.full_name,
  jsonb_build_object('email', su.email, 'phone', su.phone),
  su.address,
  now()
from seed_users su
where su.user_type = 'client'
  and not exists (
    select 1 from public.clients c where c.id = su.id
  );

insert into public.pro_specialties (pro_id, label, created_at)
select
  rows.pro_id,
  rows.label,
  rows.created_at
from (
  select id as pro_id, trade_primary as label, now() as created_at
  from seed_users
  where user_type = 'pro' and trade_primary is not null
  union all
  select id as pro_id, trade_secondary as label, now() as created_at
  from seed_users
  where user_type = 'pro' and trade_secondary is not null
  union all
  select id as pro_id, trade_tertiary as label, now() as created_at
  from seed_users
  where user_type = 'pro' and trade_tertiary is not null
) as rows
where not exists (
  select 1
  from public.pro_specialties ps
  where ps.pro_id = rows.pro_id
    and lower(ps.label) = lower(rows.label)
);


insert into public.pro_tag_scores (
  pro_id,
  tag,
  confidence,
  evidence_count,
  last_seen_at,
  source,
  created_at,
  updated_at
)
select
  su.id,
  su.trade_primary,
  case su.tier
    when 'A' then 0.92
    when 'B' then 0.78
    when 'C' then 0.62
    else 0.45
  end,
  case su.tier
    when 'A' then 12
    when 'B' then 8
    when 'C' then 5
    else 3
  end,
  now() - interval '5 days',
  'seed',
  now(),
  now()
from seed_users su
where su.user_type = 'pro'
  and su.trade_primary is not null
  and not exists (
    select 1 from public.pro_tag_scores s where s.pro_id = su.id and s.tag = su.trade_primary
  );

-- Detect allowed status values (if check constraints exist).
create temp table allowed_project_statuses as
select distinct lower((regexp_matches(pg_get_constraintdef(oid), '''([^'']+)''', 'g'))[1]) as status
from pg_constraint
where conrelid = 'public.projects'::regclass
  and contype = 'c'
  and pg_get_constraintdef(oid) like '%status%';

create temp table project_status_map as
select
  coalesce(
    (select status from allowed_project_statuses where status in ('completed', 'termine', 'done') limit 1),
    (select status from allowed_project_statuses where status in ('in_progress', 'en_cours', 'active') limit 1),
    (select status from allowed_project_statuses where status in ('pending', 'en_attente', 'paused', 'quoted', 'cancelled', 'draft', 'a_faire') limit 1),
    (select status from allowed_project_statuses limit 1),
    null
  ) as status_done,
  coalesce(
    (select status from allowed_project_statuses where status in ('in_progress', 'en_cours', 'active') limit 1),
    (select status from allowed_project_statuses where status in ('pending', 'en_attente', 'paused', 'quoted', 'cancelled', 'draft', 'a_faire') limit 1),
    (select status from allowed_project_statuses where status in ('completed', 'termine', 'done') limit 1),
    (select status from allowed_project_statuses limit 1),
    null
  ) as status_active,
  coalesce(
    (select status from allowed_project_statuses where status in ('pending', 'en_attente', 'paused', 'quoted', 'cancelled', 'draft', 'a_faire') limit 1),
    (select status from allowed_project_statuses where status in ('in_progress', 'en_cours', 'active') limit 1),
    (select status from allowed_project_statuses where status in ('completed', 'termine', 'done') limit 1),
    (select status from allowed_project_statuses limit 1),
    null
  ) as status_wait;

create temp table allowed_task_statuses as
select distinct lower((regexp_matches(pg_get_constraintdef(oid), '''([^'']+)''', 'g'))[1]) as status
from pg_constraint
where conrelid = 'public.project_tasks'::regclass
  and contype = 'c'
  and pg_get_constraintdef(oid) like '%status%';

create temp table task_status_map as
select
  coalesce(
    (select status from allowed_task_statuses where status in ('done', 'completed', 'termine', 'finished', 'validated') limit 1),
    (select status from allowed_task_statuses where status in ('in_progress', 'active', 'ongoing', 'en_cours', 'paused') limit 1),
    (select status from allowed_task_statuses where status in ('not_started', 'todo', 'a_faire', 'draft') limit 1),
    (select status from allowed_task_statuses limit 1),
    null
  ) as status_done,
  coalesce(
    (select status from allowed_task_statuses where status in ('in_progress', 'active', 'ongoing', 'en_cours', 'paused') limit 1),
    (select status from allowed_task_statuses where status in ('not_started', 'todo', 'a_faire', 'draft') limit 1),
    (select status from allowed_task_statuses where status in ('done', 'completed', 'termine', 'finished', 'validated') limit 1),
    (select status from allowed_task_statuses limit 1),
    null
  ) as status_active,
  coalesce(
    (select status from allowed_task_statuses where status in ('not_started', 'todo', 'a_faire', 'draft') limit 1),
    (select status from allowed_task_statuses where status in ('in_progress', 'active', 'ongoing', 'en_cours', 'paused') limit 1),
    (select status from allowed_task_statuses where status in ('done', 'completed', 'termine', 'finished', 'validated') limit 1),
    (select status from allowed_task_statuses limit 1),
    null
  ) as status_not_started;

create temp table seed_projects as
with pros as (
  select
    id,
    company_name,
    trade_primary,
    city,
    postal_code,
    address,
    tier,
    row_number() over (order by company_name) as rn
  from seed_users
  where user_type = 'pro'
),
clients as (
  select
    id,
    full_name,
    postal_code,
    row_number() over (order by full_name) as rn
  from seed_users
  where user_type = 'client'
),
client_count as (
  select count(*)::int as n from clients
)
select
  gen_random_uuid() as id,
  p.id as pro_id,
  c.id as client_id,
  format('Projet %s %s', p.trade_primary, gs) as name,
  format('Travaux %s pour %s', p.trade_primary, c.full_name) as description,
  p.trade_primary as project_type,
  status_keys.status_key,
  case status_keys.status_key
    when 'done' then (select status_done from project_status_map)
    when 'active' then (select status_active from project_status_map)
    else (select status_wait from project_status_map)
  end as status,
  p.address as address,
  p.city as city,
  c.postal_code as postal_code,
  case
    when p.tier = 'A' and gs = 1 then now() - interval '120 days'
    when p.tier = 'A' and gs = 2 then now() - interval '30 days'
    when p.tier = 'B' and gs = 1 then now() - interval '90 days'
    when p.tier = 'B' and gs = 2 then now() - interval '20 days'
    when p.tier = 'C' and gs = 1 then now() - interval '60 days'
    when p.tier = 'C' and gs = 2 then now() - interval '10 days'
    when p.tier = 'D' and gs = 1 then now() - interval '45 days'
    when p.tier = 'D' and gs = 2 then now() - interval '5 days'
    else now() - interval '15 days'
  end as created_at,
  now() as updated_at,
  p.tier as tier,
  gs as idx
from pros p
join generate_series(1, 2) gs on true
join clients c
  on c.rn = ((p.rn + gs - 2) % (select n from client_count)) + 1
cross join lateral (
  select case
    when p.tier = 'A' and gs = 1 then 'done'
    when p.tier = 'A' and gs = 2 then 'active'
    when p.tier = 'B' and gs = 1 then 'done'
    when p.tier = 'B' and gs = 2 then 'wait'
    when p.tier = 'C' and gs = 1 then 'active'
    when p.tier = 'C' and gs = 2 then 'wait'
    when p.tier = 'D' then 'wait'
    else 'wait'
  end as status_key
) as status_keys;

insert into public.projects (
  id,
  name,
  description,
  project_type,
  status,
  address,
  city,
  postal_code,
  created_by,
  created_at,
  updated_at
)
select
  id,
  name,
  description,
  project_type,
  status,
  address,
  city,
  postal_code,
  client_id,
  created_at,
  updated_at
from seed_projects;

insert into public.project_members (
  project_id,
  user_id,
  role,
  status,
  invited_by,
  accepted_at
)
select distinct
  project_id,
  user_id,
  role,
  status,
  invited_by,
  accepted_at
from (
  select
    id as project_id,
    pro_id as user_id,
    'collaborator' as role,
    'accepted' as status,
    client_id as invited_by,
    created_at + interval '1 day' as accepted_at
  from seed_projects
  union all
  select
    id as project_id,
    client_id as user_id,
    'client' as role,
    'accepted' as status,
    client_id as invited_by,
    created_at + interval '1 day' as accepted_at
  from seed_projects
) as rows
where not exists (
  select 1
  from public.project_members pm
  where pm.project_id = rows.project_id
    and pm.user_id = rows.user_id
);

insert into public.project_messages (
  project_id,
  sender_id,
  message,
  created_at
)
select
  p.id,
  case when gs in (1, 3) then p.client_id else p.pro_id end,
  case
    when gs = 1 then 'Bonjour, pouvez-vous partager le planning ?'
    when gs = 2 then 'Planning partage. L equipe demarre cette semaine.'
    when gs = 3 and p.tier = 'A' then 'Tres bon suivi, merci.'
    when gs = 3 and p.tier = 'B' then 'Merci pour la mise a jour.'
    when gs = 3 and p.tier = 'C' then 'Merci de me tenir informe.'
    when gs = 3 and p.tier = 'D' then 'Il y a un retard, merci de reagir.'
    else 'Merci.'
  end,
  p.created_at + (gs * interval '2 days')
from seed_projects p
join generate_series(1, 3) gs on true;

insert into public.project_tags (
  project_id,
  tag,
  source,
  confidence,
  created_at
)
select
  p.id,
  p.project_type,
  'seed',
  case p.tier
    when 'A' then 0.9
    when 'B' then 0.75
    when 'C' then 0.6
    else 0.5
  end,
  p.created_at
from seed_projects p
where p.project_type is not null;

insert into public.project_tasks (
  id,
  project_id,
  name,
  status,
  start_date,
  end_date,
  description,
  completed_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  p.id,
  case gs
    when 1 then 'Preparation'
    when 2 then 'Execution'
    when 3 then 'Controle'
    else 'Nettoyage'
  end,
  case
    when p.status_key = 'done' then (select status_done from task_status_map)
    when p.status_key = 'active' and gs = 1 then (select status_done from task_status_map)
    when p.status_key = 'active' and gs = 2 then (select status_active from task_status_map)
    when p.status_key = 'wait' and p.tier in ('C', 'D') and gs in (1, 2) then (select status_active from task_status_map)
    else (select status_not_started from task_status_map)
  end,
  (p.created_at::date + ((gs - 1) * 7)) as start_date,
  (p.created_at::date + ((gs - 1) * 7) + 5) as end_date,
  case
    when p.status_key = 'done' or (p.status_key = 'active' and gs = 1) then '[[time:08:00-12:00]] Tache standard.'
    else null
  end,
  case
    when p.status_key = 'done' then
      case when p.tier in ('C', 'D') then (p.created_at::date + ((gs - 1) * 7) + 7)::timestamptz
           else (p.created_at::date + ((gs - 1) * 7) + 4)::timestamptz end
    when p.status_key = 'active' and gs = 1 then (p.created_at::date + ((gs - 1) * 7) + 4)::timestamptz
    else null
  end,
  p.created_at,
  p.updated_at
from seed_projects p
join generate_series(1, 4) gs on true;

create temp table seed_devis as
with base as (
  select
    p.*,
    u.full_name as client_name,
    case p.project_type
      when 'renovation' then 20000
      when 'electricite' then 8000
      when 'plomberie' then 9000
      when 'maconnerie' then 15000
      when 'toiture' then 18000
      when 'charpente' then 17000
      when 'menuiserie' then 11000
      when 'serrurerie' then 9000
      when 'isolation' then 10000
      when 'platrerie' then 9500
      when 'chauffage' then 14000
      when 'climatisation' then 12000
      when 'carrelage' then 7000
      when 'etancheite' then 16000
      when 'facade' then 15000
      when 'terrassement' then 20000
      when 'vrd' then 18000
      when 'sols' then 9000
      when 'parquet' then 10000
      when 'piscine' then 30000
      when 'solaire' then 25000
      when 'domotique' then 12000
      when 'zinguerie' then 14000
      when 'gros_oeuvre' then 22000
      when 'paysagiste' then 13000
      when 'exterieur' then 12000
      else 12000
    end::numeric as base_total,
    case p.tier
      when 'A' then 0.95
      when 'B' then 1.05
      when 'C' then 1.0
      when 'D' then 1.15
      else 1.0
    end::numeric as tier_mult
  from seed_projects p
  join seed_users u on u.id = p.client_id
)
select
  gen_random_uuid() as id,
  base.id as project_id,
  base.pro_id as user_id,
  base.client_id as client_id,
  case
    when base.status_key = 'done' and base.tier = 'A' then 'valide'
    when base.status_key = 'done' and base.tier = 'B' then 'envoye'
    when base.status_key = 'done' then 'valide'
    when base.status_key = 'active' then 'en_etude'
    when base.status_key = 'wait' and base.tier = 'D' then 'refuse'
    else 'en_etude'
  end as status,
  round(base.base_total * base.tier_mult, 2) as total,
  jsonb_build_object(
    'title', format('Devis %s', base.name),
    'client_name', base.client_name,
    'project_label', base.project_type,
    'source', 'seed',
    'workflow_status', case
      when base.status_key = 'done' and base.tier = 'A' then 'valide'
      when base.status_key = 'done' and base.tier = 'B' then 'envoye'
      when base.status_key = 'done' then 'valide'
      when base.status_key = 'active' then 'a_faire'
      when base.status_key = 'wait' and base.tier = 'D' then 'refuse'
      else 'a_faire'
    end
  ) as metadata,
  base.created_at + interval '2 days' as created_at,
  base.updated_at as updated_at
from base;

insert into public.devis (
  id,
  user_id,
  client_id,
  project_id,
  status,
  total,
  metadata,
  created_at,
  updated_at
)
select
  id,
  user_id,
  client_id,
  project_id,
  status,
  total,
  metadata,
  created_at,
  updated_at
from seed_devis;

insert into public.devis_items (
  devis_id,
  description,
  qty,
  unit_price,
  total
)
select
  d.id,
  i.description,
  i.qty,
  i.unit_price,
  (i.qty * i.unit_price)
from seed_devis d
cross join lateral (
  values
    ('Main d oeuvre', 10::numeric, round((d.total * 0.6) / 10, 2)),
    ('Materiaux', 1::numeric, round(d.total * 0.4, 2))
) as i(description, qty, unit_price);

insert into public.devis_tags (
  devis_id,
  tag,
  source,
  confidence,
  created_at
)
select
  d.id,
  p.project_type,
  'seed',
  case p.tier
    when 'A' then 0.9
    when 'B' then 0.72
    when 'C' then 0.6
    else 0.48
  end,
  d.created_at
from seed_devis d
join seed_projects p on p.id = d.project_id
where p.project_type is not null;

create temp table seed_portfolio as
select
  p.pro_id,
  p.id as project_id,
  d.id as devis_id,
  p.name as title,
  p.description as summary,
  p.project_type,
  p.city,
  p.postal_code,
  p.updated_at,
  p.tier,
  row_number() over (partition by p.pro_id order by p.updated_at desc) as rn
from seed_projects p
left join seed_devis d on d.project_id = p.id;

insert into public.pro_portfolio_projects (
  pro_id,
  title,
  summary,
  budget_total,
  duration_days,
  image_path,
  city,
  postal_code,
  is_public,
  created_at,
  updated_at
)
select
  sp.pro_id,
  sp.title,
  sp.summary,
  d.total,
  case
    when sp.tier = 'A' then 28 + (sp.rn * 3)
    when sp.tier = 'B' then 35 + (sp.rn * 4)
    when sp.tier = 'C' then 42 + (sp.rn * 5)
    else 50 + (sp.rn * 6)
  end,
  null,
  sp.city,
  sp.postal_code,
  true,
  sp.updated_at,
  sp.updated_at
from seed_portfolio sp
left join seed_devis d on d.id = sp.devis_id
where sp.rn <= 3
  and not exists (
    select 1
    from public.pro_portfolio_projects pp
    where pp.pro_id = sp.pro_id
      and pp.title = sp.title
  );

insert into public.pro_portfolio_project_sources (
  portfolio_project_id,
  source_project_id,
  source_devis_id,
  created_at
)
select
  pp.id,
  sp.project_id,
  sp.devis_id,
  pp.created_at
from public.pro_portfolio_projects pp
join seed_portfolio sp
  on sp.pro_id = pp.pro_id
  and sp.title = pp.title
where not exists (
  select 1
  from public.pro_portfolio_project_sources src
  where src.portfolio_project_id = pp.id
);

create temp table seed_conversations as
select
  gen_random_uuid() as id,
  pro_id,
  client_id,
  now() - interval '3 days' as created_at
from (
  select distinct on (pro_id) pro_id, client_id
  from seed_projects
  order by pro_id, created_at desc
) s;

insert into public.network_conversations (id, created_at)
select id, created_at from seed_conversations;

insert into public.network_conversation_members (conversation_id, user_id, created_at)
select id, pro_id, created_at from seed_conversations
union all
select id, client_id, created_at from seed_conversations;

insert into public.network_messages (conversation_id, sender_id, message, created_at)
select
  c.id,
  m.sender_id,
  m.message,
  m.created_at
from seed_conversations c
cross join lateral (
  values
    (c.client_id, 'Bonjour, j ai vu votre profil et j ai besoin d un devis.', c.created_at + interval '1 hour'),
    (c.pro_id, 'Avec plaisir. Pouvez-vous partager les details ?', c.created_at + interval '3 hours'),
    (c.client_id, 'Details du projet envoyes. Merci.', c.created_at + interval '6 hours')
) as m(sender_id, message, created_at);

commit;
