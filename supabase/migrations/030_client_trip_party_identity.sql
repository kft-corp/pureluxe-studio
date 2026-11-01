-- Client / trip party identity gaps:
--   clients.date_of_birth + gender (canonical, independent of passport)
--   clients.contact_optional (children / companions without email/phone)
--   trip_clients.stated_age + infant party_role
-- Depends on: 003 (clients), 012 (trip_clients).
-- Additive; safe-ish to re-run: IF NOT EXISTS / DROP IF EXISTS.

-- =============================================================================
-- 1. clients — DOB, gender, contact_optional
-- =============================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS contact_optional boolean NOT NULL DEFAULT false;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_gender_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_gender_check
  CHECK (gender IS NULL OR gender IN ('male', 'female', 'unspecified'));

COMMENT ON COLUMN public.clients.date_of_birth IS
  'Canonical person DOB. Passport document DOB remains document metadata; prefer verified passport when both set.';
COMMENT ON COLUMN public.clients.gender IS
  'For airline/hotel forms when required: male | female | unspecified.';
COMMENT ON COLUMN public.clients.contact_optional IS
  'When true, email/phone are not required (e.g. child companions). Studio New client stays contact-required.';

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_contact_required;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_contact_required CHECK (
    email IS NOT NULL
    OR phone IS NOT NULL
    OR contact_optional = true
  );

-- =============================================================================
-- 2. trip_clients — stated_age + infant
-- =============================================================================

ALTER TABLE public.trip_clients
  ADD COLUMN IF NOT EXISTS stated_age smallint;

ALTER TABLE public.trip_clients
  DROP CONSTRAINT IF EXISTS trip_clients_stated_age_range;

ALTER TABLE public.trip_clients
  ADD CONSTRAINT trip_clients_stated_age_range
  CHECK (stated_age IS NULL OR stated_age BETWEEN 0 AND 120);

COMMENT ON COLUMN public.trip_clients.stated_age IS
  'Advisor-stated age for this trip (wins over client/passport DOB for pricing on this trip).';

ALTER TABLE public.trip_clients
  DROP CONSTRAINT IF EXISTS trip_clients_party_role_check;

ALTER TABLE public.trip_clients
  ADD CONSTRAINT trip_clients_party_role_check
  CHECK (party_role IN ('adult', 'child', 'infant'));

COMMENT ON COLUMN public.trip_clients.party_role IS
  'adult | child | infant for rate occupancy. The primary traveller is an adult.';
