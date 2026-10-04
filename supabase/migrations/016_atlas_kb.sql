-- Atlas Knowledge Base (locked founder shape).
-- Spec: docs/studio/knowledge-base.md
-- Depends on: 001 (set_updated_at, team_members), 003 (pg_trgm), 011 (properties,
--   destination_profiles, negotiated_rate_codes, company_settings), 012 (trips,
--   trip_legs, trip_line_items).
-- Do NOT edit 011. This file replaces the thin KB tables from 011 with the Atlas
-- schema, then adds geography, type details, notes, templates, scrape jobs, and
-- trip kb_tier columns.
--
-- Safe to re-run: drops Atlas KB tables first, then recreates them.
-- Does NOT drop Rate Layer money tables (properties, negotiated_rate_codes, …)
-- or trips.
--
-- =============================================================================
-- DELETE / DROP (old thin KB from 011 + this file if re-run)
-- =============================================================================
-- Copy this block into the SQL editor first if you want to inspect, then run
-- the rest of the file. 016 already executes the same drops below.
--
--   -- Unlink Rate Layer hotels from old kb_entities
--   ALTER TABLE public.properties
--     DROP CONSTRAINT IF EXISTS properties_curated_hotel_id_fkey;
--   ALTER TABLE public.trip_line_items
--     DROP CONSTRAINT IF EXISTS trip_line_items_kb_entity_id_fkey;
--   UPDATE public.properties SET curated_hotel_id = NULL
--     WHERE curated_hotel_id IS NOT NULL;
--
--   DROP TABLE IF EXISTS public.kb_scrape_runs CASCADE;
--   DROP TABLE IF EXISTS public.kb_scrape_jobs CASCADE;
--   DROP TABLE IF EXISTS public.kb_itinerary_items CASCADE;
--   DROP TABLE IF EXISTS public.kb_itineraries CASCADE;
--   DROP TABLE IF EXISTS public.kb_customer_feedback CASCADE;
--   DROP TABLE IF EXISTS public.kb_internal_notes CASCADE;
--   DROP TABLE IF EXISTS public.kb_vendor_details CASCADE;
--   DROP TABLE IF EXISTS public.kb_activity_details CASCADE;
--   DROP TABLE IF EXISTS public.kb_restaurant_details CASCADE;
--   DROP TABLE IF EXISTS public.kb_hotel_consortia CASCADE;
--   DROP TABLE IF EXISTS public.kb_hotel_room_categories CASCADE;
--   DROP TABLE IF EXISTS public.kb_hotel_details CASCADE;
--   DROP TABLE IF EXISTS public.kb_destination_audience_notes CASCADE;
--   DROP TABLE IF EXISTS public.kb_destination_facts CASCADE;
--   DROP TABLE IF EXISTS public.kb_country_visa_rules CASCADE;
--   DROP TABLE IF EXISTS public.kb_country_facts CASCADE;
--   DROP TABLE IF EXISTS public.kb_fact_chunks CASCADE;
--   DROP TABLE IF EXISTS public.kb_facts CASCADE;
--   DROP TABLE IF EXISTS public.kb_entities CASCADE;
--   DROP TABLE IF EXISTS public.kb_sources CASCADE;
--   DROP TABLE IF EXISTS public.kb_cities CASCADE;
--   DROP TABLE IF EXISTS public.kb_countries CASCADE;
--   DROP TABLE IF EXISTS public.kb_regions CASCADE;
--
--   DROP FUNCTION IF EXISTS public.kb_guard_advisor_take() CASCADE;
--
-- Then run this migration (or continue — the same drops run next).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Unlink before dropping kb_entities (011 FK).
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_curated_hotel_id_fkey;
ALTER TABLE public.trip_line_items
  DROP CONSTRAINT IF EXISTS trip_line_items_kb_entity_id_fkey;

UPDATE public.properties
SET curated_hotel_id = NULL
WHERE curated_hotel_id IS NOT NULL;

