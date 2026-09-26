-- Rate Layer + Knowledge Base schema (Layers 1–4 + KB for RAG).
-- Spec: docs/studio/rate-layer.md
-- Depends on: 001 (team_members, set_updated_at), 002 (studio_permissions), 003 (pg_trgm).
-- Safe to re-run: IF NOT EXISTS / ON CONFLICT / CREATE OR REPLACE where practical.
--
-- Does NOT create trip_line_items (Trip Builder — 012_trips_kernel.sql).
-- Does NOT create a global rates catalogue.
--
-- INSERT policy: permanent system rows + founder-confirmed seeds (Layer 2 places,
-- ski peak windows, negotiated program labels, Pure Escapes↔Maldives binding).
-- No fake hotels, KB facts, or invented live GDS access codes.
--
-- =============================================================================
-- RECREATE / CLEANUP (run in Supabase SQL editor BEFORE this migration if needed)
-- =============================================================================
-- If you already applied the old Path-style 011, drop obsolete + Rate Layer tables
-- you want rebuilt. Null trip/booking property FKs first if you drop properties:
--
--   UPDATE public.trip_line_items SET property_id = NULL WHERE property_id IS NOT NULL;
--   UPDATE public.trip_legs SET property_id = NULL WHERE property_id IS NOT NULL;
--   UPDATE public.bookings SET property_id = NULL WHERE property_id IS NOT NULL;
--
--   DROP TABLE IF EXISTS public.high_value_routing CASCADE;
--   DROP TABLE IF EXISTS public.wholesaler_destinations CASCADE;
--   DROP TABLE IF EXISTS public.offline_trip_types CASCADE;
--   DROP TABLE IF EXISTS public.property_contracted_rates CASCADE;
--   DROP TABLE IF EXISTS public.property_supplier_codes CASCADE;
--   DROP TABLE IF EXISTS public.rate_peak_windows CASCADE;
--   DROP TABLE IF EXISTS public.destination_wholesalers CASCADE;
--   DROP TABLE IF EXISTS public.destination_routing_overrides CASCADE;
--   DROP TABLE IF EXISTS public.negotiated_rate_codes CASCADE;
--   DROP TABLE IF EXISTS public.kb_fact_chunks CASCADE;
--   DROP TABLE IF EXISTS public.kb_facts CASCADE;
--   DROP TABLE IF EXISTS public.kb_entities CASCADE;
--   DROP TABLE IF EXISTS public.kb_sources CASCADE;
--   DROP TABLE IF EXISTS public.destination_profiles CASCADE;
--   DROP TABLE IF EXISTS public.destination_type_defaults CASCADE;
--   DROP TABLE IF EXISTS public.properties CASCADE;
--   DROP TABLE IF EXISTS public.company_settings CASCADE;
--   -- optional audit: DROP TABLE IF EXISTS public.rate_search_events CASCADE;
--
-- Then run this migration (or paste its body) to create the full schema once.

-- Optional: semantic RAG (KB-R2). Safe if extension already present.
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop obsolete Path-style tables from early 011 (no longer used).
DROP TABLE IF EXISTS public.high_value_routing CASCADE;
DROP TABLE IF EXISTS public.wholesaler_destinations CASCADE;
DROP TABLE IF EXISTS public.offline_trip_types CASCADE;

-- =============================================================================
-- 1. company_settings
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.company_settings (
  key            text PRIMARY KEY,
  value          jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by_id  uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT company_settings_key_format
    CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT company_settings_key_not_blank
    CHECK (length(trim(key)) > 0)
);

COMMENT ON TABLE public.company_settings IS
  'Studio company-wide settings (key → jsonb). rate_sources + knowledge_base live here.';

