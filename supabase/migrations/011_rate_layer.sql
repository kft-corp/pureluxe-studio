-- Rate Layer schema (Layers 1–4 + offline contracted contracts).
-- Spec: docs/studio/rate-layer.md
-- Depends on: 001 (team_members, set_updated_at), 002 (studio_permissions), 003 (pg_trgm).
-- Atlas KB lives in 016_atlas_kb.sql (not here).
--
-- Fresh-install style: CREATE TABLE with final columns only — no ALTER widen blocks.
-- If Supabase already has older Rate Layer tables, drop them first (see cleanup below),
-- then run this file.
--
-- Does NOT create trip_line_items (012_trips_kernel.sql).
-- Does NOT create a global rates catalogue.
--
-- INSERT policy: permanent system defaults only (company_settings, Layer 3
-- destination_type_defaults, RBAC). Rows that may differ in live — destination
-- profiles, routing, wholesaler bindings, ski peak dates, negotiated code
-- placeholders — live in migrations/seeds/ and are not applied by db push.
-- No fake hotels or invented live GDS access codes.
--
-- =============================================================================
-- RECREATE / CLEANUP (run in Supabase SQL editor BEFORE this migration if needed)
-- =============================================================================
--   UPDATE public.trip_line_items SET property_id = NULL WHERE property_id IS NOT NULL;
--   UPDATE public.bookings SET property_id = NULL WHERE property_id IS NOT NULL;
--   (trip_legs has no property_id column)
--
--   DROP TABLE IF EXISTS public.property_contract_offers CASCADE;
--   DROP TABLE IF EXISTS public.property_rate_addons CASCADE;
--   DROP TABLE IF EXISTS public.property_contracted_rates CASCADE;
--   DROP TABLE IF EXISTS public.property_contracts CASCADE;
--   DROP TABLE IF EXISTS public.property_supplier_codes CASCADE;
--   DROP TABLE IF EXISTS public.rate_search_events CASCADE;
--   DROP TABLE IF EXISTS public.rate_peak_windows CASCADE;
--   DROP TABLE IF EXISTS public.destination_wholesalers CASCADE;
--   DROP TABLE IF EXISTS public.destination_routing_overrides CASCADE;
--   DROP TABLE IF EXISTS public.negotiated_rate_codes CASCADE;
--   DROP TABLE IF EXISTS public.destination_profiles CASCADE;
--   DROP TABLE IF EXISTS public.destination_type_defaults CASCADE;
--   DROP TABLE IF EXISTS public.properties CASCADE;
--   -- optional: DROP TABLE IF EXISTS public.company_settings CASCADE;
--   DROP TABLE IF EXISTS public.high_value_routing CASCADE;
--   DROP TABLE IF EXISTS public.wholesaler_destinations CASCADE;
--   DROP TABLE IF EXISTS public.offline_trip_types CASCADE;

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

-- Optional place list: migrations/seeds/011_rate_layer.sql

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

-- Optional Layer 2 patterns: migrations/seeds/011_rate_layer.sql

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

-- Optional wholesaler bindings: migrations/seeds/011_rate_layer.sql

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

-- Optional ski peak dates: migrations/seeds/011_rate_layer.sql

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
  'Live GDS access code. Placeholder program slugs, if wanted, are in migrations/seeds/.';

DROP TRIGGER IF EXISTS negotiated_rate_codes_set_updated_at ON public.negotiated_rate_codes;
CREATE TRIGGER negotiated_rate_codes_set_updated_at
  BEFORE UPDATE ON public.negotiated_rate_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS negotiated_rate_codes_supplier_code_uidx
  ON public.negotiated_rate_codes (supplier_key, lower(code));

-- Optional consortia placeholders: migrations/seeds/011_rate_layer.sql

-- =============================================================================
-- 8. properties (thin hotel master — shared by all rate sources)
-- =============================================================================
-- curated_hotel_id FK to kb_entities is added in 016_atlas_kb.sql after Atlas exists.

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
  curated_hotel_id         uuid,
  default_currency         text NOT NULL DEFAULT 'USD',
  min_markup_percent       numeric,
  contracting_entity_name  text,
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

  CONSTRAINT properties_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT properties_default_currency_not_blank
    CHECK (length(trim(default_currency)) > 0),
  CONSTRAINT properties_min_markup_non_negative
    CHECK (min_markup_percent IS NULL OR min_markup_percent >= 0)
);