DROP TABLE IF EXISTS public.kb_scrape_runs CASCADE;
DROP TABLE IF EXISTS public.kb_scrape_jobs CASCADE;
DROP TABLE IF EXISTS public.kb_itinerary_items CASCADE;
DROP TABLE IF EXISTS public.kb_itineraries CASCADE;
DROP TABLE IF EXISTS public.kb_customer_feedback CASCADE;
DROP TABLE IF EXISTS public.kb_internal_notes CASCADE;
DROP TABLE IF EXISTS public.kb_vendor_details CASCADE;
DROP TABLE IF EXISTS public.kb_activity_details CASCADE;
DROP TABLE IF EXISTS public.kb_restaurant_details CASCADE;
DROP TABLE IF EXISTS public.kb_hotel_consortia CASCADE;
DROP TABLE IF EXISTS public.kb_hotel_room_categories CASCADE;
DROP TABLE IF EXISTS public.kb_hotel_details CASCADE;
DROP TABLE IF EXISTS public.kb_destination_audience_notes CASCADE;
DROP TABLE IF EXISTS public.kb_destination_facts CASCADE;
DROP TABLE IF EXISTS public.kb_country_visa_rules CASCADE;
DROP TABLE IF EXISTS public.kb_country_facts CASCADE;
DROP TABLE IF EXISTS public.kb_fact_chunks CASCADE;
DROP TABLE IF EXISTS public.kb_facts CASCADE;
DROP TABLE IF EXISTS public.kb_entities CASCADE;
DROP TABLE IF EXISTS public.kb_sources CASCADE;
DROP TABLE IF EXISTS public.kb_cities CASCADE;
DROP TABLE IF EXISTS public.kb_countries CASCADE;
DROP TABLE IF EXISTS public.kb_regions CASCADE;

DROP FUNCTION IF EXISTS public.kb_guard_advisor_take() CASCADE;

-- =============================================================================
-- 0. Company flags (extend knowledge_base json — do not drop company_settings)
-- =============================================================================

INSERT INTO public.company_settings (key, value)
VALUES (
  'knowledge_base',
  '{
    "scrape_enabled": false,
    "fallback_llm_enabled": false,
    "guest_review_factcheck_enabled": false,
    "live_fetch_enabled": false,
    "llm_general_ttl_days": 30,
    "default_passport_country_code": "IN"
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET
  value = COALESCE(public.company_settings.value, '{}'::jsonb) || EXCLUDED.value,
  updated_at = now();

-- =============================================================================
-- 1. Geography
-- =============================================================================

CREATE TABLE public.kb_regions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_regions_name_not_blank CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE public.kb_regions IS
  'Atlas KB region (e.g. East Asia). Editorial geography — not Rate Layer routing.';

CREATE UNIQUE INDEX kb_regions_name_uidx
  ON public.kb_regions (lower(name));

CREATE TRIGGER kb_regions_set_updated_at
  BEFORE UPDATE ON public.kb_regions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_countries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id   uuid REFERENCES public.kb_regions (id) ON DELETE SET NULL,
  name        text NOT NULL,
  country_code text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_countries_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT kb_countries_country_code_format CHECK (country_code ~ '^[A-Z]{2}$')
);

COMMENT ON TABLE public.kb_countries IS
  'Atlas KB country. country_code is ISO 3166-1 alpha-2 (JP, IN). Visa lives on kb_country_visa_rules.';

COMMENT ON COLUMN public.kb_countries.country_code IS
  'Two-letter country code (ISO 3166-1 alpha-2), e.g. JP.';

CREATE UNIQUE INDEX kb_countries_country_code_uidx
  ON public.kb_countries (country_code);

CREATE UNIQUE INDEX kb_countries_name_uidx
  ON public.kb_countries (lower(name));

