-- Typed itinerary shape fields for Trip Builder Suggested itineraries.
-- Multi-country: duration, suits, sort, default first-trip, seasonal modifiers.
-- Depends on: 016 (kb_itineraries).
-- Additive only.

ALTER TABLE public.kb_itineraries
  ADD COLUMN IF NOT EXISTS duration_nights int,
  ADD COLUMN IF NOT EXISTS suits text,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_default_first_trip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seasonal_notes text;

COMMENT ON COLUMN public.kb_itineraries.duration_nights IS
  'Guide Length (nights). Draft counts OK until founder lengthens.';
COMMENT ON COLUMN public.kb_itineraries.suits IS
  'Who this shape suits (first-timers, couples, ski families…).';
COMMENT ON COLUMN public.kb_itineraries.sort_order IS
  'Display / pick order (lower first).';
COMMENT ON COLUMN public.kb_itineraries.is_default_first_trip IS
  'Prefer this template on Where / country first-trip when set.';
COMMENT ON COLUMN public.kb_itineraries.seasonal_notes IS
  'Sakura / autumn / summer / family / honeymoon modifiers (usually on default row).';
COMMENT ON COLUMN public.kb_itineraries.destination_summary IS
  'Route line (nights per place) + optional PureLuxe pace note.';

ALTER TABLE public.kb_itineraries
  DROP CONSTRAINT IF EXISTS kb_itineraries_duration_nights_positive;
ALTER TABLE public.kb_itineraries
  ADD CONSTRAINT kb_itineraries_duration_nights_positive
  CHECK (duration_nights IS NULL OR duration_nights >= 1);