DROP TRIGGER IF EXISTS company_settings_set_updated_at ON public.company_settings;
CREATE TRIGGER company_settings_set_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.company_settings (key, value)
VALUES (
  'rate_sources',
  '{
    "default_currency": "USD",
    "allow_offline_paste": true,
    "gds_undercut_pct": 10,
    "gds_compare_mode": "cheaper_of_public_or_negotiated",
    "always_surface_negotiated_gds": true,
    "offline_availability_check": true,
    "sources": {
      "gds_public": { "enabled": true },
      "gds_negotiated": { "enabled": true },
      "ota_bedbank": { "enabled": false },
      "wholesale": { "enabled": false },
      "offline_contracted": { "enabled": true },
      "offline_manual": { "enabled": true }
    }
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

INSERT INTO public.company_settings (key, value)
VALUES (
  'knowledge_base',
  '{
    "scrape_enabled": false,
    "fallback_llm_enabled": true,
    "guest_review_factcheck_enabled": false
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

-- =============================================================================
-- 2. destination_type_defaults (Layer 3)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.destination_type_defaults (
  destination_type  text PRIMARY KEY,
  pattern           text NOT NULL,
  notes             text,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT destination_type_defaults_type_check
    CHECK (destination_type IN (
      'city_countryside',
      'resort_beach',
      'ski',
      'safari_yacht_special',
      'untyped'
    )),
  CONSTRAINT destination_type_defaults_pattern_check
    CHECK (pattern IN (
      'gds_first',
      'wholesale_first',
      'parallel_lowest',
      'offline_only',
      'gds_then_offline_at_peak',
      'custom'
    ))
);

COMMENT ON TABLE public.destination_type_defaults IS
  'Layer 3: default shopping pattern per destination type.';

DROP TRIGGER IF EXISTS destination_type_defaults_set_updated_at ON public.destination_type_defaults;
CREATE TRIGGER destination_type_defaults_set_updated_at
  BEFORE UPDATE ON public.destination_type_defaults
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.destination_type_defaults (destination_type, pattern, notes)
VALUES
  ('city_countryside', 'gds_first', 'GDS public + negotiated first; surface both.'),
  ('resort_beach', 'wholesale_first', 'Wholesale first; GDS/Hotelbeds if wholesale empty.'),
  ('ski', 'gds_then_offline_at_peak', 'GDS/Hotelbeds first; in peak windows if zero rooms → offline paste.'),
  ('safari_yacht_special', 'offline_only', 'Never auto-shop GDS / Hotelbeds / wholesale.'),
  ('untyped', 'custom', 'No type match → fall through to Layer 4 company defaults.')
ON CONFLICT (destination_type) DO UPDATE
SET pattern = EXCLUDED.pattern,
    notes = EXCLUDED.notes,
    updated_at = now();

-- =============================================================================
-- 3. destination_profiles
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.destination_profiles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name     text NOT NULL,
  aliases            jsonb NOT NULL DEFAULT '[]'::jsonb,
  destination_type   text NOT NULL DEFAULT 'untyped'
                       REFERENCES public.destination_type_defaults (destination_type),
  notes              text,
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT destination_profiles_name_not_blank
    CHECK (length(trim(canonical_name)) > 0),
  CONSTRAINT destination_profiles_aliases_is_array
    CHECK (jsonb_typeof(aliases) = 'array')
);

COMMENT ON TABLE public.destination_profiles IS
  'Normalize free-text destinations (trip legs) → type + Layer 2 hooks.';
COMMENT ON COLUMN public.destination_profiles.aliases IS
  'JSON string array, e.g. ["MLE","Malé","maldives"].';

DROP TRIGGER IF EXISTS destination_profiles_set_updated_at ON public.destination_profiles;
CREATE TRIGGER destination_profiles_set_updated_at
  BEFORE UPDATE ON public.destination_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS destination_profiles_canonical_name_uidx
  ON public.destination_profiles (lower(canonical_name));

CREATE INDEX IF NOT EXISTS destination_profiles_type_idx
  ON public.destination_profiles (destination_type)
  WHERE active = true;

-- Founder-confirmed Layer 2 starters (list will grow in Settings).
INSERT INTO public.destination_profiles (canonical_name, aliases, destination_type, notes)
SELECT v.canonical_name, v.aliases::jsonb, v.destination_type, v.notes
FROM (
  VALUES
    ('Maldives', '["MLE","Malé","Male","maldives"]', 'resort_beach', 'Layer 2 wholesale_first'),
    ('Dubai', '["DXB","dubai"]', 'city_countryside', 'Layer 2 parallel_lowest'),
    ('Bali', '["DPS","bali"]', 'resort_beach', 'Layer 2 parallel_lowest'),
    ('Doha', '["DOH","doha"]', 'city_countryside', 'Layer 2 parallel_lowest')
) AS v(canonical_name, aliases, destination_type, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.destination_profiles p
  WHERE lower(p.canonical_name) = lower(v.canonical_name)
);

-- =============================================================================
-- 4. destination_routing_overrides (Layer 2)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.destination_routing_overrides (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_profile_id   uuid NOT NULL REFERENCES public.destination_profiles (id) ON DELETE CASCADE,
  pattern                  text NOT NULL,
  custom_source_order      jsonb,
  notes                    text,
  active                   boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT destination_routing_overrides_pattern_check
    CHECK (pattern IN ('wholesale_first', 'parallel_lowest', 'custom')),
  CONSTRAINT destination_routing_overrides_custom_order_shape
    CHECK (
      custom_source_order IS NULL
      OR jsonb_typeof(custom_source_order) = 'array'
    )
);

COMMENT ON TABLE public.destination_routing_overrides IS
  'Layer 2: per-destination shopping pattern (admin enable/disable via active).';

DROP TRIGGER IF EXISTS destination_routing_overrides_set_updated_at
  ON public.destination_routing_overrides;
CREATE TRIGGER destination_routing_overrides_set_updated_at
  BEFORE UPDATE ON public.destination_routing_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS destination_routing_overrides_profile_uidx
  ON public.destination_routing_overrides (destination_profile_id)
  WHERE active = true;

-- Founder-confirmed Layer 2 patterns.
INSERT INTO public.destination_routing_overrides (destination_profile_id, pattern, notes)
SELECT p.id, v.pattern, v.notes
FROM (
  VALUES
    ('Maldives', 'wholesale_first', 'Founder confirmed'),
    ('Dubai', 'parallel_lowest', 'Founder confirmed'),
    ('Bali', 'parallel_lowest', 'Founder confirmed'),
    ('Doha', 'parallel_lowest', 'Founder confirmed')
) AS v(canonical_name, pattern, notes)
JOIN public.destination_profiles p ON lower(p.canonical_name) = lower(v.canonical_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.destination_routing_overrides o
  WHERE o.destination_profile_id = p.id AND o.active = true
);

-- =============================================================================
-- 5. destination_wholesalers
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.destination_wholesalers (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_profile_id   uuid NOT NULL REFERENCES public.destination_profiles (id) ON DELETE CASCADE,
  wholesaler_name          text NOT NULL,
  supplier_key             text NOT NULL,
  priority                 int NOT NULL DEFAULT 100,
  notes                    text,
  active                   boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT destination_wholesalers_name_not_blank
    CHECK (length(trim(wholesaler_name)) > 0),
  CONSTRAINT destination_wholesalers_supplier_key_format
    CHECK (supplier_key ~ '^[a-z][a-z0-9_]*$')
);

COMMENT ON TABLE public.destination_wholesalers IS
  'Which wholesaler adapter(s) bind to a destination. Fill when partners confirmed.';

DROP TRIGGER IF EXISTS destination_wholesalers_set_updated_at ON public.destination_wholesalers;
CREATE TRIGGER destination_wholesalers_set_updated_at
  BEFORE UPDATE ON public.destination_wholesalers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS destination_wholesalers_profile_idx
  ON public.destination_wholesalers (destination_profile_id)
  WHERE active = true;

-- Founder: Pure Escapes is the wholesaler today; API not live yet — keep disabled.
INSERT INTO public.destination_wholesalers (
  destination_profile_id, wholesaler_name, supplier_key, priority, notes, active
)
SELECT p.id, 'Pure Escapes', 'wholesale_pure_escapes', 10,
       'Founder partner — enable when wholesale API credentials are live', false
FROM public.destination_profiles p
WHERE lower(p.canonical_name) = 'maldives'
  AND NOT EXISTS (
    SELECT 1 FROM public.destination_wholesalers w
    WHERE w.destination_profile_id = p.id
      AND w.supplier_key = 'wholesale_pure_escapes'
  );

-- =============================================================================
-- 6. rate_peak_windows (ski / festive)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_peak_windows (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_profile_id   uuid REFERENCES public.destination_profiles (id) ON DELETE CASCADE,
  destination_type         text REFERENCES public.destination_type_defaults (destination_type),
  name                     text NOT NULL,
  start_date               date NOT NULL,
  end_date                 date NOT NULL,
  behaviour                text NOT NULL DEFAULT 'offline_if_zero_gds',
  notes                    text,
  active                   boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rate_peak_windows_name_not_blank
    CHECK (length(trim(name)) > 0),
  CONSTRAINT rate_peak_windows_dates_ok
    CHECK (end_date >= start_date),
  CONSTRAINT rate_peak_windows_behaviour_check
    CHECK (behaviour IN ('offline_if_zero_gds')),
  CONSTRAINT rate_peak_windows_scope_present
    CHECK (destination_profile_id IS NOT NULL OR destination_type IS NOT NULL)
);

COMMENT ON TABLE public.rate_peak_windows IS
  'Date windows that change Layer 3 ski (and future) behaviour.';

DROP TRIGGER IF EXISTS rate_peak_windows_set_updated_at ON public.rate_peak_windows;
CREATE TRIGGER rate_peak_windows_set_updated_at
  BEFORE UPDATE ON public.rate_peak_windows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS rate_peak_windows_dates_idx
  ON public.rate_peak_windows (start_date, end_date)
  WHERE active = true;

-- Founder ski busy dates (ops updates yearly for new seasons).
INSERT INTO public.rate_peak_windows (
  destination_type, name, start_date, end_date, behaviour, notes
)
SELECT 'ski', v.name, v.start_date::date, v.end_date::date, 'offline_if_zero_gds', v.notes
FROM (
  VALUES
    ('Christmas / New Year week', '2026-12-20', '2027-01-03', 'Founder: ~20 Dec–3 Jan'),
    ('February half-term', '2027-02-13', '2027-02-21', 'Founder: 13–21 Feb')
) AS v(name, start_date, end_date, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.rate_peak_windows w
  WHERE w.name = v.name AND w.start_date = v.start_date::date
);

-- =============================================================================
-- 7. negotiated_rate_codes
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.negotiated_rate_codes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL,
  label          text NOT NULL,
  supplier_key   text NOT NULL DEFAULT 'sabre',
  chains         jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes          text,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT negotiated_rate_codes_code_not_blank
    CHECK (length(trim(code)) > 0),
  CONSTRAINT negotiated_rate_codes_label_not_blank
    CHECK (length(trim(label)) > 0),
  CONSTRAINT negotiated_rate_codes_supplier_key_format
    CHECK (supplier_key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT negotiated_rate_codes_chains_is_array
    CHECK (jsonb_typeof(chains) = 'array')
);

COMMENT ON TABLE public.negotiated_rate_codes IS
  'GDS negotiated / consortia codes PureLuxe holds. Admin enable/disable per row.';
COMMENT ON COLUMN public.negotiated_rate_codes.code IS
  'GDS access code. Seed uses stable slugs from founder program names until ops replaces with live Sabre codes.';

DROP TRIGGER IF EXISTS negotiated_rate_codes_set_updated_at ON public.negotiated_rate_codes;
CREATE TRIGGER negotiated_rate_codes_set_updated_at
  BEFORE UPDATE ON public.negotiated_rate_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS negotiated_rate_codes_supplier_code_uidx
  ON public.negotiated_rate_codes (supplier_key, lower(code));

-- Founder consortia/chain program list (replace code with live GDS access code when known).
INSERT INTO public.negotiated_rate_codes (code, label, supplier_key, notes)
SELECT v.code, v.label, 'sabre', 'Founder list — replace code with live GDS access code when known'
FROM (
  VALUES
    ('serandipians', 'Serandipians'),
    ('four_seasons', 'Four Seasons'),
    ('mandarin_oriental', 'Mandarin Oriental'),
    ('peninsula', 'Peninsula'),
    ('dorchester_collection', 'Dorchester Collection'),
    ('hilton_for_luxury', 'Hilton For Luxury'),
    ('marriott_stars', 'Marriott Stars'),
    ('accor', 'Accor'),
    ('rocco_forte', 'Rocco Forte'),
    ('lhw_vita', 'LHW Vita'),
    ('hyatt_prive', 'Hyatt Privé'),
    ('shangri_la', 'Shangri-La'),
    ('ihg', 'IHG'),
    ('rosewood_elite', 'Rosewood Elite'),
    ('jumeirah', 'Jumeirah'),
    ('slh', 'SLH'),
    ('preferred', 'Preferred'),
    ('como_metropolitan_london', 'Como Metropolitan London')
) AS v(code, label)
WHERE NOT EXISTS (
  SELECT 1 FROM public.negotiated_rate_codes n
  WHERE n.supplier_key = 'sabre' AND lower(n.code) = lower(v.code)
);

-- =============================================================================
-- 8. Knowledge Base — sources, entities, facts (RAG retrieve)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kb_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  source_kind     text NOT NULL DEFAULT 'website',
  base_url        text,
  scrape_method   text,
  tos_notes       text,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_sources_name_not_blank
    CHECK (length(trim(name)) > 0),
  CONSTRAINT kb_sources_kind_check
    CHECK (source_kind IN (
      'website',
      'drive_doc',
      'advisor_note',
      'hotel_intake',
      'consortia_portal',
      'tourism_board',
      'other'
    ))
);