CREATE TRIGGER kb_countries_set_updated_at
  BEFORE UPDATE ON public.kb_countries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_cities (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id               uuid NOT NULL REFERENCES public.kb_countries (id) ON DELETE CASCADE,
  name                     text NOT NULL,
  destination_profile_id   uuid REFERENCES public.destination_profiles (id) ON DELETE SET NULL,
  active                   boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_cities_name_not_blank CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE public.kb_cities IS
  'Atlas KB city. Optional link to Rate Layer destination_profiles.';

CREATE UNIQUE INDEX kb_cities_country_name_uidx
  ON public.kb_cities (country_id, lower(name));

CREATE INDEX kb_cities_destination_profile_idx
  ON public.kb_cities (destination_profile_id)
  WHERE destination_profile_id IS NOT NULL;

CREATE TRIGGER kb_cities_set_updated_at
  BEFORE UPDATE ON public.kb_cities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2. Place facts (1:1) + visa (1:N passport) + audience notes (1:N style)
-- =============================================================================

CREATE TABLE public.kb_country_facts (
  country_id                   uuid PRIMARY KEY
                                 REFERENCES public.kb_countries (id) ON DELETE CASCADE,
  currency_code                text,
  currency_notes               text,
  best_season                  text,
  safety_notes                 text,
  general_notes                text,
  kb_tier                      text NOT NULL DEFAULT 'kb_scraped',
  provenance                   text NOT NULL DEFAULT 'kb',
  advisor_take                 text,
  advisor_take_updated_by_id   uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  advisor_take_updated_at      timestamptz,
  verified_by_id               uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  verified_at                  timestamptz,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_country_facts_tier_check
    CHECK (kb_tier IN ('kb_verified', 'kb_scraped', 'llm_general')),
  CONSTRAINT kb_country_facts_provenance_check
    CHECK (provenance IN ('kb', 'llm', 'advisor_direct')),
  CONSTRAINT kb_country_facts_advisor_take_author
    CHECK (advisor_take IS NULL OR advisor_take_updated_by_id IS NOT NULL)
);

COMMENT ON TABLE public.kb_country_facts IS
  'Place-level country facts (currency, season, plugs). No visa. No rates.';

CREATE TRIGGER kb_country_facts_set_updated_at
  BEFORE UPDATE ON public.kb_country_facts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_country_visa_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id       uuid NOT NULL REFERENCES public.kb_countries (id) ON DELETE CASCADE,
  passport_country_code text NOT NULL,
  summary          text NOT NULL,
  details          text,
  entry_type       text,
  official_url     text,
  kb_tier          text NOT NULL DEFAULT 'kb_scraped',
  provenance       text NOT NULL DEFAULT 'kb',
  verified_by_id   uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  verified_at      timestamptz,
  last_reviewed_at timestamptz,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_country_visa_rules_passport_format
    CHECK (passport_country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT kb_country_visa_rules_summary_not_blank
    CHECK (length(trim(summary)) > 0),
  CONSTRAINT kb_country_visa_rules_entry_type_check
    CHECK (entry_type IS NULL OR entry_type IN (
      'visa_free', 'e_visa', 'visa_on_arrival', 'embassy'
    )),
  CONSTRAINT kb_country_visa_rules_official_url_format
    CHECK (
      official_url IS NULL
      OR official_url ~* '^https?://'
    ),
  CONSTRAINT kb_country_visa_rules_tier_check
    CHECK (kb_tier IN ('kb_verified', 'kb_scraped', 'llm_general')),
  CONSTRAINT kb_country_visa_rules_provenance_check
    CHECK (provenance IN ('kb', 'llm', 'advisor_direct')),
  UNIQUE (country_id, passport_country_code)
);

COMMENT ON TABLE public.kb_country_visa_rules IS
  'Visa text per country + passport (JP+IN first). Not a column per nationality.';

COMMENT ON COLUMN public.kb_country_visa_rules.passport_country_code IS
  'Traveller passport country (ISO 3166-1 alpha-2), e.g. IN. Destination country is kb_countries.country_code.';

COMMENT ON COLUMN public.kb_country_visa_rules.entry_type IS
  'Optional badge: visa_free, e_visa, visa_on_arrival, embassy. summary is still the answer.';

COMMENT ON COLUMN public.kb_country_visa_rules.official_url IS
  'Government / eVisa page for ops to re-check. Not a live scrape.';

CREATE INDEX kb_country_visa_rules_country_idx
  ON public.kb_country_visa_rules (country_id)
  WHERE active = true;

CREATE TRIGGER kb_country_visa_rules_set_updated_at
  BEFORE UPDATE ON public.kb_country_visa_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_destination_facts (
  city_id             uuid PRIMARY KEY
                        REFERENCES public.kb_cities (id) ON DELETE CASCADE,
  best_time_to_visit  text,
  ideal_length_of_stay text,
  vibe                text,
  staff_notes         text,
  kb_tier             text NOT NULL DEFAULT 'kb_scraped',
  provenance          text NOT NULL DEFAULT 'kb',
  verified_by_id      uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  verified_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_destination_facts_tier_check
    CHECK (kb_tier IN ('kb_verified', 'kb_scraped', 'llm_general')),
  CONSTRAINT kb_destination_facts_provenance_check
    CHECK (provenance IN ('kb', 'llm', 'advisor_direct'))
);

COMMENT ON TABLE public.kb_destination_facts IS
  'City vibe / ideal stay — once per city. No visa. No rates.';

COMMENT ON COLUMN public.kb_destination_facts.staff_notes IS
  'Staff extra line. Not advisor_take. Never client-facing.';

CREATE TRIGGER kb_destination_facts_set_updated_at
  BEFORE UPDATE ON public.kb_destination_facts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_destination_audience_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id     uuid NOT NULL REFERENCES public.kb_cities (id) ON DELETE CASCADE,
  trip_style  text NOT NULL,
  note        text NOT NULL,
  kb_tier     text NOT NULL DEFAULT 'kb_scraped',
  provenance  text NOT NULL DEFAULT 'kb',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_destination_audience_notes_trip_style_check
    CHECK (trip_style IN ('honeymoon', 'family', 'business', 'solo', 'group')),
  CONSTRAINT kb_destination_audience_notes_note_not_blank
    CHECK (length(trim(note)) > 0),
  CONSTRAINT kb_destination_audience_notes_tier_check
    CHECK (kb_tier IN ('kb_verified', 'kb_scraped', 'llm_general')),
  CONSTRAINT kb_destination_audience_notes_provenance_check
    CHECK (provenance IN ('kb', 'llm', 'advisor_direct')),
  UNIQUE (city_id, trip_style)
);

