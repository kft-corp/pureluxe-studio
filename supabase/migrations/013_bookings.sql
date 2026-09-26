-- Bookings: confirmed travel inventory ledger.
-- Spec: docs/studio/booking-module.md §6
-- Depends on: 001 (team_members), 003 (clients), 005 (family_booking_members),
--             011 (properties), 012 (trips / trip_legs / trip_line_items).
-- Safe to re-run: IF NOT EXISTS / ON CONFLICT where practical.
--
-- Also completes deferred FK:
--   family_booking_members.booking_id → bookings(id)
--   (docs/studio/client module/client_deferred_fks.md §1.1)

-- =============================================================================
-- 1. bookings
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bookings (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                 uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  trip_id                   uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  trip_leg_id               uuid REFERENCES public.trip_legs (id) ON DELETE SET NULL,
  trip_line_item_id         uuid REFERENCES public.trip_line_items (id) ON DELETE SET NULL,
  service_type              text NOT NULL
                              CHECK (service_type IN ('hotel', 'flight', 'transfer', 'activity')),
  relationship_owner_id     uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  booked_by_id              uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  source                    text NOT NULL
                              CHECK (source IN ('trip_builder', 'manual', 'client_app', 'import')),
  title                     text NOT NULL,
  property_id               uuid REFERENCES public.properties (id) ON DELETE SET NULL,
  hotel_name                text,
  city                      text,
  country                   text,
  chain                     text,
  start_date                date,
  end_date                  date,
  nights                    integer,
  num_rooms                 integer,
  num_adults                integer,
  num_children              integer,
  supplier_name             text,
  supplier_ref              text,
  booking_channel           text,
  currency                  text,
  cost_amount               numeric,
  sell_amount               numeric,
  commission_expected       numeric,
  status                    text NOT NULL DEFAULT 'pending'
                              CHECK (status IN (
                                'pending',
                                'on_hold',
                                'confirmed',
                                'cancelled',
                                'completed',
                                'superseded'
                              )),
  confirmed_at              timestamptz,
  cancelled_at              timestamptz,
  cancellation_reason       text,
  cancellation_deadline     date,
  cancellation_policy       text,
  ticket_time_limit         timestamptz,
  amended_from_id           uuid REFERENCES public.bookings (id) ON DELETE SET NULL,
  guest_visible             boolean NOT NULL DEFAULT false,
  guest_notes               text,
  internal_notes            text,
  confirmation_file_path    text,
  service_details           jsonb NOT NULL DEFAULT '{}'::jsonb,
  vip_flag                  boolean NOT NULL DEFAULT false,
  special_occasion          text,
  is_demo                   boolean NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bookings_title_not_blank
    CHECK (length(trim(title)) > 0),
  CONSTRAINT bookings_nights_non_negative
    CHECK (nights IS NULL OR nights >= 0)
);

COMMENT ON TABLE public.bookings IS
  'Confirmed inventory ledger — one row per reservation. Studio + Client App share this table.';
COMMENT ON COLUMN public.bookings.cost_amount IS
  'Team only — supplier cost snapshot; never return on Client APIs.';
COMMENT ON COLUMN public.bookings.internal_notes IS
  'Studio only — never return on Client APIs.';
COMMENT ON COLUMN public.bookings.guest_visible IS
  'Client App gate (also requires trip shared when trip_id is set).';
COMMENT ON COLUMN public.bookings.service_details IS
  'Type-specific payload (room/board, flight segments, etc.).';
COMMENT ON COLUMN public.bookings.trip_line_item_id IS
  'Provenance from Trip Builder Book — domain must reject pending_review/rejected lines.';
COMMENT ON COLUMN public.bookings.start_date IS
  'Service start — hotel check-in, flight departure day, transfer day, etc.';
COMMENT ON COLUMN public.bookings.end_date IS
  'Service end — hotel check-out, flight return/arrival day, etc.';
COMMENT ON COLUMN public.bookings.booking_channel IS
  'How booked: direct / wholesale / GDS / etc. Team only.';
COMMENT ON COLUMN public.bookings.confirmed_at IS
  'When status became confirmed — SLA and Needs-confirm clearance.';
COMMENT ON COLUMN public.bookings.cancelled_at IS
  'When status became cancelled.';
COMMENT ON COLUMN public.bookings.cancellation_reason IS
  'Ops reason for cancel — filterable beyond audit log.';

DROP TRIGGER IF EXISTS bookings_set_updated_at ON public.bookings;
CREATE TRIGGER bookings_set_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS bookings_owner_status_start_date_idx
  ON public.bookings (relationship_owner_id, status, start_date);

CREATE INDEX IF NOT EXISTS bookings_client_start_date_idx
  ON public.bookings (client_id, start_date DESC);

CREATE INDEX IF NOT EXISTS bookings_trip_id_idx
  ON public.bookings (trip_id)
  WHERE trip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_trip_leg_id_idx
  ON public.bookings (trip_leg_id)
  WHERE trip_leg_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_trip_line_item_id_idx
  ON public.bookings (trip_line_item_id)
  WHERE trip_line_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_cancel_deadline_idx
  ON public.bookings (status, cancellation_deadline)
  WHERE cancellation_deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_supplier_ref_idx
  ON public.bookings (supplier_ref)
  WHERE supplier_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_service_type_start_date_idx
  ON public.bookings (service_type, start_date);