COMMENT ON TABLE public.kb_sources IS
  'Approved KB scrape/intake sources (Sources Tracker). Toggle active to enable/disable.';

DROP TRIGGER IF EXISTS kb_sources_set_updated_at ON public.kb_sources;
CREATE TRIGGER kb_sources_set_updated_at
  BEFORE UPDATE ON public.kb_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS kb_sources_name_uidx
  ON public.kb_sources (lower(name));

CREATE TABLE IF NOT EXISTS public.kb_entities (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type              text NOT NULL,
  name                     text NOT NULL,
  destination_profile_id   uuid REFERENCES public.destination_profiles (id) ON DELETE SET NULL,
  linked_property_id       uuid, -- FK added after properties exists
  external_keys            jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes                    text,
  active                   boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_entities_name_not_blank
    CHECK (length(trim(name)) > 0),
  CONSTRAINT kb_entities_type_check
    CHECK (entity_type IN ('property', 'destination', 'dining', 'experience', 'other'))
);

COMMENT ON TABLE public.kb_entities IS
  'KB content entities (hotel / destination / dining). No prices.';

DROP TRIGGER IF EXISTS kb_entities_set_updated_at ON public.kb_entities;
CREATE TRIGGER kb_entities_set_updated_at
  BEFORE UPDATE ON public.kb_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS kb_entities_type_name_idx
  ON public.kb_entities (entity_type, lower(name))
  WHERE active = true;