COMMENT ON TABLE public.kb_destination_audience_notes IS
  'Optional city notes per trip style. Nudge only — does not beat kb_tier.';

COMMENT ON COLUMN public.kb_destination_audience_notes.trip_style IS
  'honeymoon | family | business | solo | group.';

CREATE TRIGGER kb_destination_audience_notes_set_updated_at
  BEFORE UPDATE ON public.kb_destination_audience_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. Sources + entities (replaces 011 thin KB)
-- =============================================================================

CREATE TABLE public.kb_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  source_type     text NOT NULL DEFAULT 'website',
  url             text,
  fetch_method    text,
  terms_notes     text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_sources_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT kb_sources_type_check
    CHECK (source_type IN (
      'website',
      'google_drive',
      'advisor_note',
      'hotel_intake',
      'consortia_portal',
      'tourism_board',
      'other'
    ))
);

COMMENT ON TABLE public.kb_sources IS
  'Allowed scrape/intake sources (Sources Tracker). Disable without a deploy.';

COMMENT ON COLUMN public.kb_sources.source_type IS
  'What this source is: website, Drive doc, consortia portal, etc.';

COMMENT ON COLUMN public.kb_sources.url IS
  'Site or Drive URL. Null if not a URL (e.g. hotel intake form).';

COMMENT ON COLUMN public.kb_sources.fetch_method IS
  'How we pull content, e.g. static page or headless browser. Null until scrape exists.';

COMMENT ON COLUMN public.kb_sources.terms_notes IS
  'Why we must not scrape (site terms). Keep active = false when blocked.';

COMMENT ON COLUMN public.kb_sources.metadata IS
  'Optional extra JSON. Default empty object.';

CREATE UNIQUE INDEX kb_sources_name_uidx
  ON public.kb_sources (lower(name));

CREATE TRIGGER kb_sources_set_updated_at
  BEFORE UPDATE ON public.kb_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_entities (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type                  text NOT NULL,
  name                         text NOT NULL,
  brand                        text,
  description                  text,
  advisor_take                 text,
  advisor_take_updated_by_id   uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  advisor_take_updated_at      timestamptz,
  kb_tier                      text NOT NULL DEFAULT 'kb_scraped',
  provenance                   text NOT NULL DEFAULT 'kb',
  source_id                    uuid REFERENCES public.kb_sources (id) ON DELETE SET NULL,
  source_name                  text,
  source_url                   text,
  verified_by_id               uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  verified_at                  timestamptz,
  region_id                    uuid REFERENCES public.kb_regions (id) ON DELETE SET NULL,
  country_id                   uuid REFERENCES public.kb_countries (id) ON DELETE SET NULL,
  city_id                      uuid REFERENCES public.kb_cities (id) ON DELETE SET NULL,
  address_line_1               text,
  address_line_2               text,
  latitude                     double precision,
  longitude                    double precision,
  website_url                  text,
  destination_profile_id       uuid REFERENCES public.destination_profiles (id) ON DELETE SET NULL,
  property_id                  uuid REFERENCES public.properties (id) ON DELETE SET NULL,
  contract_status              text NOT NULL DEFAULT 'unknown',
  client_ready                 boolean NOT NULL DEFAULT false,
  placeholder                  boolean NOT NULL DEFAULT false,
  not_yet_open                 boolean NOT NULL DEFAULT false,
  external_ids                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  legacy_notes                 text,
  active                       boolean NOT NULL DEFAULT true,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_entities_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT kb_entities_type_check
    CHECK (entity_type IN (
      'hotel',
      'destination',
      'restaurant',
      'activity',
      'vendor',
      'other'
    )),
  CONSTRAINT kb_entities_tier_check
    CHECK (kb_tier IN ('kb_verified', 'kb_scraped', 'llm_general')),
  CONSTRAINT kb_entities_provenance_check
    CHECK (provenance IN ('kb', 'llm', 'advisor_direct')),
  CONSTRAINT kb_entities_contract_status_check
    CHECK (contract_status IN ('contracted', 'not_yet_contracted', 'unknown')),
  CONSTRAINT kb_entities_advisor_take_author
    CHECK (advisor_take IS NULL OR advisor_take_updated_by_id IS NOT NULL),
  CONSTRAINT kb_entities_website_url_format
    CHECK (
      website_url IS NULL
      OR website_url ~* '^https?://'
    ),
  CONSTRAINT kb_entities_latitude_range
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT kb_entities_longitude_range
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT kb_entities_lat_lng_pair
    CHECK ((latitude IS NULL) = (longitude IS NULL))
);

COMMENT ON TABLE public.kb_entities IS
  'Atlas KB core entity (hotel / place / restaurant / activity / vendor). No prices.';
