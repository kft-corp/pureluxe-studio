-- Atlas + Rate Wave 0 (schema-improvements-atlas-rates.md §I6 step 1 / §H1 / Part D P0+P1).
-- Spec: docs/studio/schema-improvements-atlas-rates.md §0.1, §I1, §H1
-- Depends on: 011 (properties, property_contracts, property_contracted_rates),
--             016 (kb_entities, kb_hotel_details, kb_cities, …), 021 (price_tier, market_codes).
--
-- Additive only. Do NOT edit 011 / 016 / 021.
-- Safe-ish to re-run: IF NOT EXISTS / DO blocks / DROP IF EXISTS.
-- Dev/test: wipe Atlas + Rate data before or after; re-seed with external_key.

-- =============================================================================
-- 1. kb_entities — external_key + aliases (Excel upsert / Door B match)
-- =============================================================================

ALTER TABLE public.kb_entities
  ADD COLUMN IF NOT EXISTS external_key text,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.kb_entities.external_key IS
  'Stable kebab-case upsert key from Excel / founder sheet. Prefer over fuzzy name.';
COMMENT ON COLUMN public.kb_entities.aliases IS
  'Alternate hotel names for Door B / typeahead match.';

UPDATE public.kb_entities e
SET external_key = nullif(trim(e.external_ids ->> 'atlas_sheet_key'), '')
WHERE e.external_key IS NULL
  AND e.external_ids ? 'atlas_sheet_key'
  AND length(trim(e.external_ids ->> 'atlas_sheet_key')) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS kb_entities_external_key_uidx
  ON public.kb_entities (external_key)
  WHERE external_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS kb_entities_aliases_idx
  ON public.kb_entities USING gin (aliases);

-- =============================================================================
-- 2. properties — external_key (contract / supplier join)
-- =============================================================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS external_key text;

COMMENT ON COLUMN public.properties.external_key IS
  'Stable upsert key; prefer identical string to linked kb_entities.external_key.';

-- Backfill from linked Atlas row when present.
UPDATE public.properties p
SET external_key = e.external_key
FROM public.kb_entities e
WHERE e.property_id = p.id
  AND e.external_key IS NOT NULL
  AND p.external_key IS NULL
  AND e.entity_type = 'hotel'
  AND e.active = true;

CREATE UNIQUE INDEX IF NOT EXISTS properties_external_key_uidx
  ON public.properties (external_key)
  WHERE external_key IS NOT NULL;

-- =============================================================================
-- 3. DROP properties.curated_hotel_id — canonical link = kb_entities.property_id
-- =============================================================================

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_curated_hotel_id_fkey;

DROP INDEX IF EXISTS public.properties_curated_hotel_idx;

ALTER TABLE public.properties
  DROP COLUMN IF EXISTS curated_hotel_id;

-- =============================================================================
-- 4. property_contracts — optional external_key for re-import
-- =============================================================================

ALTER TABLE public.property_contracts
  ADD COLUMN IF NOT EXISTS external_key text;

COMMENT ON COLUMN public.property_contracts.external_key IS
  'Optional idempotent re-import key for the same PDF / season.';

CREATE UNIQUE INDEX IF NOT EXISTS property_contracts_external_key_uidx
  ON public.property_contracts (external_key)
  WHERE external_key IS NOT NULL;

COMMENT ON COLUMN public.property_contracts.market_codes IS
  'Canonical market restriction (ISO country codes). Empty = all markets. Free-text market is display-only.';

-- =============================================================================
-- 5. property_contracted_rates — contract_id NOT NULL + safer meal defaults
-- =============================================================================

-- Orphans cannot survive NOT NULL; delete in test (wipe/re-seed is expected).
DELETE FROM public.property_contracted_rates
WHERE contract_id IS NULL;

ALTER TABLE public.property_contracted_rates
  ALTER COLUMN contract_id SET NOT NULL;

ALTER TABLE public.property_contracted_rates
  ALTER COLUMN includes_breakfast SET DEFAULT false;

ALTER TABLE public.property_contracted_rates
  ALTER COLUMN includes_lunch SET DEFAULT false;

ALTER TABLE public.property_contracted_rates
  ALTER COLUMN includes_dinner SET DEFAULT false;