CREATE TABLE IF NOT EXISTS public.kb_facts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       uuid NOT NULL REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  source_id       uuid REFERENCES public.kb_sources (id) ON DELETE SET NULL,
  title           text,
  body            text NOT NULL,
  provenance      text NOT NULL,
  status          text NOT NULL DEFAULT 'draft',
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by_id   uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_facts_body_not_blank
    CHECK (length(trim(body)) > 0),
  CONSTRAINT kb_facts_provenance_check
    CHECK (provenance IN ('verified', 'scraped', 'fallback')),
  CONSTRAINT kb_facts_status_check
    CHECK (status IN ('draft', 'approved', 'archived'))
);

COMMENT ON TABLE public.kb_facts IS
  'KB facts (full note). Semantic RAG searches kb_fact_chunks, not this table.';

DROP TRIGGER IF EXISTS kb_facts_set_updated_at ON public.kb_facts;
CREATE TRIGGER kb_facts_set_updated_at
  BEFORE UPDATE ON public.kb_facts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS kb_facts_entity_status_idx
  ON public.kb_facts (entity_id, status, provenance);

CREATE INDEX IF NOT EXISTS kb_facts_body_trgm_idx
  ON public.kb_facts USING gin (body gin_trgm_ops)
  WHERE status = 'approved';