COMMENT ON COLUMN public.kb_entities.advisor_take IS
  'Hand-authored PureLuxe voice. Humans only — see kb_guard_advisor_take.';
COMMENT ON COLUMN public.kb_entities.kb_tier IS
  'Trust: kb_verified | kb_scraped | llm_general.';
COMMENT ON COLUMN public.kb_entities.provenance IS
  'Who wrote it: kb | llm | advisor_direct. Not the same as kb_tier.';
COMMENT ON COLUMN public.kb_entities.legacy_notes IS
  'Old scratch field. Prefer kb_internal_notes. Never client-facing.';
COMMENT ON COLUMN public.kb_entities.property_id IS
  'Optional Rate Layer hotel (properties.id). Empty is allowed — still show the hotel.';
COMMENT ON COLUMN public.kb_entities.placeholder IS
  'Dummy row so AI does not invent a hotel/vendor. Not bookable. Not client-facing.';
COMMENT ON COLUMN public.kb_entities.not_yet_open IS
  'Pipeline hotel — not open yet.';
COMMENT ON COLUMN public.kb_entities.external_ids IS
  'Ids from other systems (brand-site slug, Sabre hotel id) for matching.';
COMMENT ON COLUMN public.kb_entities.address_line_1 IS
  'Street address. Optional for slice 1.';
COMMENT ON COLUMN public.kb_entities.address_line_2 IS
  'Building / district line. Optional.';
COMMENT ON COLUMN public.kb_entities.latitude IS
  'Map pin. Must be set together with longitude.';
COMMENT ON COLUMN public.kb_entities.longitude IS
  'Map pin. Must be set together with latitude.';
COMMENT ON COLUMN public.kb_entities.website_url IS
  'Public website. http(s) if set.';

CREATE TRIGGER kb_entities_set_updated_at
  BEFORE UPDATE ON public.kb_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX kb_entities_type_name_idx
  ON public.kb_entities (entity_type, lower(name))
  WHERE active = true;

CREATE INDEX kb_entities_city_type_tier_idx
  ON public.kb_entities (city_id, entity_type, kb_tier)
  WHERE active = true;

CREATE INDEX kb_entities_country_idx
  ON public.kb_entities (country_id)
  WHERE active = true;

CREATE INDEX kb_entities_tier_idx
  ON public.kb_entities (kb_tier)
  WHERE active = true;

