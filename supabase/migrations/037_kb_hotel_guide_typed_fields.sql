-- Hotels-by-location typed fields + luxury_band uses guide Tier 1/2/3 labels.
-- Multi-country. Prefer these over stuffing meta into kb_entities.external_ids.
-- Depends on: 016 / 024 (kb_hotel_details.luxury_band).
-- Additive + value remap only.

ALTER TABLE public.kb_hotel_details
  ADD COLUMN IF NOT EXISTS guide_area text,
  ADD COLUMN IF NOT EXISTS guide_partner text,
  ADD COLUMN IF NOT EXISTS guide_score numeric;

COMMENT ON COLUMN public.kb_hotel_details.guide_area IS
  'Guide neighbourhood / area (Otemachi, Higashiyama…).';
COMMENT ON COLUMN public.kb_hotel_details.guide_partner IS
  'Partner program / status prose from destination guide.';
COMMENT ON COLUMN public.kb_hotel_details.guide_score IS
  'Internal guide average score (~1–5). Never show as a guest star rating.';

-- Drop old check before remap (024 only allows ultra_luxury/luxury/premium).
ALTER TABLE public.kb_hotel_details
  DROP CONSTRAINT IF EXISTS kb_hotel_details_luxury_band_check;

-- Remap legacy Hotels-sheet enum → PureLuxe proposed tiers.
UPDATE public.kb_hotel_details
SET luxury_band = CASE luxury_band
  WHEN 'ultra_luxury' THEN 'Tier 1'
  WHEN 'luxury' THEN 'Tier 2'
  WHEN 'premium' THEN 'Tier 3'
  ELSE luxury_band
END
WHERE luxury_band IN ('ultra_luxury', 'luxury', 'premium');

ALTER TABLE public.kb_hotel_details
  ADD CONSTRAINT kb_hotel_details_luxury_band_check
  CHECK (
    luxury_band IS NULL
    OR luxury_band IN ('Tier 1', 'Tier 2', 'Tier 3')
  );

COMMENT ON COLUMN public.kb_hotel_details.luxury_band IS
  'Proposed guide tier: Tier 1 / Tier 2 / Tier 3. Not a currency amount.';

-- Backfill typed columns from entity external_ids when present.
UPDATE public.kb_hotel_details d
SET
  guide_area = coalesce(
    nullif(trim(d.guide_area), ''),
    nullif(trim(e.external_ids->>'guide_area'), '')
  ),
  guide_partner = coalesce(
    nullif(trim(d.guide_partner), ''),
    nullif(trim(e.external_ids->>'guide_partner'), '')
  ),
  guide_score = coalesce(
    d.guide_score,
    CASE
      WHEN (e.external_ids->>'guide_score') ~ '^[0-9]+\.?[0-9]*'
        THEN substring(trim(e.external_ids->>'guide_score') from '^[0-9]+\.?[0-9]*')::numeric
      ELSE NULL
    END
  ),
  luxury_band = coalesce(
    d.luxury_band,
    CASE
      WHEN e.external_ids->>'guide_proposed_tier' IN ('Tier 1', 'Tier 2', 'Tier 3')
        THEN e.external_ids->>'guide_proposed_tier'
      WHEN e.external_ids->>'guide_proposed_tier' IN ('ultra_luxury') THEN 'Tier 1'
      WHEN e.external_ids->>'guide_proposed_tier' IN ('luxury') THEN 'Tier 2'
      WHEN e.external_ids->>'guide_proposed_tier' IN ('premium') THEN 'Tier 3'
      ELSE NULL
    END
  ),
  updated_at = now()
FROM public.kb_entities e
WHERE e.id = d.entity_id
  AND e.entity_type = 'hotel'
  AND (
    (d.guide_area IS NULL OR trim(d.guide_area) = '')
    OR (d.guide_partner IS NULL OR trim(d.guide_partner) = '')
    OR d.guide_score IS NULL
    OR d.luxury_band IS NULL
  )
  AND (
    e.external_ids ? 'guide_area'
    OR e.external_ids ? 'guide_partner'
    OR e.external_ids ? 'guide_score'
    OR e.external_ids ? 'guide_proposed_tier'
  );