-- =============================================================================
-- 8b. kb_fact_chunks (semantic RAG — one fact → many vectors)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kb_fact_chunks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id          uuid NOT NULL REFERENCES public.kb_facts (id) ON DELETE CASCADE,
  chunk_index      int NOT NULL DEFAULT 0,
  chunk_text       text NOT NULL,
  embedding        vector(1536),
  embedding_model  text,
  token_count      int,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_fact_chunks_text_not_blank
    CHECK (length(trim(chunk_text)) > 0),
  CONSTRAINT kb_fact_chunks_index_nonneg
    CHECK (chunk_index >= 0),
  UNIQUE (fact_id, chunk_index)
);

COMMENT ON TABLE public.kb_fact_chunks IS
  'Searchable pieces of approved kb_facts. Create/rebuild chunks when a fact is approved or body changes; delete when archived.';
COMMENT ON COLUMN public.kb_fact_chunks.embedding IS
  'pgvector embedding for semantic search. Null until embedded. Dimension must match embedding_model.';
COMMENT ON COLUMN public.kb_fact_chunks.chunk_text IS
  'Text piece used for embedding and citation in Trip Builder answers.';

DROP TRIGGER IF EXISTS kb_fact_chunks_set_updated_at ON public.kb_fact_chunks;
CREATE TRIGGER kb_fact_chunks_set_updated_at
  BEFORE UPDATE ON public.kb_fact_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS kb_fact_chunks_fact_id_idx
  ON public.kb_fact_chunks (fact_id);