COMMENT ON TABLE public.properties IS
  'Thin hotel master for Rate Layer routing (shared by Sabre, Hotelbeds, wholesale, paste, contracted). Guest editorial lives in KB. No sell prices.';
COMMENT ON COLUMN public.properties.curated_hotel_id IS
  'Optional link to kb_entities. FK added in 016_atlas_kb.sql.';
COMMENT ON COLUMN public.properties.min_markup_percent IS
  'Default minimum sell markup on villa/room net (e.g. 25). Per-contract override on property_contracts.';

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

-- =============================================================================
-- 9. property_supplier_codes
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
-- 10. property_contracts (Layer 1 — one PDF / agreement per hotel)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_contracts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id            uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  name                   text NOT NULL,
  contract_type          text NOT NULL DEFAULT 'wholesale',
  market                 text,
  valid_from             date,
  valid_to               date,
  currency               text NOT NULL DEFAULT 'USD',
  booking_code           text,
  min_markup_percent     numeric,
  source_document_name   text,
  policies               jsonb NOT NULL DEFAULT '{}'::jsonb,
  benefits               jsonb NOT NULL DEFAULT '[]'::jsonb,
  payout                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes                  text,
  active                 boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT property_contracts_name_not_blank
    CHECK (length(trim(name)) > 0),
  CONSTRAINT property_contracts_type_check
    CHECK (contract_type IN ('wholesale', 'package', 'tactical')),
  CONSTRAINT property_contracts_currency_not_blank
    CHECK (length(trim(currency)) > 0),
  CONSTRAINT property_contracts_dates_ok
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CONSTRAINT property_contracts_min_markup_non_negative
    CHECK (min_markup_percent IS NULL OR min_markup_percent >= 0),
  CONSTRAINT property_contracts_policies_is_object
    CHECK (jsonb_typeof(policies) = 'object'),
  CONSTRAINT property_contracts_benefits_is_array
    CHECK (jsonb_typeof(benefits) = 'array'),
  CONSTRAINT property_contracts_payout_is_object
    CHECK (jsonb_typeof(payout) = 'object')
);

COMMENT ON TABLE public.property_contracts IS
  'Layer 1 contract header for offline_contracted (one row per PDF/agreement).';
COMMENT ON COLUMN public.property_contracts.booking_code IS
  'Offer/booking reference required by hotel (e.g. SSK26IN).';
COMMENT ON COLUMN public.property_contracts.market IS
  'Market restriction when present (e.g. india, worldwide).';
COMMENT ON COLUMN public.property_contracts.policies IS
  'Dynamic policies JSON: stay_rules, payment_rules, transfer_policies, legal.';
COMMENT ON COLUMN public.property_contracts.benefits IS
  'Dynamic benefits JSON array: honeymoon, anniversary, package value-adds.';
COMMENT ON COLUMN public.property_contracts.payout IS
  'Hotel/supplier payout bank details JSON (not guest-facing).';

