-- Offline payment tracking on trips (record-only; collection stays outside Studio).
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS amount_received numeric,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_started';

ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_amount_received_non_negative,
  DROP CONSTRAINT IF EXISTS trips_payment_status_check;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_amount_received_non_negative
    CHECK (amount_received IS NULL OR amount_received >= 0),
  ADD CONSTRAINT trips_payment_status_check
    CHECK (payment_status IN ('not_started', 'partial', 'paid', 'overdue'));

COMMENT ON COLUMN public.trips.amount_received IS
  'Client money recorded as received (offline). Pending is sell_total minus this.';
COMMENT ON COLUMN public.trips.payment_status IS
  'Advisor payment tracking: not_started, partial, paid, or overdue.';
