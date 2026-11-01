-- Atlas Wave 1 — hybrid list / card / detail foundation (§I6 step 2 / §I2).
-- Spec: docs/studio/schema-improvements-atlas-rates.md §0.1 (amenities Option A), §I2
-- Depends on: 016 (kb_entities, kb_hotel_details, kb_hotel_room_categories, kb_hotel_consortia),
--             024 (Wave 0).
--
-- Additive only. Safe-ish to re-run: IF NOT EXISTS / ON CONFLICT.

-- =============================================================================
-- 1. kb_entity_media — hero / gallery / room photos
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kb_entity_media (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id          uuid NOT NULL REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  room_category_id   uuid REFERENCES public.kb_hotel_room_categories (id) ON DELETE SET NULL,
  kind               text NOT NULL,
  storage_path       text,
  url                text,
  caption            text,
  sort_order         int NOT NULL DEFAULT 0,
  source             text,
  kb_tier            text NOT NULL DEFAULT 'kb_scraped',
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_entity_media_kind_check
    CHECK (kind IN ('hero', 'gallery', 'room', 'dining', 'spa')),
  CONSTRAINT kb_entity_media_tier_check
    CHECK (kb_tier IN ('kb_verified', 'kb_scraped', 'llm_general')),
  CONSTRAINT kb_entity_media_has_path_or_url
    CHECK (
      (storage_path IS NOT NULL AND length(trim(storage_path)) > 0)
      OR (url IS NOT NULL AND length(trim(url)) > 0)
    ),
  CONSTRAINT kb_entity_media_url_format
    CHECK (
      url IS NULL
      OR url ~* '^https?://'
    )
);

COMMENT ON TABLE public.kb_entity_media IS
  'Hotel / room photos. Cards use kind=hero; detail uses gallery. No rates.';
COMMENT ON COLUMN public.kb_entity_media.room_category_id IS
  'Optional room photo link when kind=room.';

DROP TRIGGER IF EXISTS kb_entity_media_set_updated_at ON public.kb_entity_media;
CREATE TRIGGER kb_entity_media_set_updated_at
  BEFORE UPDATE ON public.kb_entity_media
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS kb_entity_media_entity_kind_idx
  ON public.kb_entity_media (entity_id, kind, sort_order)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS kb_entity_media_room_idx
  ON public.kb_entity_media (room_category_id)
  WHERE room_category_id IS NOT NULL AND active = true;

ALTER TABLE public.kb_entity_media ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_entity_media TO service_role;

-- =============================================================================
-- 2. kb_hotel_stay_info — check-in/out + house rules (1:1)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kb_hotel_stay_info (
  entity_id         uuid PRIMARY KEY REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  check_in_time     text,
  check_out_time    text,
  min_age           int,
  pets_allowed      boolean,
  smoking_policy    text,
  id_requirements   text,
  couple_policy     text,
  extra_rules       jsonb NOT NULL DEFAULT '{}'::jsonb,
  kb_tier           text NOT NULL DEFAULT 'kb_scraped',
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_hotel_stay_info_tier_check
    CHECK (kb_tier IN ('kb_verified', 'kb_scraped', 'llm_general')),
  CONSTRAINT kb_hotel_stay_info_min_age_nonneg
    CHECK (min_age IS NULL OR min_age >= 0),
  CONSTRAINT kb_hotel_stay_info_extra_rules_object
    CHECK (jsonb_typeof(extra_rules) = 'object')
);

COMMENT ON TABLE public.kb_hotel_stay_info IS
  'Guest-facing stay rules (check-in/out, pets, smoking, ID). Commercial cancellation stays on contract policies.';

DROP TRIGGER IF EXISTS kb_hotel_stay_info_set_updated_at ON public.kb_hotel_stay_info;
CREATE TRIGGER kb_hotel_stay_info_set_updated_at
  BEFORE UPDATE ON public.kb_hotel_stay_info
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.kb_hotel_stay_info ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_hotel_stay_info TO service_role;

-- =============================================================================
-- 3. kb_hotel_room_categories — enrichment + external_key
-- =============================================================================

ALTER TABLE public.kb_hotel_room_categories
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS max_adults int,
  ADD COLUMN IF NOT EXISTS max_children int,
  ADD COLUMN IF NOT EXISTS amenities text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS external_key text;

COMMENT ON COLUMN public.kb_hotel_room_categories.external_key IS
  'Stable room upsert key; join to property_contracted_rates.room_category_external_key.';
COMMENT ON COLUMN public.kb_hotel_room_categories.amenities IS
  'Room-level amenity labels (optional). Hotel filters use kb_entity_amenities.';

ALTER TABLE public.kb_hotel_room_categories
  DROP CONSTRAINT IF EXISTS kb_hotel_room_categories_max_adults_positive,
  DROP CONSTRAINT IF EXISTS kb_hotel_room_categories_max_children_nonneg;

ALTER TABLE public.kb_hotel_room_categories
  ADD CONSTRAINT kb_hotel_room_categories_max_adults_positive
    CHECK (max_adults IS NULL OR max_adults >= 1),
  ADD CONSTRAINT kb_hotel_room_categories_max_children_nonneg
    CHECK (max_children IS NULL OR max_children >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS kb_hotel_room_categories_entity_external_key_uidx
  ON public.kb_hotel_room_categories (entity_id, external_key)
  WHERE external_key IS NOT NULL;

-- =============================================================================
-- 4. kb_hotel_partner_perks — client-facing VIP strip (not money math)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kb_hotel_partner_perks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid NOT NULL REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  consortia_id  uuid REFERENCES public.kb_hotel_consortia (id) ON DELETE SET NULL,
  perk_key      text NOT NULL,
  label         text NOT NULL,
  notes         text,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_hotel_partner_perks_perk_key_check
    CHECK (perk_key IN (
      'upgrade',
      'breakfast',
      'resort_credit',
      'early_check_in',
      'late_checkout',
      'other'
    )),
  CONSTRAINT kb_hotel_partner_perks_label_not_blank
    CHECK (length(trim(label)) > 0)
);

