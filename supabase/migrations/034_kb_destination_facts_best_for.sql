-- Guide "Best for" on city destination facts (Locations table).
-- Multi-country free text — complements kb_destination_audience_notes (trip_style).
-- Depends on: 016 (kb_destination_facts).
-- Additive only.

ALTER TABLE public.kb_destination_facts
  ADD COLUMN IF NOT EXISTS best_for text;

COMMENT ON COLUMN public.kb_destination_facts.best_for IS
  'Who / what trips suit this city (guide Best for). Free text; style-specific lines stay in kb_destination_audience_notes.';
