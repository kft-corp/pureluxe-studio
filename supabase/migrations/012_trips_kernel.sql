-- Trip kernel: shared journey tables for Trip Builder + Trips portfolio + Client App.
-- Spec: docs/studio/trip-builder-module.md §6 (seven-table kernel)
-- Flow completion (confirms, attachments, docs, recents): 015_trip_builder_flow.sql
-- Also: docs/studio/trips-module.md (reads these tables; no extra portfolio tables)
-- Depends on: 001 (team_members), 003 (clients), 011 (properties).
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE where practical.
--
-- Durable kernel (do NOT create trip_line_item_drafts or client_chat_messages):
--   trips, trip_clients, trip_legs, trip_itinerary_days,
--   trip_line_items, trip_documents, trip_chat_messages

-- =============================================================================
-- 1. clients.is_demo (parity with trips / bookings)
--    Spec: docs/studio/client module/client_deferred_fks.md §1.2
-- =============================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.is_demo IS
  'Demo/test client — hide from default CRM directory; cascade is_demo on create of trips/bookings.';

CREATE INDEX IF NOT EXISTS clients_is_demo_idx
  ON public.clients (is_demo)
  WHERE is_demo = true;

-- =============================================================================
-- 2. trips
--    One planning journey — Studio and Client App share this row.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trips (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_client_id       uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  relationship_owner_id   uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  title                   text,
  status                  text NOT NULL DEFAULT 'building'
                            CHECK (status IN (
                              'building',
                              'waiting_on_client',
                              'booking',
                              'confirmed',
                              'completed',
                              'cancelled'
                            )),
  client_visibility       text NOT NULL DEFAULT 'draft'
                            CHECK (client_visibility IN ('draft', 'ready', 'shared')),
  published_at            timestamptz,
  published_by_id         uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  sell_total              numeric,
  sell_currency           text,
  cost_total_internal     numeric,
  margin_internal         numeric,
  payment_plan            jsonb,
  pricing_locked_at       timestamptz,
  pricing_locked_by_id    uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  source                  text NOT NULL DEFAULT 'studio'
                            CHECK (source IN ('studio', 'client_app', 'import')),
  created_by_id           uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  is_demo                 boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trips IS
  'Canonical journey record for Trip Builder, Trips portfolio, and Client App. Never duplicate as trip_builder_trips.';
COMMENT ON COLUMN public.trips.status IS
  'Ops lifecycle — where advisors are in the work.';
COMMENT ON COLUMN public.trips.client_visibility IS
  'Guest gate — Client App may open commercial content only when shared.';
COMMENT ON COLUMN public.trips.cost_total_internal IS
  'Team only — never return on Client APIs.';
COMMENT ON COLUMN public.trips.margin_internal IS
  'Team only — never return on Client APIs.';

DROP TRIGGER IF EXISTS trips_set_updated_at ON public.trips;
CREATE TRIGGER trips_set_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS trips_relationship_owner_status_idx
  ON public.trips (relationship_owner_id, status);

CREATE INDEX IF NOT EXISTS trips_primary_client_id_idx
  ON public.trips (primary_client_id);

CREATE INDEX IF NOT EXISTS trips_client_visibility_idx
  ON public.trips (client_visibility)
  WHERE client_visibility = 'shared';

CREATE INDEX IF NOT EXISTS trips_is_demo_idx
  ON public.trips (is_demo)
  WHERE is_demo = true;

CREATE INDEX IF NOT EXISTS trips_updated_at_idx
  ON public.trips (updated_at DESC);

-- =============================================================================
-- 3. trip_clients (primary + companions)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trip_clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'companion'
                CHECK (role IN ('primary', 'companion')),
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (trip_id, client_id)
);

COMMENT ON TABLE public.trip_clients IS
  'Travellers on a trip. Primary should match trips.primary_client_id (enforce in domain).';

CREATE INDEX IF NOT EXISTS trip_clients_client_id_idx
  ON public.trip_clients (client_id);

CREATE INDEX IF NOT EXISTS trip_clients_trip_id_idx
  ON public.trip_clients (trip_id);

-- =============================================================================
-- 4. trip_legs
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trip_legs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id            uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  sequence_order     integer NOT NULL,
  destination        text NOT NULL,
  check_in           date,
  check_out          date,
  itinerary_status   text NOT NULL DEFAULT 'not_started'
                       CHECK (itinerary_status IN ('not_started', 'drafted', 'confirmed')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trip_legs_destination_not_blank
    CHECK (length(trim(destination)) > 0),
  CONSTRAINT trip_legs_sequence_positive
    CHECK (sequence_order >= 1),
  UNIQUE (trip_id, sequence_order)
);