COMMENT ON TABLE public.kb_hotel_partner_perks IS
  'Atlas preferred-program / editorial perk labels for advisors and clients. Contract discount math stays in Rate Layer.';

DROP TRIGGER IF EXISTS kb_hotel_partner_perks_set_updated_at ON public.kb_hotel_partner_perks;
CREATE TRIGGER kb_hotel_partner_perks_set_updated_at
  BEFORE UPDATE ON public.kb_hotel_partner_perks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS kb_hotel_partner_perks_entity_idx
  ON public.kb_hotel_partner_perks (entity_id)
  WHERE active = true;

ALTER TABLE public.kb_hotel_partner_perks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_hotel_partner_perks TO service_role;

-- =============================================================================
-- 5. Amenity taxonomy Option A — catalog + entity links
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kb_amenity_catalog (
  amenity_key   text PRIMARY KEY,
  label         text NOT NULL,
  category      text,
  sort_order    int NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,

  CONSTRAINT kb_amenity_catalog_key_format
    CHECK (amenity_key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT kb_amenity_catalog_label_not_blank
    CHECK (length(trim(label)) > 0)
);

COMMENT ON TABLE public.kb_amenity_catalog IS
  'Frozen amenity keys for Trip Builder / hybrid filters. No free-typo soup.';

CREATE TABLE IF NOT EXISTS public.kb_entity_amenities (
  entity_id     uuid NOT NULL REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  amenity_key   text NOT NULL REFERENCES public.kb_amenity_catalog (amenity_key) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (entity_id, amenity_key)
);

COMMENT ON TABLE public.kb_entity_amenities IS
  'Hotel ↔ amenity_key links. Filter with amenity_key only.';

CREATE INDEX IF NOT EXISTS kb_entity_amenities_key_idx
  ON public.kb_entity_amenities (amenity_key);

ALTER TABLE public.kb_amenity_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_entity_amenities ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_amenity_catalog TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_entity_amenities TO service_role;

INSERT INTO public.kb_amenity_catalog (amenity_key, label, category, sort_order)
VALUES
  ('spa', 'Spa', 'wellness', 10),
  ('pool', 'Pool', 'wellness', 20),
  ('private_pool', 'Private pool', 'wellness', 30),
  ('kids_club', 'Kids club', 'family', 40),
  ('beach', 'Beach access', 'location', 50),
  ('gym', 'Gym / fitness', 'wellness', 60),
  ('restaurant', 'Restaurant', 'dining', 70),
  ('bar', 'Bar', 'dining', 80),
  ('wifi', 'Wi‑Fi', 'room', 90),
  ('bathtub', 'Bathtub', 'room', 100),
  ('overwater', 'Overwater', 'location', 110),
  ('adults_only', 'Adults only', 'policy', 120),
  ('family_friendly', 'Family friendly', 'family', 130),
  ('butler', 'Butler service', 'service', 140),
  ('transfer', 'Airport transfer', 'service', 150)
ON CONFLICT (amenity_key) DO NOTHING;

-- Ensure catalog rows exist for any legacy free-text amenities (normalized keys).
INSERT INTO public.kb_amenity_catalog (amenity_key, label, category, sort_order)
SELECT DISTINCT
  lower(regexp_replace(trim(a), '[^a-zA-Z0-9]+', '_', 'g')),
  initcap(replace(trim(a), '_', ' ')),
  'imported',
  900
FROM public.kb_hotel_details d
CROSS JOIN LATERAL unnest(d.amenities) AS a
WHERE length(trim(a)) > 0
  AND lower(regexp_replace(trim(a), '[^a-zA-Z0-9]+', '_', 'g')) ~ '^[a-z][a-z0-9_]*$'
ON CONFLICT (amenity_key) DO NOTHING;

INSERT INTO public.kb_entity_amenities (entity_id, amenity_key)
SELECT DISTINCT
  d.entity_id,
  lower(regexp_replace(trim(a), '[^a-zA-Z0-9]+', '_', 'g'))
FROM public.kb_hotel_details d
CROSS JOIN LATERAL unnest(d.amenities) AS a
WHERE length(trim(a)) > 0
  AND lower(regexp_replace(trim(a), '[^a-zA-Z0-9]+', '_', 'g')) ~ '^[a-z][a-z0-9_]*$'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 6. kb_hotel_details — best_for / not_ideal_for
-- =============================================================================

ALTER TABLE public.kb_hotel_details
  ADD COLUMN IF NOT EXISTS best_for text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS not_ideal_for text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.kb_hotel_details.best_for IS
  'Audience / trip-style tags this hotel suits (honeymoon, family, …).';
COMMENT ON COLUMN public.kb_hotel_details.not_ideal_for IS
  'Audience / trip-style tags this hotel is a poor fit for.';

CREATE INDEX IF NOT EXISTS kb_hotel_details_best_for_idx
  ON public.kb_hotel_details USING gin (best_for);
