-- Ajouter contrainte UNIQUE sur pro_tag_scores(pro_id, tag) si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.pro_tag_scores'::regclass 
    AND contype = 'u'
    AND conname = 'pro_tag_scores_pro_id_tag_key'
  ) THEN
    ALTER TABLE public.pro_tag_scores 
    ADD CONSTRAINT pro_tag_scores_pro_id_tag_key UNIQUE (pro_id, tag);
  END IF;
END $$;

-- Index pour les requêtes de recherche
CREATE INDEX IF NOT EXISTS idx_pro_tag_scores_tag_confidence 
ON public.pro_tag_scores(tag, confidence DESC) 
WHERE source = 'computed';

CREATE INDEX IF NOT EXISTS idx_pro_tag_scores_pro_id 
ON public.pro_tag_scores(pro_id);

-- Vider les scores de seed (UUIDs factices avec pattern 00000000-*)
DELETE FROM public.pro_tag_scores 
WHERE pro_id::text LIKE '00000000-0000-0000-0000-%';

NOTIFY pgrst, 'reload schema';