COMMENT ON TABLE public.trip_legs IS
  'Ordered destination stops. Destination is free text (no destinations master).';

DROP TRIGGER IF EXISTS trip_legs_set_updated_at ON public.trip_legs;
CREATE TRIGGER trip_legs_set_updated_at
  BEFORE UPDATE ON public.trip_legs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS trip_legs_trip_id_idx
  ON public.trip_legs (trip_id);

CREATE INDEX IF NOT EXISTS trip_legs_check_in_idx
  ON public.trip_legs (check_in)
  WHERE check_in IS NOT NULL;

-- =============================================================================
-- 5. trip_itinerary_days
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trip_itinerary_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  leg_id      uuid NOT NULL REFERENCES public.trip_legs (id) ON DELETE CASCADE,
  day_num     integer NOT NULL,
  date        date,
  title       text,
  items       jsonb NOT NULL DEFAULT '[]'::jsonb,
  source      text NOT NULL
                CHECK (source IN ('curated', 'generated', 'manual')),
  verified    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trip_itinerary_days_day_num_positive
    CHECK (day_num >= 1),
  UNIQUE (leg_id, day_num)
);

COMMENT ON TABLE public.trip_itinerary_days IS
  'Day-by-day guest narrative + provenance. updated_at drives proposal STALE.';
COMMENT ON COLUMN public.trip_itinerary_days.source IS
  'Content provenance: curated (fact library) | generated (AI) | manual (Studio team edit — any role).';

DROP TRIGGER IF EXISTS trip_itinerary_days_set_updated_at ON public.trip_itinerary_days;
CREATE TRIGGER trip_itinerary_days_set_updated_at
  BEFORE UPDATE ON public.trip_itinerary_days
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS trip_itinerary_days_trip_id_idx
  ON public.trip_itinerary_days (trip_id);

CREATE INDEX IF NOT EXISTS trip_itinerary_days_leg_id_idx
  ON public.trip_itinerary_days (leg_id);

-- =============================================================================
-- 6. trip_line_items
--    Options + paste/search review (pending_review) — no separate drafts table.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trip_line_items (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                     uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  leg_id                      uuid REFERENCES public.trip_legs (id) ON DELETE SET NULL,
  category                    text NOT NULL
                                CHECK (category IN (
                                  'accommodation',
                                  'activity',
                                  'transfer',
                                  'flight'
                                )),
  title                       text NOT NULL,
  subtitle                    text,
  details                     text,
  property_id                 uuid REFERENCES public.properties (id) ON DELETE SET NULL,
  property_name               text,
  unit                        text
                                CHECK (unit IS NULL OR unit IN ('night', 'person', 'flat')),
  quantity                    numeric,
  unit_count                  numeric NOT NULL DEFAULT 1,
  rate_per_unit               numeric,
  tax_percentage              numeric,
  currency                    text,
  sell_amount                 numeric,
  cost_internal               numeric,
  rate_source_code            text,
  inclusions                  jsonb NOT NULL DEFAULT '[]'::jsonb,
  cancellation_policy         text,
  payment_policy              text,
  breakdown                   jsonb,
  room_size                   text,
  room_features               jsonb,
  segments                    jsonb,
  loyalty_hotel_eligible      boolean,
  loyalty_pureluxe_eligible   boolean,
  status                      text NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                  'pending_review',
                                  'pending',
                                  'confirmed',
                                  'rejected'
                                )),
  selected                    boolean NOT NULL DEFAULT false,
  guest_leaning               boolean NOT NULL DEFAULT false,
  source                      text NOT NULL DEFAULT 'manual'
                                CHECK (source IN ('manual', 'offline_kb', 'api')),
  raw_input                   text,
  extracted_json              jsonb,
  created_by_id               uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trip_line_items_title_not_blank
    CHECK (length(trim(title)) > 0)
);

COMMENT ON TABLE public.trip_line_items IS
  'Rate/service options on a trip. Paste/search review uses status=pending_review on this table.';
COMMENT ON COLUMN public.trip_line_items.cost_internal IS
  'Team only — never return on Client APIs.';
COMMENT ON COLUMN public.trip_line_items.status IS
  'pending_review → pending/rejected (approve gate); pending → confirmed when settled/booked.';
COMMENT ON COLUMN public.trip_line_items.raw_input IS
  'Original paste / payload ref for review path.';