DROP TRIGGER IF EXISTS property_contracts_set_updated_at ON public.property_contracts;
CREATE TRIGGER property_contracts_set_updated_at
  BEFORE UPDATE ON public.property_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS property_contracts_property_idx
  ON public.property_contracts (property_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS property_contracts_validity_idx
  ON public.property_contracts (valid_from, valid_to)
  WHERE active = true;

-- =============================================================================
-- 11. property_contracted_rates (Layer 1 room / package money)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_contracted_rates (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id            uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  contract_id            uuid REFERENCES public.property_contracts (id) ON DELETE CASCADE,
  room_category          text,
  season_code            text,
  rate_basis             text NOT NULL DEFAULT 'nightly',
  valid_from             date,
  valid_to               date,
  currency               text NOT NULL DEFAULT 'USD',
  cost_amount            numeric NOT NULL,
  cost_unit              text NOT NULL DEFAULT 'per_stay',
  package_nights         int,
  extra_night_amount     numeric,
  base_adults            int NOT NULL DEFAULT 2,
  base_children          int NOT NULL DEFAULT 0,
  max_adults             int,
  max_children           int,
  board                  text,
  includes_breakfast     boolean NOT NULL DEFAULT true,
  includes_lunch         boolean NOT NULL DEFAULT false,
  includes_dinner        boolean NOT NULL DEFAULT false,
  includes_transfer      boolean NOT NULL DEFAULT false,
  includes_green_tax     boolean NOT NULL DEFAULT false,
  min_nights             int,
  units_count            int,
  sort_order             int NOT NULL DEFAULT 0,
  inclusions             jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes                  text,
  active                 boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT property_contracted_rates_cost_positive
    CHECK (cost_amount >= 0),
  CONSTRAINT property_contracted_rates_currency_not_blank
    CHECK (length(trim(currency)) > 0),
  CONSTRAINT property_contracted_rates_unit_check
    CHECK (cost_unit IN ('per_stay', 'per_night', 'per_person', 'package')),
  CONSTRAINT property_contracted_rates_basis_check
    CHECK (rate_basis IN ('nightly', 'package')),
  CONSTRAINT property_contracted_rates_dates_ok
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CONSTRAINT property_contracted_rates_inclusions_is_array
    CHECK (jsonb_typeof(inclusions) = 'array'),
  CONSTRAINT property_contracted_rates_base_adults_positive
    CHECK (base_adults >= 1),
  CONSTRAINT property_contracted_rates_base_children_non_negative
    CHECK (base_children >= 0),
  CONSTRAINT property_contracted_rates_max_adults_ok
    CHECK (max_adults IS NULL OR max_adults >= base_adults),
  CONSTRAINT property_contracted_rates_max_children_ok
    CHECK (max_children IS NULL OR max_children >= 0),
  CONSTRAINT property_contracted_rates_package_nights_ok
    CHECK (package_nights IS NULL OR package_nights >= 1),
  CONSTRAINT property_contracted_rates_extra_night_ok
    CHECK (extra_night_amount IS NULL OR extra_night_amount >= 0),
  CONSTRAINT property_contracted_rates_min_nights_ok
    CHECK (min_nights IS NULL OR min_nights >= 1),
  CONSTRAINT property_contracted_rates_season_check
    CHECK (
      season_code IS NULL
      OR season_code IN ('peak', 'high', 'low', 'shoulder', 'other')
    )
);

COMMENT ON TABLE public.property_contracted_rates IS
  'Layer 1 offline_contracted room/package rates. Maps to NormalizedRateOption like Sabre/wholesale/paste.';
COMMENT ON COLUMN public.property_contracted_rates.room_category IS
  'Villa/room name → NormalizedRateOption.room_name.';
COMMENT ON COLUMN public.property_contracted_rates.rate_basis IS
  'nightly = wholesale-style; package = fixed 3N/4N/5N India-style totals.';

DROP TRIGGER IF EXISTS property_contracted_rates_set_updated_at ON public.property_contracted_rates;
CREATE TRIGGER property_contracted_rates_set_updated_at
  BEFORE UPDATE ON public.property_contracted_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS property_contracted_rates_property_idx
  ON public.property_contracted_rates (property_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS property_contracted_rates_contract_idx
  ON public.property_contracted_rates (contract_id)
  WHERE active = true AND contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS property_contracted_rates_validity_idx
  ON public.property_contracted_rates (property_id, valid_from, valid_to)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS property_contracted_rates_room_idx
  ON public.property_contracted_rates (property_id, room_category)
  WHERE active = true AND room_category IS NOT NULL;

-- =============================================================================
-- 12. property_rate_addons
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_rate_addons (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id                  uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  contract_id                  uuid REFERENCES public.property_contracts (id) ON DELETE CASCADE,
  addon_type                   text NOT NULL,
  name                         text NOT NULL,
  amount                       numeric NOT NULL,
  currency                     text NOT NULL DEFAULT 'USD',
  unit                         text NOT NULL DEFAULT 'per_person',
  age_from                     int,
  age_to                       int,
  valid_from                   date,
  valid_to                     date,
  board_required               text,
  mandatory                    boolean NOT NULL DEFAULT false,
  applies_to_room_categories   jsonb NOT NULL DEFAULT '["*"]'::jsonb,
  notes                        text,
  active                       boolean NOT NULL DEFAULT true,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT property_rate_addons_name_not_blank
    CHECK (length(trim(name)) > 0),
  CONSTRAINT property_rate_addons_amount_non_negative
    CHECK (amount >= 0),
  CONSTRAINT property_rate_addons_currency_not_blank
    CHECK (length(trim(currency)) > 0),
  CONSTRAINT property_rate_addons_type_check
    CHECK (addon_type IN (
      'transfer',
      'green_tax',
      'meal',
      'beverage',
      'festive',
      'extra_adult',
      'extra_child',
      'other'
    )),
  CONSTRAINT property_rate_addons_unit_check
    CHECK (unit IN (
      'per_person',
      'per_person_per_night',
      'per_night',
      'per_villa_per_night',
      'per_event',
      'per_stay'
    )),
  CONSTRAINT property_rate_addons_dates_ok
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CONSTRAINT property_rate_addons_age_ok
    CHECK (
      age_from IS NULL
      OR age_to IS NULL
      OR age_to >= age_from
    ),
  CONSTRAINT property_rate_addons_rooms_is_array
    CHECK (jsonb_typeof(applies_to_room_categories) = 'array')
);

COMMENT ON TABLE public.property_rate_addons IS
  'Layer 1 offline_contracted add-on catalog (seaplane, green tax, HB/FB, drinks, festive, extra adult).';

DROP TRIGGER IF EXISTS property_rate_addons_set_updated_at ON public.property_rate_addons;
CREATE TRIGGER property_rate_addons_set_updated_at
  BEFORE UPDATE ON public.property_rate_addons
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS property_rate_addons_property_idx
  ON public.property_rate_addons (property_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS property_rate_addons_contract_idx
  ON public.property_rate_addons (contract_id)
  WHERE active = true AND contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS property_rate_addons_type_idx
  ON public.property_rate_addons (property_id, addon_type)
  WHERE active = true;

-- =============================================================================
-- 13. property_contract_offers
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_contract_offers (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id                uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  contract_id                uuid REFERENCES public.property_contracts (id) ON DELETE CASCADE,
  name                       text NOT NULL,
  offer_type                 text NOT NULL,
  percent_off_villa          numeric,
  free_board                 text,
  transfer_discount_percent  numeric,
  valid_from                 date,
  valid_to                   date,
  book_by                    date,
  min_nights                 int,
  blackout_dates             jsonb NOT NULL DEFAULT '[]'::jsonb,
  excluded_room_categories   jsonb NOT NULL DEFAULT '[]'::jsonb,
  combinable_flags           jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes                      text,
  active                     boolean NOT NULL DEFAULT true,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT property_contract_offers_name_not_blank
    CHECK (length(trim(name)) > 0),
  CONSTRAINT property_contract_offers_type_check
    CHECK (offer_type IN (
      'percent_off_villa',
      'free_board_upgrade',
      'transfer_discount',
      'family',
      'bundle',
      'other'
    )),
  CONSTRAINT property_contract_offers_percent_villa_ok
    CHECK (
      percent_off_villa IS NULL
      OR (percent_off_villa >= 0 AND percent_off_villa <= 100)
    ),
  CONSTRAINT property_contract_offers_transfer_pct_ok
    CHECK (
      transfer_discount_percent IS NULL
      OR (
        transfer_discount_percent >= 0
        AND transfer_discount_percent <= 100
      )
    ),
  CONSTRAINT property_contract_offers_dates_ok
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CONSTRAINT property_contract_offers_min_nights_ok
    CHECK (min_nights IS NULL OR min_nights >= 1),
  CONSTRAINT property_contract_offers_blackout_is_array
    CHECK (jsonb_typeof(blackout_dates) = 'array'),
  CONSTRAINT property_contract_offers_excluded_rooms_is_array
    CHECK (jsonb_typeof(excluded_room_categories) = 'array'),
  CONSTRAINT property_contract_offers_combinable_is_object
    CHECK (jsonb_typeof(combinable_flags) = 'object')
);

COMMENT ON TABLE public.property_contract_offers IS
  'Layer 1 offline_contracted commercial offers (% off villa, free HB, transfer discount, family).';

DROP TRIGGER IF EXISTS property_contract_offers_set_updated_at ON public.property_contract_offers;
CREATE TRIGGER property_contract_offers_set_updated_at
  BEFORE UPDATE ON public.property_contract_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS property_contract_offers_property_idx
  ON public.property_contract_offers (property_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS property_contract_offers_contract_idx
  ON public.property_contract_offers (contract_id)
  WHERE active = true AND contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS property_contract_offers_validity_idx
  ON public.property_contract_offers (valid_from, valid_to)
  WHERE active = true;

-- =============================================================================
-- 14. rate_search_events (optional audit)
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
-- 15. RBAC — Rate Layer (+ knowledge permission seeds used by Atlas later)
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
-- 16. RLS + service_role grants
-- =============================================================================

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_type_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_routing_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_wholesalers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_peak_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiated_rate_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_supplier_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_contracted_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_rate_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_contract_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_search_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destination_type_defaults TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destination_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destination_routing_overrides TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destination_wholesalers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_peak_windows TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.negotiated_rate_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_supplier_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_contracts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_contracted_rates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_rate_addons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_contract_offers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_search_events TO service_role;
