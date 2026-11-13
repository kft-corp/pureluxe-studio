-- Typed experience-bank fields for activities + restaurants (guide Who/Lead/Veg).
-- Multi-country. Prefer these over stuffing meta into kb_entities.external_ids.
-- Depends on: 016 (kb_activity_details, kb_restaurant_details).
-- Additive only.

ALTER TABLE public.kb_activity_details
  ADD COLUMN IF NOT EXISTS who_it_suits text,
  ADD COLUMN IF NOT EXISTS lead_time text,
  ADD COLUMN IF NOT EXISTS veg_jain_notes text,
  ADD COLUMN IF NOT EXISTS guide_type text,
  ADD COLUMN IF NOT EXISTS seen_in text;

ALTER TABLE public.kb_restaurant_details
  ADD COLUMN IF NOT EXISTS who_it_suits text,
  ADD COLUMN IF NOT EXISTS lead_time text,
  ADD COLUMN IF NOT EXISTS veg_jain_notes text,
  ADD COLUMN IF NOT EXISTS guide_type text,
  ADD COLUMN IF NOT EXISTS seen_in text;

COMMENT ON COLUMN public.kb_activity_details.who_it_suits IS
  'Guide Who it suits (families, couples, all…).';
COMMENT ON COLUMN public.kb_activity_details.lead_time IS
  'Booking lead time — not duration_text.';
COMMENT ON COLUMN public.kb_activity_details.veg_jain_notes IS
  'Vegetarian / Jain notes when relevant.';
COMMENT ON COLUMN public.kb_activity_details.guide_type IS
  'Guide Type label: Experience / Activity.';
COMMENT ON COLUMN public.kb_activity_details.seen_in IS
  'Optional provenance (past trip / to-do list).';
COMMENT ON COLUMN public.kb_activity_details.duration_text IS
  'Real activity duration only — not booking lead time.';

COMMENT ON COLUMN public.kb_restaurant_details.who_it_suits IS
  'Guide Who it suits.';
COMMENT ON COLUMN public.kb_restaurant_details.lead_time IS
  'Booking lead time.';
COMMENT ON COLUMN public.kb_restaurant_details.veg_jain_notes IS
  'Vegetarian / Jain notes.';
COMMENT ON COLUMN public.kb_restaurant_details.guide_type IS
  'Guide Type label: Restaurant / Bar.';
COMMENT ON COLUMN public.kb_restaurant_details.seen_in IS
  'Optional provenance (past trip / to-do list).';

-- Move mis-filed lead times out of duration_text when typed lead_time is empty.
UPDATE public.kb_activity_details d
SET
  lead_time = coalesce(nullif(trim(d.lead_time), ''), nullif(trim(d.duration_text), '')),
  duration_text = CASE
    WHEN d.lead_time IS NULL OR trim(d.lead_time) = ''
      THEN NULL
    ELSE d.duration_text
  END
WHERE d.duration_text IS NOT NULL
  AND trim(d.duration_text) <> ''
  AND (
    d.lead_time IS NULL
    OR trim(d.lead_time) = ''
    OR lower(d.duration_text) = lower(coalesce(d.lead_time, ''))
  );
