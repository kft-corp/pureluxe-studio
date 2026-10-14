-- Client module: households (families), household booking members, and guest login.
-- Depends on 003_studio_clients.sql.
-- Canonical spec: docs/studio/client_module.md §6.7, §6.8
--
-- family_booking_members.booking_id is a UUID column without a FK until bookings exists.
-- Follow-up ALTER is documented in docs/studio/client_deferred_fks.md.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where practical.

-- =============================================================================
-- 1. families
--    Household label — who travels and bills together.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.families (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  notes          text,
  created_by_id  uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT families_name_not_blank CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE public.families IS
  'Household grouping. Shown on client profile header, e.g. "Chen Family".';
COMMENT ON COLUMN public.families.name IS 'Household label — not a duplicate of client display_name.';

DROP TRIGGER IF EXISTS families_set_updated_at ON public.families;
CREATE TRIGGER families_set_updated_at
  BEFORE UPDATE ON public.families
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2. family_members
--    Links clients to a household. At most one family per client (partial unique).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.family_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid NOT NULL REFERENCES public.families (id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member'
                CHECK (role IN ('primary', 'spouse', 'partner', 'child', 'parent', 'member')),
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (family_id, client_id)
);

COMMENT ON TABLE public.family_members IS
  'Client membership in a household. Spouse/child/parent roles live here — not in client_relationships.';
COMMENT ON COLUMN public.family_members.is_primary IS 'Exactly one true per family — enforced in app layer.';
COMMENT ON COLUMN public.family_members.created_at IS 'When this client was added to the family.';

CREATE UNIQUE INDEX IF NOT EXISTS family_members_one_family_per_client_uidx
  ON public.family_members (client_id);

DROP TRIGGER IF EXISTS family_members_set_updated_at ON public.family_members;
CREATE TRIGGER family_members_set_updated_at
  BEFORE UPDATE ON public.family_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. family_booking_members
--    Who on a household is on a given booking. booking_id has no FK yet
--    (bookings table is created in a later module). client_id still references clients.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.family_booking_members (
  booking_id  uuid NOT NULL,
  client_id   uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  PRIMARY KEY (booking_id, client_id)
);

COMMENT ON TABLE public.family_booking_members IS
  'Travellers on a booking. booking_id FK to bookings is added when that table exists — see docs/studio/client_deferred_fks.md.';
COMMENT ON COLUMN public.family_booking_members.booking_id IS
  'UUID of the booking. No REFERENCES until public.bookings is created.';

CREATE INDEX IF NOT EXISTS family_booking_members_client_idx
  ON public.family_booking_members (client_id);

-- =============================================================================
-- 4. guest_users
--    Invite-before-login guest identity — separate from CRM client row.
--    Family is resolved via family_members on the bound client_id (no family_id here).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.guest_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  client_id       uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending_access'
                    CHECK (status IN ('active', 'pending_access', 'disabled')),
  invited_by_id   uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  invited_at      timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT guest_users_email_not_blank CHECK (length(trim(email)) > 0)
);

COMMENT ON TABLE public.guest_users IS
  'Guest Client App login. One active guest login per client in v1. Email may differ from client contact email.';
COMMENT ON COLUMN public.guest_users.status IS 'active | pending_access | disabled';

CREATE UNIQUE INDEX IF NOT EXISTS guest_users_email_lower_uidx
  ON public.guest_users (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS guest_users_active_client_uidx
  ON public.guest_users (client_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS guest_users_client_id_idx
  ON public.guest_users (client_id);

DROP TRIGGER IF EXISTS guest_users_set_updated_at ON public.guest_users;
CREATE TRIGGER guest_users_set_updated_at
  BEFORE UPDATE ON public.guest_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 5. Row Level Security + service_role grants
-- =============================================================================

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_booking_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_users ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_booking_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_users TO service_role;
