-- Rate Layer: property master, routing tables, company settings.
-- Spec: docs/studio/rate-layer.md
-- Depends on: 001 (team_members), 002 (studio_permissions), 003 (pg_trgm for property search).
-- Safe to re-run: IF NOT EXISTS / ON CONFLICT / CREATE OR REPLACE where practical.
--
-- Does NOT create trip_line_items (Trip Builder owns those — see 012_trips_kernel.sql).
-- Does NOT create a global rates catalogue.

-- =============================================================================
-- 1. company_settings
--    Key/value company config. Rate preference order lives at key = rate_sources.
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
  'Studio company-wide settings (key → jsonb). Prefer this over one-off settings tables.';
COMMENT ON COLUMN public.company_settings.key IS
  'Stable setting key, e.g. rate_sources.';

DROP TRIGGER IF EXISTS company_settings_set_updated_at ON public.company_settings;
CREATE TRIGGER company_settings_set_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.company_settings (key, value)
VALUES (
  'rate_sources',
  '{
    "preference_order": ["special", "offline", "wholesale", "gds", "bedbank", "manual"],
    "allow_offline_paste": true,
    "default_currency": "USD"
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 2. properties
--    Hotel master + supplier codes for Rate Layer adapters.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.properties (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  destination             text,
  brand                   text,
  chain                   text,
  city                    text,
  country                 text,
  region                  text,
  property_type           text,
  sabre_hotel_code        text,
  hotelbeds_hotel_code    text,
  default_commission      numeric,
  commission_channel      text,
  commissionable          boolean,
  relationship_strength   text,
  booking_notes           text,
  vip_contact_notes       text,
  reservations_email      text,
  general_phone           text,
  active                  boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT properties_name_not_blank CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE public.properties IS
  'Hotel / property master for Rate Layer routing and adapter codes. No sell prices here.';
COMMENT ON COLUMN public.properties.destination IS
  'Free-text region/destination — same matching style as trip_legs.destination.';
COMMENT ON COLUMN public.properties.sabre_hotel_code IS
  'Null means adapter must fall back or error clearly — do not invent codes.';

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

CREATE INDEX IF NOT EXISTS properties_sabre_code_idx
  ON public.properties (sabre_hotel_code)
  WHERE sabre_hotel_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS properties_hotelbeds_code_idx
  ON public.properties (hotelbeds_hotel_code)
  WHERE hotelbeds_hotel_code IS NOT NULL;

-- =============================================================================
-- 3. offline_trip_types (Path 1 — never fall through to bedbank)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.offline_trip_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_type   text NOT NULL,
  notes       text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT offline_trip_types_trip_type_not_blank
    CHECK (length(trim(trip_type)) > 0)
);

COMMENT ON TABLE public.offline_trip_types IS
  'Rate Layer Path 1: trip types that require consultant/offline paste only.';

CREATE UNIQUE INDEX IF NOT EXISTS offline_trip_types_trip_type_uidx
  ON public.offline_trip_types (lower(trip_type));

-- =============================================================================
-- 4. wholesaler_destinations (Paths 2–4)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.wholesaler_destinations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination       text NOT NULL,
  wholesaler_name   text NOT NULL,
  api_source        text NOT NULL,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT wholesaler_destinations_destination_not_blank
    CHECK (length(trim(destination)) > 0),
  CONSTRAINT wholesaler_destinations_wholesaler_name_not_blank
    CHECK (length(trim(wholesaler_name)) > 0),
  CONSTRAINT wholesaler_destinations_api_source_not_blank
    CHECK (length(trim(api_source)) > 0)
);

COMMENT ON TABLE public.wholesaler_destinations IS
  'Rate Layer Paths 2–4: wholesale sources additive for listed destinations.';

CREATE INDEX IF NOT EXISTS wholesaler_destinations_destination_lower_idx
  ON public.wholesaler_destinations (lower(destination))
  WHERE active = true;

-- =============================================================================
-- 5. high_value_routing (Path 5 — wholesale/offline first)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.high_value_routing (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination        text,
  property_id        uuid REFERENCES public.properties (id) ON DELETE CASCADE,
  wholesale_source   text NOT NULL,
  notes              text,
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT high_value_routing_wholesale_source_not_blank
    CHECK (length(trim(wholesale_source)) > 0),
  CONSTRAINT high_value_routing_scope_xor
    CHECK (
      (destination IS NOT NULL AND length(trim(destination)) > 0 AND property_id IS NULL)
      OR
      (destination IS NULL AND property_id IS NOT NULL)
    )
);

COMMENT ON TABLE public.high_value_routing IS
  'Rate Layer Path 5: wholesale/offline first for a destination XOR a property.';

CREATE INDEX IF NOT EXISTS high_value_routing_destination_lower_idx
  ON public.high_value_routing (lower(destination))
  WHERE active = true AND destination IS NOT NULL;

CREATE INDEX IF NOT EXISTS high_value_routing_property_id_idx
  ON public.high_value_routing (property_id)
  WHERE active = true AND property_id IS NOT NULL;

-- =============================================================================
-- 6. RBAC — Rate Layer permissions
-- =============================================================================

INSERT INTO public.studio_permissions (slug, module, action, label, sort_order)
VALUES
  ('rates.search', 'rates', 'search', 'Search rate suppliers', 35),
  ('settings.rate_sources', 'settings', 'rate_sources', 'Manage rate source routing', 112)
ON CONFLICT (slug) DO NOTHING;

-- Advisors / ops reach search via Trip Builder; grant rates.search explicitly.
INSERT INTO public.studio_role_permissions (role_slug, permission_slug)
SELECT role_slug, permission_slug
FROM (
  VALUES
    ('advisor', 'rates.search'),
    ('ops', 'rates.search'),
    ('admin', 'rates.search'),
    ('admin', 'settings.rate_sources'),
    ('ops', 'settings.rate_sources')
) AS g(role_slug, permission_slug)
WHERE EXISTS (
  SELECT 1 FROM public.studio_roles r WHERE r.slug = g.role_slug
)
AND EXISTS (
  SELECT 1 FROM public.studio_permissions p WHERE p.slug = g.permission_slug
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 7. RLS + service_role grants
-- =============================================================================

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_trip_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesaler_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.high_value_routing ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offline_trip_types TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wholesaler_destinations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.high_value_routing TO service_role;