CREATE INDEX kb_entities_property_idx
  ON public.kb_entities (property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX kb_entities_contract_status_idx
  ON public.kb_entities (contract_status)
  WHERE contract_status = 'not_yet_contracted';

CREATE UNIQUE INDEX kb_entities_identity_uidx
  ON public.kb_entities (entity_type, city_id, lower(name))
  WHERE active = true AND city_id IS NOT NULL;

-- =============================================================================
-- 4. advisor_take guard (DB, not prompt)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.kb_guard_advisor_take()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.advisor_take IS NOT NULL
       AND current_setting('kb.writer_kind', true) IS DISTINCT FROM 'human' THEN
      RAISE EXCEPTION 'advisor_take is hand-authored only'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.advisor_take IS DISTINCT FROM OLD.advisor_take THEN
      IF current_setting('kb.writer_kind', true) IS DISTINCT FROM 'human' THEN
        RAISE EXCEPTION 'advisor_take is hand-authored only'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.advisor_take IS NOT NULL THEN
        NEW.advisor_take_updated_at := now();
      ELSE
        NEW.advisor_take_updated_at := NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.kb_guard_advisor_take() IS
  'Blocks AI/scrape from writing advisor_take unless SET LOCAL kb.writer_kind = human.';

CREATE TRIGGER kb_entities_guard_advisor_take
  BEFORE INSERT OR UPDATE ON public.kb_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_guard_advisor_take();

CREATE TRIGGER kb_country_facts_guard_advisor_take
  BEFORE INSERT OR UPDATE ON public.kb_country_facts
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_guard_advisor_take();

-- =============================================================================
-- 5. Type-specific details (no rates)
-- =============================================================================

CREATE TABLE public.kb_hotel_details (
  entity_id       uuid PRIMARY KEY REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  amenities       text[] NOT NULL DEFAULT '{}'::text[],
  dining_notes    text,
  wellness_notes  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.kb_hotel_details IS
  'Hotel extras. No cost/sell/nightly rate columns.';

CREATE TRIGGER kb_hotel_details_set_updated_at
  BEFORE UPDATE ON public.kb_hotel_details
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_hotel_room_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   uuid NOT NULL REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  name        text NOT NULL,
  room_size   text,
  bed_type    text,
  room_view   text,
  sort_order  int NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_hotel_room_categories_name_not_blank
    CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE public.kb_hotel_room_categories IS
  'Room types: name, size, bed, view. Deliberately no rates.';

COMMENT ON COLUMN public.kb_hotel_room_categories.room_size IS
  'Size as text (e.g. 45 sqm), not a number.';
COMMENT ON COLUMN public.kb_hotel_room_categories.room_view IS
  'City / palace / garden. Named room_view because view is a SQL keyword.';

CREATE INDEX kb_hotel_room_categories_entity_idx
  ON public.kb_hotel_room_categories (entity_id, sort_order);

CREATE TRIGGER kb_hotel_room_categories_set_updated_at
  BEFORE UPDATE ON public.kb_hotel_room_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_hotel_consortia (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id                  uuid NOT NULL REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  club_key                   text NOT NULL,
  club_name                  text NOT NULL,
  negotiated_rate_code_id    uuid REFERENCES public.negotiated_rate_codes (id) ON DELETE SET NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_hotel_consortia_club_key_not_blank
    CHECK (length(trim(club_key)) > 0),
  CONSTRAINT kb_hotel_consortia_club_name_not_blank
    CHECK (length(trim(club_name)) > 0),
  UNIQUE (entity_id, club_key)
);

COMMENT ON TABLE public.kb_hotel_consortia IS
  'Hotel partner clubs. Rate Layer reads this after KB selects the hotel.';

COMMENT ON COLUMN public.kb_hotel_consortia.club_key IS
  'Stable id, e.g. palace_leaders_club.';
COMMENT ON COLUMN public.kb_hotel_consortia.club_name IS
  'Advisor label, e.g. Leaders Club.';

CREATE INDEX kb_hotel_consortia_code_idx
  ON public.kb_hotel_consortia (negotiated_rate_code_id)
  WHERE negotiated_rate_code_id IS NOT NULL;

CREATE TRIGGER kb_hotel_consortia_set_updated_at
  BEFORE UPDATE ON public.kb_hotel_consortia
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_restaurant_details (
  entity_id    uuid PRIMARY KEY REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  cuisine      text,
  price_tier   text,
  awards       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_restaurant_details_awards_is_array
    CHECK (jsonb_typeof(awards) = 'array')
);

COMMENT ON TABLE public.kb_restaurant_details IS
  'Restaurant extras. price_tier is a label (luxury / €€€), not a quote.';

CREATE TRIGGER kb_restaurant_details_set_updated_at
  BEFORE UPDATE ON public.kb_restaurant_details
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_activity_details (
  entity_id            uuid PRIMARY KEY REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  category             text,
  operator_name        text,
  vendor_entity_id     uuid REFERENCES public.kb_entities (id) ON DELETE SET NULL,
  duration_text        text,
  price_tier           text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.kb_activity_details IS
  'Activity extras. price_tier is a label only.';

COMMENT ON COLUMN public.kb_activity_details.vendor_entity_id IS
  'Optional vendor kb_entities row (DMC / guide / ground handler).';

CREATE TRIGGER kb_activity_details_set_updated_at
  BEFORE UPDATE ON public.kb_activity_details
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_vendor_details (
  entity_id      uuid PRIMARY KEY REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  vendor_type    text NOT NULL,
  contact_name   text,
  contact_email  text,
  contact_phone  text,
  staff_notes    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_vendor_details_type_check
    CHECK (vendor_type IN ('dmc', 'guide', 'ground_handler', 'other'))
);

COMMENT ON TABLE public.kb_vendor_details IS
  'DMC / guide / ground handler. Contact notes are staff-only by default.';

CREATE TRIGGER kb_vendor_details_set_updated_at
  BEFORE UPDATE ON public.kb_vendor_details
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 6. Long-form facts + chunks (RAG) — Atlas tier names
-- =============================================================================

CREATE TABLE public.kb_facts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       uuid NOT NULL REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  source_id       uuid REFERENCES public.kb_sources (id) ON DELETE SET NULL,
  title           text,
  body            text NOT NULL,
  kb_tier         text NOT NULL DEFAULT 'kb_scraped',
  provenance      text NOT NULL DEFAULT 'kb',
  status          text NOT NULL DEFAULT 'draft',
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by_id   uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_facts_body_not_blank CHECK (length(trim(body)) > 0),
  CONSTRAINT kb_facts_tier_check
    CHECK (kb_tier IN ('kb_verified', 'kb_scraped', 'llm_general')),
  CONSTRAINT kb_facts_provenance_check
    CHECK (provenance IN ('kb', 'llm', 'advisor_direct')),
  CONSTRAINT kb_facts_status_check
    CHECK (status IN ('draft', 'approved', 'archived'))
);

COMMENT ON TABLE public.kb_facts IS
  'Long notes. Chat uses status=approved only. No prices. RAG searches chunks.';

CREATE INDEX kb_facts_entity_status_idx
  ON public.kb_facts (entity_id, status, kb_tier);

CREATE INDEX kb_facts_body_trgm_idx
  ON public.kb_facts USING gin (body gin_trgm_ops)
  WHERE status = 'approved';

CREATE TRIGGER kb_facts_set_updated_at
  BEFORE UPDATE ON public.kb_facts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_fact_chunks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id          uuid NOT NULL REFERENCES public.kb_facts (id) ON DELETE CASCADE,
  chunk_index      int NOT NULL DEFAULT 0,
  chunk_text       text NOT NULL,
  embedding        vector(1536),
  embedding_model  text,
  token_count      int,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_fact_chunks_text_not_blank CHECK (length(trim(chunk_text)) > 0),
  CONSTRAINT kb_fact_chunks_index_nonneg CHECK (chunk_index >= 0),
  UNIQUE (fact_id, chunk_index)
);

COMMENT ON TABLE public.kb_fact_chunks IS
  'Search pieces of approved facts. Embedding null until KB-R2.';

CREATE INDEX kb_fact_chunks_fact_id_idx
  ON public.kb_fact_chunks (fact_id);

CREATE INDEX kb_fact_chunks_text_trgm_idx
  ON public.kb_fact_chunks USING gin (chunk_text gin_trgm_ops);

CREATE TRIGGER kb_fact_chunks_set_updated_at
  BEFORE UPDATE ON public.kb_fact_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 7. Internal-only notes + feedback
-- =============================================================================

CREATE TABLE public.kb_internal_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   uuid NOT NULL REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  author_id   uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_internal_notes_body_not_blank CHECK (length(trim(body)) > 0)
);