COMMENT ON COLUMN public.trip_line_items.leg_id IS
  'Null when spanning legs (some flights).';

DROP TRIGGER IF EXISTS trip_line_items_set_updated_at ON public.trip_line_items;
CREATE TRIGGER trip_line_items_set_updated_at
  BEFORE UPDATE ON public.trip_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS trip_line_items_trip_id_idx
  ON public.trip_line_items (trip_id);

CREATE INDEX IF NOT EXISTS trip_line_items_leg_id_idx
  ON public.trip_line_items (leg_id)
  WHERE leg_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS trip_line_items_trip_status_idx
  ON public.trip_line_items (trip_id, status);

CREATE INDEX IF NOT EXISTS trip_line_items_selected_idx
  ON public.trip_line_items (trip_id, selected)
  WHERE selected = true;

CREATE INDEX IF NOT EXISTS trip_line_items_property_id_idx
  ON public.trip_line_items (property_id)
  WHERE property_id IS NOT NULL;

-- =============================================================================
-- 7. trip_documents
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trip_documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  type                text NOT NULL
                        CHECK (type IN ('itinerary', 'rates')),
  file_path           text NOT NULL,
  status              text NOT NULL DEFAULT 'ready'
                        CHECK (status IN ('ready', 'stale', 'generating')),
  generated_at        timestamptz NOT NULL DEFAULT now(),
  source_updated_at   timestamptz NOT NULL,

  CONSTRAINT trip_documents_file_path_not_blank
    CHECK (length(trim(file_path)) > 0)
);

COMMENT ON TABLE public.trip_documents IS
  'Generated itinerary / rate PDFs. Extend by type value — not new tables.';

CREATE INDEX IF NOT EXISTS trip_documents_trip_id_idx
  ON public.trip_documents (trip_id);

CREATE INDEX IF NOT EXISTS trip_documents_trip_type_idx
  ON public.trip_documents (trip_id, type);

CREATE INDEX IF NOT EXISTS trip_documents_stale_idx
  ON public.trip_documents (status)
  WHERE status = 'stale';

-- =============================================================================
-- 8. trip_chat_messages (studio | guest on one table)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trip_chat_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  channel          text NOT NULL
                     CHECK (channel IN ('studio', 'guest')),
  team_member_id   uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  role             text NOT NULL
                     CHECK (role IN ('user', 'assistant')),
  content          text NOT NULL,
  tool_calls       jsonb,
  mode             text
                     CHECK (mode IS NULL OR mode IN ('discover', 'execute')),
  is_demo          boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trip_chat_messages_content_not_blank
    CHECK (length(trim(content)) > 0)
);

COMMENT ON TABLE public.trip_chat_messages IS
  'Studio and guest chat on the same trip. Isolate by channel — never leak studio chat to Client APIs.';
COMMENT ON COLUMN public.trip_chat_messages.channel IS
  'studio = Trip Builder; guest = Client App.';
COMMENT ON COLUMN public.trip_chat_messages.mode IS
  'Guest Curator (discover) vs Assistant (execute).';

CREATE INDEX IF NOT EXISTS trip_chat_messages_trip_channel_created_idx
  ON public.trip_chat_messages (trip_id, channel, created_at);

CREATE INDEX IF NOT EXISTS trip_chat_messages_team_member_id_idx
  ON public.trip_chat_messages (team_member_id)
  WHERE team_member_id IS NOT NULL;

-- =============================================================================
-- 9. Storage — trip proposal PDFs (private; signed URLs via API)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-documents',
  'trip-documents',
  false,
  20971520,
  ARRAY[
    'application/pdf'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================================================
-- 10. RBAC alignment — Trip Builder / Trips (ops + finance visibility)
-- =============================================================================

-- Ops helps paste / specialist rates inside Builder.
INSERT INTO public.studio_role_permissions (role_slug, permission_slug)
SELECT 'ops', slug
FROM public.studio_permissions
WHERE slug IN ('trip_builder.read', 'trip_builder.write')
ON CONFLICT DO NOTHING;

-- Finance may read Builder commercial fields when granted trip_builder.read.
INSERT INTO public.studio_role_permissions (role_slug, permission_slug)
SELECT 'finance', slug
FROM public.studio_permissions
WHERE slug IN ('trip_builder.read')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 11. RLS + service_role grants
-- =============================================================================

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_chat_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_clients TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_legs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_itinerary_days TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_line_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_chat_messages TO service_role;
