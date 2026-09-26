-- Client service tiers catalog + migrate clients.vip_tier → clients.tier_id
-- Safe to run on an existing Studio DB that already has public.clients.

-- 1. Catalog table
CREATE TABLE IF NOT EXISTS public.client_tiers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL,
  label         text NOT NULL,
  rank          smallint NOT NULL,
  description   text,
  is_default    boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_tiers_slug_not_blank CHECK (length(trim(slug)) > 0),
  CONSTRAINT client_tiers_label_not_blank CHECK (length(trim(label)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS client_tiers_slug_uidx
  ON public.client_tiers (slug);

-- At most one default tier
CREATE UNIQUE INDEX IF NOT EXISTS client_tiers_one_default_uidx
  ON public.client_tiers (is_default)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS client_tiers_rank_idx
  ON public.client_tiers (rank);

-- 2. Seed tiers (idempotent)
INSERT INTO public.client_tiers (slug, label, rank, description, is_default, active, config)
VALUES
  ('standard', 'Standard', 1, 'Default guest service level.', true, true, '{}'::jsonb),
  ('vip', 'VIP', 2, 'Elevated service priority.', false, true, '{}'::jsonb),
  ('vvip', 'VVIP', 3, 'Highest service priority.', false, true, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE
SET
  label = EXCLUDED.label,
  rank = EXCLUDED.rank,
  description = EXCLUDED.description,
  is_default = EXCLUDED.is_default,
  active = EXCLUDED.active,
  updated_at = now();

-- 3. Add FK column on clients (nullable during backfill)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tier_id uuid REFERENCES public.client_tiers (id) ON DELETE RESTRICT;

-- 4. Backfill from legacy vip_tier text (if column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'vip_tier'
  ) THEN
    UPDATE public.clients AS c
    SET tier_id = t.id
    FROM public.client_tiers AS t
    WHERE c.tier_id IS NULL
      AND t.slug = c.vip_tier;
  END IF;
END $$;

-- Anyone still missing a tier → default
UPDATE public.clients AS c
SET tier_id = t.id
FROM public.client_tiers AS t
WHERE c.tier_id IS NULL
  AND t.is_default = true;

-- 5. Enforce NOT NULL
ALTER TABLE public.clients
  ALTER COLUMN tier_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS clients_tier_id_idx
  ON public.clients (tier_id);

-- 6. Drop legacy enum column + index
DROP INDEX IF EXISTS public.clients_vip_tier_idx;

ALTER TABLE public.clients
  DROP COLUMN IF EXISTS vip_tier;

-- 7. RLS + service_role grants (service_role bypasses RLS but still needs GRANTs)
ALTER TABLE public.client_tiers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_tiers TO service_role;