CREATE INDEX IF NOT EXISTS kb_fact_chunks_text_trgm_idx
  ON public.kb_fact_chunks USING gin (chunk_text gin_trgm_ops);

-- Semantic (ivfflat/hnsw) index: create after embeddings exist, e.g.
--   CREATE INDEX kb_fact_chunks_embedding_ivfflat_idx
--     ON public.kb_fact_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
--     WHERE embedding IS NOT NULL;

-- =============================================================================
-- 9. properties (thin hotel master)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.properties (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     text NOT NULL,
  destination              text,
  brand                    text,
  chain                    text,
  city                     text,
  country                  text,
  region                   text,
  property_type            text,
  destination_profile_id   uuid REFERENCES public.destination_profiles (id) ON DELETE SET NULL,
  curated_hotel_id         uuid REFERENCES public.kb_entities (id) ON DELETE SET NULL,
  default_commission       numeric,
  commission_channel       text,
  commissionable           boolean,
  relationship_strength    text,
  booking_notes            text,
  vip_contact_notes        text,
  reservations_email       text,
  general_phone            text,
  active                   boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT properties_name_not_blank CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE public.properties IS
  'Thin hotel master for Rate Layer routing. Guest editorial lives in KB. No sell prices.';
COMMENT ON COLUMN public.properties.curated_hotel_id IS
  'Optional link to kb_entities (entity_type=property) for RAG content.';

DROP TRIGGER IF EXISTS properties_set_updated_at ON public.properties;
CREATE TRIGGER properties_set_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS properties_name_trgm_idx
  ON public.properties USING gin (name gin_trgm_ops)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS properties_destination_lower_idx
  ON public.properties (lower(destination))
  WHERE active = true AND destination IS NOT NULL;

CREATE INDEX IF NOT EXISTS properties_destination_profile_idx
  ON public.properties (destination_profile_id)
  WHERE active = true AND destination_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS properties_curated_hotel_idx
  ON public.properties (curated_hotel_id)
  WHERE curated_hotel_id IS NOT NULL;

-- If an older properties table was kept (IF NOT EXISTS skip), align columns.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS destination_profile_id uuid
    REFERENCES public.destination_profiles (id) ON DELETE SET NULL;
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS curated_hotel_id uuid
    REFERENCES public.kb_entities (id) ON DELETE SET NULL;
ALTER TABLE public.properties DROP COLUMN IF EXISTS sabre_hotel_code;
ALTER TABLE public.properties DROP COLUMN IF EXISTS hotelbeds_hotel_code;

-- Back-link from KB entity → property (now that properties exists).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kb_entities_linked_property_id_fkey'
  ) THEN
    ALTER TABLE public.kb_entities
      ADD CONSTRAINT kb_entities_linked_property_id_fkey
      FOREIGN KEY (linked_property_id)
      REFERENCES public.properties (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS kb_entities_linked_property_idx
  ON public.kb_entities (linked_property_id)
  WHERE linked_property_id IS NOT NULL;

-- =============================================================================
-- 10. property_supplier_codes
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_supplier_codes (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id              uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  supplier_key             text NOT NULL,
  supplier_property_code   text NOT NULL,
  meta                     jsonb NOT NULL DEFAULT '{}'::jsonb,
  active                   boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT property_supplier_codes_supplier_key_format
    CHECK (supplier_key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT property_supplier_codes_code_not_blank
    CHECK (length(trim(supplier_property_code)) > 0),
  UNIQUE (property_id, supplier_key)
);

COMMENT ON TABLE public.property_supplier_codes IS
  'Generic per-supplier hotel codes (sabre, hotelbeds, wholesale_…). Never invent codes.';

DROP TRIGGER IF EXISTS property_supplier_codes_set_updated_at ON public.property_supplier_codes;
CREATE TRIGGER property_supplier_codes_set_updated_at
  BEFORE UPDATE ON public.property_supplier_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS property_supplier_codes_lookup_idx
  ON public.property_supplier_codes (supplier_key, supplier_property_code)
  WHERE active = true;

-- =============================================================================
-- 11. property_contracted_rates (Layer 1)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_contracted_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  valid_from     date,
  valid_to       date,
  currency       text NOT NULL DEFAULT 'USD',
  cost_amount    numeric NOT NULL,
  cost_unit      text NOT NULL DEFAULT 'per_stay',
  board          text,
  inclusions     jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes          text,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT property_contracted_rates_cost_positive
    CHECK (cost_amount >= 0),
  CONSTRAINT property_contracted_rates_currency_not_blank
    CHECK (length(trim(currency)) > 0),
  CONSTRAINT property_contracted_rates_unit_check
    CHECK (cost_unit IN ('per_stay', 'per_night', 'per_person', 'package')),
  CONSTRAINT property_contracted_rates_dates_ok
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CONSTRAINT property_contracted_rates_inclusions_is_array
    CHECK (jsonb_typeof(inclusions) = 'array')
);

COMMENT ON TABLE public.property_contracted_rates IS
  'Layer 1 standing contracted rates. Admin enters after PDF digitization (Maldives/India).';

DROP TRIGGER IF EXISTS property_contracted_rates_set_updated_at ON public.property_contracted_rates;
CREATE TRIGGER property_contracted_rates_set_updated_at
  BEFORE UPDATE ON public.property_contracted_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS property_contracted_rates_property_idx
  ON public.property_contracted_rates (property_id)
  WHERE active = true;

-- =============================================================================
-- 12. rate_search_events (optional audit — empty until live search)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_search_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          uuid,
  leg_id           uuid,
  property_id      uuid REFERENCES public.properties (id) ON DELETE SET NULL,
  requested_by_id  uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  destination_text text,
  routing_layer    int,
  pattern          text,
  sources_tried    jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome          text,
  meta             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rate_search_events IS
  'Optional audit of resolveRates calls. Add writes when live adapters ship.';

CREATE INDEX IF NOT EXISTS rate_search_events_created_idx
  ON public.rate_search_events (created_at DESC);

-- =============================================================================
-- 13. RBAC — Rate Layer + Knowledge Base
-- =============================================================================

INSERT INTO public.studio_permissions (slug, module, action, label, sort_order)
VALUES
  ('rates.search', 'rates', 'search', 'Search rate suppliers', 35),
  ('settings.rate_sources', 'settings', 'rate_sources', 'Manage rate source routing', 112),
  ('knowledge.read', 'knowledge', 'read', 'View knowledge base content', 40),
  ('knowledge.write', 'knowledge', 'write', 'Edit knowledge base content', 41),
  ('settings.knowledge_base', 'settings', 'knowledge_base', 'Manage KB sources and KB settings', 113)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.studio_role_permissions (role_slug, permission_slug)
SELECT role_slug, permission_slug
FROM (
  VALUES
    ('advisor', 'rates.search'),
    ('ops', 'rates.search'),
    ('admin', 'rates.search'),
    ('admin', 'settings.rate_sources'),
    ('ops', 'settings.rate_sources'),
    ('advisor', 'knowledge.read'),
    ('ops', 'knowledge.read'),
    ('finance', 'knowledge.read'),
    ('admin', 'knowledge.read'),
    ('advisor', 'knowledge.write'),
    ('ops', 'knowledge.write'),
    ('admin', 'knowledge.write'),
    ('admin', 'settings.knowledge_base'),
    ('ops', 'settings.knowledge_base')
) AS g(role_slug, permission_slug)
WHERE EXISTS (
  SELECT 1 FROM public.studio_roles r WHERE r.slug = g.role_slug
)
AND EXISTS (
  SELECT 1 FROM public.studio_permissions p WHERE p.slug = g.permission_slug
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 14. RLS + service_role grants
-- =============================================================================

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_type_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_routing_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_wholesalers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_peak_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiated_rate_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_fact_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_supplier_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_contracted_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_search_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destination_type_defaults TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destination_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destination_routing_overrides TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destination_wholesalers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_peak_windows TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.negotiated_rate_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_sources TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_entities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_facts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_fact_chunks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_supplier_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_contracted_rates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_search_events TO service_role;
