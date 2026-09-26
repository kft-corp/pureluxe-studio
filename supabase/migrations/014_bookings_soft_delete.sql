-- Soft-delete for bookings: hide from Studio ledger; keep row for audit.
-- Product rule: hard-delete is forbidden — cancel / supersede / soft-delete only.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.bookings.deleted_at IS
  'Soft-delete timestamp. NULL = visible in Studio. Set when removed from the ledger.';

CREATE INDEX IF NOT EXISTS bookings_deleted_at_idx
  ON public.bookings (deleted_at)
  WHERE deleted_at IS NOT NULL;