CREATE INDEX IF NOT EXISTS bookings_confirmed_at_idx
  ON public.bookings (confirmed_at)
  WHERE confirmed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_cancelled_at_idx
  ON public.bookings (cancelled_at)
  WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_ticket_time_limit_idx
  ON public.bookings (ticket_time_limit)
  WHERE ticket_time_limit IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_is_demo_idx
  ON public.bookings (is_demo)
  WHERE is_demo = true;

CREATE INDEX IF NOT EXISTS bookings_property_id_idx
  ON public.bookings (property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_hotel_name_trgm_idx
  ON public.bookings USING gin (hotel_name gin_trgm_ops)
  WHERE hotel_name IS NOT NULL;

-- =============================================================================
-- 2. booking_travellers
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.booking_travellers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id              uuid NOT NULL REFERENCES public.bookings (id) ON DELETE CASCADE,
  client_id               uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  title                   text,
  full_name               text NOT NULL,
  gender                  text
                            CHECK (gender IS NULL OR gender IN ('male', 'female', 'unspecified')),
  role                    text NOT NULL DEFAULT 'adult'
                            CHECK (role IN ('lead', 'adult', 'child', 'infant')),
  date_of_birth           date,
  passport_number         text,
  passport_nationality    text,
  passport_expiry         date,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT booking_travellers_full_name_not_blank
    CHECK (length(trim(full_name)) > 0),
  CONSTRAINT booking_travellers_title_not_blank
    CHECK (title IS NULL OR length(trim(title)) > 0)
);

COMMENT ON TABLE public.booking_travellers IS
  'Named people on a reservation (passport fields for ops). Prefer client_id when known.';
COMMENT ON COLUMN public.booking_travellers.title IS
  'Honorific for ticketing / hotel (e.g. Mr, Ms, Mrs, Dr) — as used on the reservation.';
COMMENT ON COLUMN public.booking_travellers.gender IS
  'Traveller gender for airline/hotel forms when required: male | female | unspecified.';

DROP TRIGGER IF EXISTS booking_travellers_set_updated_at ON public.booking_travellers;
CREATE TRIGGER booking_travellers_set_updated_at
  BEFORE UPDATE ON public.booking_travellers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS booking_travellers_booking_id_idx
  ON public.booking_travellers (booking_id);

CREATE INDEX IF NOT EXISTS booking_travellers_client_id_idx
  ON public.booking_travellers (client_id)
  WHERE client_id IS NOT NULL;

-- =============================================================================
-- 3. booking_audit_log
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.booking_audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid NOT NULL REFERENCES public.bookings (id) ON DELETE CASCADE,
  action            text NOT NULL,
  field_name        text,
  old_value         text,
  new_value         text,
  performed_by      text NOT NULL DEFAULT 'team'
                      CHECK (performed_by IN ('team', 'system', 'client')),
  team_member_id    uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT booking_audit_log_action_not_blank
    CHECK (length(trim(action)) > 0)
);

COMMENT ON TABLE public.booking_audit_log IS
  'Append-oriented history for booking status, money, owner, and ref changes.';
COMMENT ON COLUMN public.booking_audit_log.performed_by IS
  'Who initiated the change: team (Studio) | system (jobs/automation) | client (Client App).';
COMMENT ON COLUMN public.booking_audit_log.team_member_id IS
  'Set when performed_by = team — the advisor/ops member who made the change.';

CREATE INDEX IF NOT EXISTS booking_audit_log_booking_created_idx
  ON public.booking_audit_log (booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS booking_audit_log_team_member_id_idx
  ON public.booking_audit_log (team_member_id)
  WHERE team_member_id IS NOT NULL;

-- =============================================================================
-- 4. Deferred FK — family_booking_members.booking_id → bookings
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'family_booking_members_booking_id_fkey'
  ) THEN
    ALTER TABLE public.family_booking_members
      ADD CONSTRAINT family_booking_members_booking_id_fkey
      FOREIGN KEY (booking_id)
      REFERENCES public.bookings (id)
      ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON COLUMN public.family_booking_members.booking_id IS
  'FK to bookings(id). Household travellers on a booking.';

CREATE INDEX IF NOT EXISTS family_booking_members_booking_id_idx
  ON public.family_booking_members (booking_id);

-- =============================================================================
-- 5. Storage — booking confirmations / e-tickets (private)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'booking-confirmations',
  'booking-confirmations',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================================================
-- 6. RBAC alignment — advisors own Mine bookings (booking-module.md)
-- =============================================================================

INSERT INTO public.studio_role_permissions (role_slug, permission_slug)
SELECT 'advisor', slug
FROM public.studio_permissions
WHERE slug IN ('bookings.read', 'bookings.write')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 7. RLS + service_role grants
-- =============================================================================

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_travellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_audit_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_travellers TO service_role;
GRANT SELECT, INSERT, DELETE ON public.booking_audit_log TO service_role;
