-- Options quote PDF sits beside the final rates quote.
-- One row per trip + type, so `options` and `rates` can both exist.

ALTER TABLE public.trip_documents
  DROP CONSTRAINT IF EXISTS trip_documents_type_check;

ALTER TABLE public.trip_documents
  ADD CONSTRAINT trip_documents_type_check
  CHECK (type IN ('itinerary', 'rates', 'options'));

COMMENT ON TABLE public.trip_documents IS
  'Generated files for a trip. itinerary, options (rooms shared with the client), and rates (the chosen stay).';
