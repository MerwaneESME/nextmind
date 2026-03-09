-- Ajout de la colonne department pour les adresses
alter table public.profiles
  add column if not exists department text;