COMMENT ON COLUMN public.property_contracted_rates.contract_id IS
  'Required Layer 1 parent contract. No orphan rate rows.';
COMMENT ON COLUMN public.property_contracted_rates.includes_breakfast IS
  'Default false — do not invent breakfast when board/import omits it.';

-- =============================================================================
-- 6. kb_hotel_details — RENAME price_tier → luxury_band (§0.1)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kb_hotel_details'
      AND column_name = 'price_tier'
  ) THEN
    ALTER TABLE public.kb_hotel_details
      RENAME COLUMN price_tier TO luxury_band;
  END IF;
END $$;

ALTER TABLE public.kb_hotel_details
  DROP CONSTRAINT IF EXISTS kb_hotel_details_price_tier_check;

ALTER TABLE public.kb_hotel_details
  DROP CONSTRAINT IF EXISTS kb_hotel_details_luxury_band_check;

ALTER TABLE public.kb_hotel_details
  ADD CONSTRAINT kb_hotel_details_luxury_band_check
    CHECK (
      luxury_band IS NULL
      OR luxury_band IN ('ultra_luxury', 'luxury', 'premium')
    );

DROP INDEX IF EXISTS public.kb_hotel_details_price_tier_idx;

CREATE INDEX IF NOT EXISTS kb_hotel_details_luxury_band_idx
  ON public.kb_hotel_details (luxury_band)
  WHERE luxury_band IS NOT NULL;

COMMENT ON COLUMN public.kb_hotel_details.luxury_band IS
  'Hotels-sheet band: ultra_luxury / luxury / premium. Not a currency amount (renamed from price_tier).';

-- search_properties: return luxury_band (was price_tier). Must DROP — return type changed.
DROP FUNCTION IF EXISTS public.search_properties(text, text, int);

CREATE OR REPLACE FUNCTION public.search_properties(
  q text,
  dest text DEFAULT NULL,
  lim int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  name text,
  destination text,
  city text,
  country text,
  score real,
  aliases text[],
  luxury_band text,
  style_tags text[]
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.name,
    p.destination,
    p.city,
    p.country,
    GREATEST(
      CASE WHEN lower(p.name) = lower(trim(q)) THEN 1.0 ELSE 0 END,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM unnest(p.aliases) a WHERE lower(a) = lower(trim(q))
        ) THEN 0.95
        ELSE 0
      END,
      similarity(p.name, trim(q)),
      COALESCE(
        (
          SELECT max(similarity(a, trim(q)))
          FROM unnest(p.aliases) a
        ),
        0
      )
    )::real AS score,
    p.aliases,
    d.luxury_band,
    COALESCE(d.style_tags, '{}'::text[]) AS style_tags
  FROM public.properties p
  LEFT JOIN public.kb_entities e
    ON e.property_id = p.id
   AND e.active = true
   AND e.entity_type = 'hotel'
  LEFT JOIN public.kb_hotel_details d
    ON d.entity_id = e.id
  WHERE p.active
    AND length(trim(q)) >= 2
    AND (
      dest IS NULL
      OR length(trim(dest)) = 0
      OR lower(coalesce(p.destination, '')) = lower(trim(dest))
      OR lower(coalesce(p.country, '')) = lower(trim(dest))
      OR lower(coalesce(p.city, '')) = lower(trim(dest))
    )
    AND (
      p.name % trim(q)
      OR p.name ILIKE '%' || trim(q) || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(p.aliases) a
        WHERE lower(a) = lower(trim(q))
           OR a ILIKE '%' || trim(q) || '%'
           OR a % trim(q)
      )
    )
  ORDER BY score DESC, p.name
  LIMIT greatest(1, least(coalesce(lim, 8), 20));
$$;

COMMENT ON FUNCTION public.search_properties(text, text, int) IS
  'Ranked active hotels by name/alias (pg_trgm). Optional destination filter. Includes Atlas luxury_band and style tags when linked.';

GRANT EXECUTE ON FUNCTION public.search_properties(text, text, int) TO service_role;

