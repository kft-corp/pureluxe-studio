-- Drop hotel/airline loyalty JSON from clients.
-- PureLuxe has no guest loyalty storage in Studio for now.

ALTER TABLE public.clients
  DROP COLUMN IF EXISTS loyalty_programs;