COMMENT ON TABLE public.kb_internal_notes IS
  'Staff working knowledge. Never client-facing. Never auto-merged into advisor_take.';

CREATE INDEX kb_internal_notes_entity_idx
  ON public.kb_internal_notes (entity_id, created_at DESC);

CREATE TABLE public.kb_customer_feedback (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id                uuid NOT NULL REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  trip_id                  uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  rating                   smallint,
  comments                 text,
  category_tags            text[] NOT NULL DEFAULT '{}'::text[],
  advisor_reviewed         boolean NOT NULL DEFAULT false,
  used_in_advisor_take     boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_customer_feedback_rating_range
    CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);

COMMENT ON TABLE public.kb_customer_feedback IS
  'Anonymous post-trip comments. No client name. Jobs must never set used_in_advisor_take.';

CREATE INDEX kb_customer_feedback_entity_idx
  ON public.kb_customer_feedback (entity_id, created_at DESC);

-- =============================================================================
-- 8. Itinerary templates (not a live trip)
-- =============================================================================

CREATE TABLE public.kb_itineraries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                text NOT NULL,
  destination_summary  text,
  country_id           uuid REFERENCES public.kb_countries (id) ON DELETE SET NULL,
  kb_tier              text NOT NULL DEFAULT 'kb_verified',
  provenance           text NOT NULL DEFAULT 'kb',
  client_ready         boolean NOT NULL DEFAULT false,
  active               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_itineraries_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT kb_itineraries_tier_check
    CHECK (kb_tier IN ('kb_verified', 'kb_scraped', 'llm_general')),
  CONSTRAINT kb_itineraries_provenance_check
    CHECK (provenance IN ('kb', 'llm', 'advisor_direct'))
);

COMMENT ON TABLE public.kb_itineraries IS
  'Model / past itineraries. Copy into trip_itinerary_days — not a second trips row.';

CREATE INDEX kb_itineraries_country_idx
  ON public.kb_itineraries (country_id)
  WHERE active = true;

CREATE TRIGGER kb_itineraries_set_updated_at
  BEFORE UPDATE ON public.kb_itineraries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_itinerary_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id  uuid NOT NULL REFERENCES public.kb_itineraries (id) ON DELETE CASCADE,
  day_number    int NOT NULL,
  sort_order    int NOT NULL DEFAULT 0,
  entity_id     uuid REFERENCES public.kb_entities (id) ON DELETE SET NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_itinerary_items_day_number_positive CHECK (day_number >= 1)
);

CREATE INDEX kb_itinerary_items_itinerary_idx
  ON public.kb_itinerary_items (itinerary_id, day_number, sort_order);

CREATE TRIGGER kb_itinerary_items_set_updated_at
  BEFORE UPDATE ON public.kb_itinerary_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 9. Scrape jobs
-- =============================================================================

CREATE TABLE public.kb_scrape_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        uuid NOT NULL REFERENCES public.kb_sources (id) ON DELETE CASCADE,
  cron_expression  text,
  active           boolean NOT NULL DEFAULT true,
  last_run_at      timestamptz,
  last_status      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_scrape_jobs_cron_not_blank
    CHECK (cron_expression IS NULL OR length(trim(cron_expression)) > 0)
);