-- =============================================================================
-- 7. kb_entity_contacts — Property Contacts Excel (ops only; never client PDF)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kb_entity_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   uuid NOT NULL REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  title       text,
  name        text,
  email       text,
  phone       text,
  mobile      text,
  role_tags   text[] NOT NULL DEFAULT '{}'::text[],
  source      text,
  kb_tier     text NOT NULL DEFAULT 'kb_scraped',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_entity_contacts_tier_check
    CHECK (kb_tier IN ('kb_verified', 'kb_scraped', 'llm_general')),
  CONSTRAINT kb_entity_contacts_email_format
    CHECK (
      email IS NULL
      OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    )
);

COMMENT ON TABLE public.kb_entity_contacts IS
  'Hotel staff contacts (GM / sales / reservations). Ops only — not client PDF by default.';
COMMENT ON COLUMN public.kb_entity_contacts.role_tags IS
  'gm, sales, reservations, …';

DROP TRIGGER IF EXISTS kb_entity_contacts_set_updated_at ON public.kb_entity_contacts;
CREATE TRIGGER kb_entity_contacts_set_updated_at
  BEFORE UPDATE ON public.kb_entity_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS kb_entity_contacts_entity_idx
  ON public.kb_entity_contacts (entity_id)
  WHERE active = true;

CREATE UNIQUE INDEX IF NOT EXISTS kb_entity_contacts_entity_email_uidx
  ON public.kb_entity_contacts (entity_id, lower(email))
  WHERE email IS NOT NULL AND active = true;

ALTER TABLE public.kb_entity_contacts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_entity_contacts TO service_role;

-- =============================================================================
-- 8. import_batches — dry-run / apply audit
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.import_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_path     text NOT NULL,
  workbook_kind   text,
  tab_name        text,
  dry_run         boolean NOT NULL DEFAULT true,
  total_rows      int NOT NULL DEFAULT 0,
  created_count   int NOT NULL DEFAULT 0,
  updated_count   int NOT NULL DEFAULT 0,
  skipped_count   int NOT NULL DEFAULT 0,
  failed_count    int NOT NULL DEFAULT 0,
  error_log       jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_by_id   uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT import_batches_source_path_not_blank
    CHECK (length(trim(source_path)) > 0),
  CONSTRAINT import_batches_counts_nonneg
    CHECK (
      total_rows >= 0
      AND created_count >= 0
      AND updated_count >= 0
      AND skipped_count >= 0
      AND failed_count >= 0
    ),
  CONSTRAINT import_batches_error_log_array
    CHECK (jsonb_typeof(error_log) = 'array'),
  CONSTRAINT import_batches_meta_object
    CHECK (jsonb_typeof(meta) = 'object')
);

COMMENT ON TABLE public.import_batches IS
  'Audit of Atlas / Rate Excel import dry-run and apply runs. Ops only.';
COMMENT ON COLUMN public.import_batches.error_log IS
  'Capped list of row errors / warnings (prefer ≤ ~200 lines in app).';

CREATE INDEX IF NOT EXISTS import_batches_started_at_idx
  ON public.import_batches (started_at DESC);

CREATE INDEX IF NOT EXISTS import_batches_source_path_idx
  ON public.import_batches (source_path, started_at DESC);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO service_role;

-- =============================================================================
-- 9. Derive country/region from city on kb_entities write (geography drift)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.kb_entities_sync_place_from_city()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_country_id uuid;
  v_region_id uuid;
BEGIN
  IF NEW.city_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.country_id, co.region_id
  INTO v_country_id, v_region_id
  FROM public.kb_cities c
  JOIN public.kb_countries co ON co.id = c.country_id
  WHERE c.id = NEW.city_id;

  IF v_country_id IS NOT NULL THEN
    NEW.country_id := v_country_id;
  END IF;
  IF v_region_id IS NOT NULL THEN
    NEW.region_id := v_region_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.kb_entities_sync_place_from_city() IS
  'When city_id is set, fill country_id and region_id from the place tree.';

DROP TRIGGER IF EXISTS kb_entities_sync_place_from_city ON public.kb_entities;
CREATE TRIGGER kb_entities_sync_place_from_city
  BEFORE INSERT OR UPDATE OF city_id ON public.kb_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_entities_sync_place_from_city();
