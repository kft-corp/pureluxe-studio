-- Client module: core identity (clients).
-- Depends on 001_studio_team_auth.sql (team_members).
-- Canonical spec: docs/studio/client_module.md §6.2
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where practical.

-- =============================================================================
-- 1. Extensions
--    pg_trgm powers directory search and dedup similarity (find_similar_clients).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- 2. clients
--    One person, one row — CRM anchor for Studio and Client App projections.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.clients (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity & contact
  display_name                text NOT NULL,
  title                       text,
  first_name                  text,
  last_name                   text,
  legal_name                  text,
  email                       text,
  phone                       text,
  whatsapp                    text,
  preferred_contact_method    text
                                CHECK (preferred_contact_method IN ('email', 'phone', 'whatsapp')),
  preferred_language          text,
  timezone                    text,

  -- Location & work
  nationality                 text,
  city_of_residence           text,
  company                     text,

  -- Full residential / mailing address (proof & records)
  address_line_1              text,
  address_line_2              text,
  address_city                text,
  address_state               text,
  address_postal_code         text,
  address_country             text,

  -- Relationship & tier
  relationship_owner_id       uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  vip_tier                    text NOT NULL DEFAULT 'standard'
                                CHECK (vip_tier IN ('standard', 'vip', 'vvip')),
  client_since                date DEFAULT CURRENT_DATE,
  referred_by_client_id       uuid REFERENCES public.clients (id) ON DELETE SET NULL,

  -- Profile enrichment (small lists edited as a unit)
  important_dates             jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Notes — guest_notes may inform AI; internal_notes never leave Studio
  guest_notes                 text,
  internal_notes              text,

  -- Ops & lifecycle
  source                      text NOT NULL DEFAULT 'studio'
                                CHECK (source IN ('studio', 'trip_builder', 'client_app', 'import')),
  review_status               text NOT NULL DEFAULT 'approved'
                                CHECK (review_status IN ('pending', 'approved')),
  reviewed_by_id              uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  reviewed_at                 timestamptz,
  profile_completeness        smallint NOT NULL DEFAULT 0
                                CHECK (profile_completeness BETWEEN 0 AND 100),
  avatar_url                  text,

  -- Search / dedup helpers (never UNIQUE — homonyms exist)
  normalized_display_name     text GENERATED ALWAYS AS (
                                lower(regexp_replace(display_name, '[^a-zA-Z0-9]', '', 'g'))
                              ) STORED,
  normalized_email            text GENERATED ALWAYS AS (lower(trim(email))) STORED,

  active                      boolean NOT NULL DEFAULT true,
  merged_into_client_id       uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  deactivated_at              timestamptz,
  deactivated_by_id           uuid REFERENCES public.team_members (id) ON DELETE SET NULL,

  created_by_id               uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  updated_by_id               uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT clients_contact_required CHECK (
    email IS NOT NULL OR phone IS NOT NULL
  ),
  CONSTRAINT clients_display_name_not_blank CHECK (length(trim(display_name)) > 0)
);

COMMENT ON TABLE public.clients IS
  'Core client identity — one person, one row. Studio reads/writes fully; Client App uses a guest projection.';
COMMENT ON COLUMN public.clients.display_name IS 'Canonical UI label, e.g. "Ada Chen".';
COMMENT ON COLUMN public.clients.legal_name IS 'Passport / GDS name when different from display_name.';
COMMENT ON COLUMN public.clients.city_of_residence IS 'Soft location for trip prep (e.g. New York). Full street address uses address_* columns.';
COMMENT ON COLUMN public.clients.address_line_1 IS 'Street address line 1 — residential / mailing for proof and records.';
COMMENT ON COLUMN public.clients.address_line_2 IS 'Street address line 2 — apt, suite, floor (optional).';
COMMENT ON COLUMN public.clients.address_city IS 'City on the full address (may match city_of_residence).';
COMMENT ON COLUMN public.clients.address_state IS 'State, province, or region.';
COMMENT ON COLUMN public.clients.address_postal_code IS 'Postal / ZIP code.';
COMMENT ON COLUMN public.clients.address_country IS 'ISO 3166-1 alpha-2 preferred (e.g. US).';
COMMENT ON COLUMN public.clients.guest_notes IS 'May inform guest AI; never shown raw in Client App.';
COMMENT ON COLUMN public.clients.internal_notes IS 'Team only; never returned by Client APIs.';
COMMENT ON COLUMN public.clients.review_status IS 'pending until ops approves Trip Builder / import creates; Studio New client is approved on create.';
COMMENT ON COLUMN public.clients.normalized_display_name IS 'Dedup helper — not unique (homonyms exist).';
COMMENT ON COLUMN public.clients.merged_into_client_id IS 'Set on merge loser; row stays for audit and FK history.';

CREATE INDEX IF NOT EXISTS clients_display_name_trgm_idx
  ON public.clients USING gin (display_name gin_trgm_ops)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS clients_normalized_email_idx
  ON public.clients (normalized_email)
  WHERE normalized_email IS NOT NULL AND active = true;

CREATE INDEX IF NOT EXISTS clients_vip_tier_idx
  ON public.clients (vip_tier)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS clients_pending_review_idx
  ON public.clients (created_at DESC)
  WHERE active = true AND review_status = 'pending';

CREATE INDEX IF NOT EXISTS clients_relationship_owner_idx
  ON public.clients (relationship_owner_id)
  WHERE active = true;

DROP TRIGGER IF EXISTS clients_set_updated_at ON public.clients;
CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. Row Level Security + service_role grants
-- =============================================================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO service_role;