COMMENT ON TABLE public.kb_scrape_jobs IS
  'Scheduler config per source. Jobs never overwrite advisor_take or kb_verified.';

COMMENT ON COLUMN public.kb_scrape_jobs.cron_expression IS
  'Cron schedule. 5 fields (0 5 * * * = 05:00 daily) or 6 fields with seconds (* * * * * *). Null = not on a timer.';

CREATE TRIGGER kb_scrape_jobs_set_updated_at
  BEFORE UPDATE ON public.kb_scrape_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_scrape_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid NOT NULL REFERENCES public.kb_scrape_jobs (id) ON DELETE CASCADE,
  started_at          timestamptz NOT NULL DEFAULT now(),
  finished_at         timestamptz,
  status              text NOT NULL DEFAULT 'ok',
  pages_fetched       int NOT NULL DEFAULT 0,
  entities_saved      int NOT NULL DEFAULT 0,
  error_message       text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT kb_scrape_runs_status_check
    CHECK (status IN ('ok', 'error', 'skipped'))
);

CREATE INDEX kb_scrape_runs_job_idx
  ON public.kb_scrape_runs (job_id, started_at DESC);

-- =============================================================================
-- 10. Relink Rate Layer properties.curated_hotel_id
-- =============================================================================

ALTER TABLE public.properties
  ADD CONSTRAINT properties_curated_hotel_id_fkey
  FOREIGN KEY (curated_hotel_id)
  REFERENCES public.kb_entities (id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.properties.curated_hotel_id IS
  'Link to kb_entities (entity_type=hotel). Guest editorial lives in KB.';

-- =============================================================================
-- 11. Trip Builder — persist kb_tier (founder gap)
-- =============================================================================

ALTER TABLE public.trip_legs
  ADD COLUMN IF NOT EXISTS kb_selection_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.trip_legs
  DROP CONSTRAINT IF EXISTS trip_legs_kb_selection_status_check;

ALTER TABLE public.trip_legs
  ADD CONSTRAINT trip_legs_kb_selection_status_check
    CHECK (kb_selection_status IN ('pending', 'resolved', 'empty'));

COMMENT ON COLUMN public.trip_legs.kb_selection_status IS
  'Compose-path gate: Rate Layer waits until resolved (or named hotel / paste).';

ALTER TABLE public.trip_line_items
  ADD COLUMN IF NOT EXISTS kb_entity_id uuid;

ALTER TABLE public.trip_line_items
  ADD COLUMN IF NOT EXISTS kb_tier text;

ALTER TABLE public.trip_line_items
  ADD COLUMN IF NOT EXISTS kb_contract_status text;

ALTER TABLE public.trip_line_items
  DROP CONSTRAINT IF EXISTS trip_line_items_kb_entity_id_fkey;

ALTER TABLE public.trip_line_items
  ADD CONSTRAINT trip_line_items_kb_entity_id_fkey
    FOREIGN KEY (kb_entity_id)
    REFERENCES public.kb_entities (id)
    ON DELETE SET NULL;

ALTER TABLE public.trip_line_items
  DROP CONSTRAINT IF EXISTS trip_line_items_kb_tier_check;

ALTER TABLE public.trip_line_items
  ADD CONSTRAINT trip_line_items_kb_tier_check
    CHECK (
      kb_tier IS NULL
      OR kb_tier IN ('kb_verified', 'kb_scraped', 'llm_general')
    );

ALTER TABLE public.trip_line_items
  DROP CONSTRAINT IF EXISTS trip_line_items_kb_contract_status_check;

ALTER TABLE public.trip_line_items
  ADD CONSTRAINT trip_line_items_kb_contract_status_check
    CHECK (
      kb_contract_status IS NULL
      OR kb_contract_status IN ('contracted', 'not_yet_contracted', 'unknown')
    );

COMMENT ON COLUMN public.trip_line_items.kb_tier IS
  'Copied from kb_entities at select time. Rate search must not clear this.';

CREATE INDEX IF NOT EXISTS trip_line_items_kb_entity_idx
  ON public.trip_line_items (kb_entity_id)
  WHERE kb_entity_id IS NOT NULL;

-- =============================================================================
-- 12. RLS + grants
-- =============================================================================

ALTER TABLE public.kb_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_country_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_country_visa_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_destination_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_destination_audience_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_hotel_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_hotel_room_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_hotel_consortia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_restaurant_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_activity_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_vendor_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_fact_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_scrape_runs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_regions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_countries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_cities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_country_facts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_country_visa_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_destination_facts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_destination_audience_notes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_sources TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_entities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_hotel_details TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_hotel_room_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_hotel_consortia TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_restaurant_details TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_activity_details TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_vendor_details TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_facts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_fact_chunks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_internal_notes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_customer_feedback TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_itineraries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_itinerary_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_scrape_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_scrape_runs TO service_role;
