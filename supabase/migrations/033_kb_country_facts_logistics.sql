-- Typed country logistics for Trip Builder Destination information / Where spine.
-- Multi-country: getting there/around, etiquette, dining, pitfalls, ideal trip length.
-- Depends on: 016 (kb_country_facts).
-- Additive only.

ALTER TABLE public.kb_country_facts
  ADD COLUMN IF NOT EXISTS getting_there text,
  ADD COLUMN IF NOT EXISTS getting_around text,
  ADD COLUMN IF NOT EXISTS etiquette_notes text,
  ADD COLUMN IF NOT EXISTS dining_notes text,
  ADD COLUMN IF NOT EXISTS pitfalls text,
  ADD COLUMN IF NOT EXISTS ideal_trip_length text;

COMMENT ON COLUMN public.kb_country_facts.getting_there IS
  'Flights / open-jaw / preferred airports. Destination-guide logistics.';
COMMENT ON COLUMN public.kb_country_facts.getting_around IS
  'Rail, transfers, luggage forwarding, drivers — country-level.';
COMMENT ON COLUMN public.kb_country_facts.etiquette_notes IS
  'Local etiquette (tipping, shoes, onsen tattoos, …). Prefer over stuffing safety_notes.';
COMMENT ON COLUMN public.kb_country_facts.dining_notes IS
  'Country-level restaurant booking / diet notes (not hotel dining_notes).';
COMMENT ON COLUMN public.kb_country_facts.pitfalls IS
  'Common advisor pitfalls for this destination.';
COMMENT ON COLUMN public.kb_country_facts.ideal_trip_length IS
  'First-time (and optional return) length + night split. City nights stay on kb_destination_facts.';

COMMENT ON COLUMN public.kb_country_facts.general_notes IS
  'Short intro / overflow only — prefer typed logistics columns for Getting there/around, dining, pitfalls, length.';
COMMENT ON COLUMN public.kb_country_facts.safety_notes IS
  'Safety / punctuality / closures — etiquette belongs in etiquette_notes.';
