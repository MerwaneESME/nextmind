-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact jsonb,
  address text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.devis (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  client_id uuid,
  status text DEFAULT 'draft'::text,
  raw_text text,
  metadata jsonb,
  total numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  project_id uuid,
  CONSTRAINT devis_pkey PRIMARY KEY (id),
  CONSTRAINT devis_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT devis_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT devis_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.devis_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  devis_id uuid,
  product_id uuid,
  description text,
  qty numeric,
  unit_price numeric,
  total numeric,
  CONSTRAINT devis_items_pkey PRIMARY KEY (id),
  CONSTRAINT devis_items_devis_id_fkey FOREIGN KEY (devis_id) REFERENCES public.devis(id),
  CONSTRAINT devis_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.devis_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL,
  tag text NOT NULL,
  source text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT devis_tags_pkey PRIMARY KEY (id),
  CONSTRAINT devis_tags_devis_id_fkey FOREIGN KEY (devis_id) REFERENCES public.devis(id)
);
CREATE TABLE public.embeddings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_table text,
  source_id uuid,
  embedding USER-DEFINED,
  text_excerpt text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT embeddings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.facture_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  facture_id uuid,
  product_id uuid,
  description text,
  qty integer NOT NULL,
  unit_price numeric NOT NULL,
  total numeric NOT NULL,
  CONSTRAINT facture_items_pkey PRIMARY KEY (id),
  CONSTRAINT facture_items_facture_id_fkey FOREIGN KEY (facture_id) REFERENCES public.factures(id),
  CONSTRAINT facture_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.factures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  client_id uuid,
  raw_text text,
  metadata jsonb,
  total numeric,
  created_at timestamp without time zone DEFAULT now(),
  devis_id uuid,
  CONSTRAINT factures_pkey PRIMARY KEY (id),
  CONSTRAINT factures_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT factures_devis_id_fkey FOREIGN KEY (devis_id) REFERENCES public.devis(id)
);
CREATE TABLE public.network_conversation_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT network_conversation_members_pkey PRIMARY KEY (id),
  CONSTRAINT network_conversation_members_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.network_conversations(id),
  CONSTRAINT network_conversation_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.network_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT network_conversations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.network_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT network_messages_pkey PRIMARY KEY (id),
  CONSTRAINT network_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.network_conversations(id),
  CONSTRAINT network_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'info'::text,
  action_url text,
  data jsonb DEFAULT '{}'::jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE INDEX notifications_user_id_idx ON public.notifications (user_id);
CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id, read_at);
CREATE INDEX notifications_created_at_idx ON public.notifications (created_at DESC);
CREATE TABLE public.pro_portfolio_project_sources (
  portfolio_project_id uuid NOT NULL,
  source_project_id uuid,
  source_devis_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pro_portfolio_project_sources_pkey PRIMARY KEY (portfolio_project_id),
  CONSTRAINT pro_portfolio_project_sources_portfolio_project_id_fkey FOREIGN KEY (portfolio_project_id) REFERENCES public.pro_portfolio_projects(id),
  CONSTRAINT pro_portfolio_project_sources_source_project_id_fkey FOREIGN KEY (source_project_id) REFERENCES public.projects(id),
  CONSTRAINT pro_portfolio_project_sources_source_devis_id_fkey FOREIGN KEY (source_devis_id) REFERENCES public.devis(id)
);
CREATE TABLE public.pro_portfolio_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pro_id uuid NOT NULL,
  title text NOT NULL,
  summary text,
  budget_total numeric,
  duration_days integer,
  image_path text,
  city text,
  postal_code text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pro_portfolio_projects_pkey PRIMARY KEY (id),
  CONSTRAINT pro_portfolio_projects_pro_id_fkey FOREIGN KEY (pro_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.pro_specialties (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pro_id uuid NOT NULL,
  label text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pro_specialties_pkey PRIMARY KEY (id),
  CONSTRAINT pro_specialties_pro_id_fkey FOREIGN KEY (pro_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.pro_tag_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pro_id uuid NOT NULL,
  tag text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  evidence_count integer NOT NULL DEFAULT 0,
  last_seen_at timestamp with time zone,
  source text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pro_tag_scores_pkey PRIMARY KEY (id),
  CONSTRAINT pro_tag_scores_pro_id_fkey FOREIGN KEY (pro_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sku text,
  title text,
  description text,
  unit_price numeric,
  source_url text,
  created_at timestamp with time zone DEFAULT now(),
  category text,
  subcategory text,
  weight numeric,
  length numeric,
  width numeric,
  height numeric,
  thickness numeric,
  diameter numeric,
  volume numeric,
  surface numeric,
  unit text,
  type text,
  brand text,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  company text,
  role text,
  created_at timestamp with time zone DEFAULT now(),
  email text,
  phone text,
  company_name text,
  siret text,
  user_type text NOT NULL DEFAULT 'client'::text CHECK (user_type = ANY (ARRAY['pro'::text, 'client'::text])),
  avatar_url text,
  address text,
  city text,
  postal_code text,
  updated_at timestamp with time zone DEFAULT now(),
  company_description text,
  company_website text,
  public_portfolio_enabled boolean NOT NULL DEFAULT false,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.project_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid,
  invited_email text,
  role text NOT NULL CHECK (role = ANY (ARRAY['owner'::text, 'collaborator'::text, 'client'::text])),
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])),
  invited_at timestamp with time zone DEFAULT now(),
  invited_by uuid,
  accepted_at timestamp with time zone,
  CONSTRAINT project_members_pkey PRIMARY KEY (id),
  CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT project_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.project_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  sender_id uuid,
  message text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_messages_pkey PRIMARY KEY (id),
  CONSTRAINT project_messages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.project_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  tag text NOT NULL,
  source text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT project_tags_pkey PRIMARY KEY (id),
  CONSTRAINT project_tags_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.project_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  lot text,
  quantity numeric,
  unit text,
  estimated_duration integer,
  actual_duration integer,
  start_date date,
  end_date date,
  status text DEFAULT 'not_started'::text CHECK (status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'paused'::text, 'completed'::text, 'validated'::text])),
  is_critical_path boolean DEFAULT false,
  assigned_to uuid,
  cost_estimate numeric,
  cost_actual numeric,
  position integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT project_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT project_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id)
);
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  address text,
  city text,
  postal_code text,
  project_type text,
  status text DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'quoted'::text, 'in_progress'::text, 'paused'::text, 'completed'::text, 'cancelled'::text])),
  start_date date,
  end_date date,
  budget_total numeric DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.prompts (
  id integer NOT NULL DEFAULT nextval('prompts_id_seq'::regclass),
  name text,
  role text,
  content text,
  tags ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prompts_pkey PRIMARY KEY (id)
);
CREATE VIEW public.public_pro_profiles AS
select
  p.id as pro_id,
  coalesce(nullif(p.company_name, ''), nullif(p.full_name, '')) as display_name,
  p.company_name,
  p.avatar_url,
  p.city,
  p.postal_code,
  p.company_description,
  p.company_website,
  p.updated_at,
  p.email,
  p.phone,
  p.address
from public.profiles p
where lower(trim(p.user_type)) = 'pro';
