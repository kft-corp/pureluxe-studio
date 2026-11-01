-- Rate Wave 1 — Fora-like rate card + room join (§I6 step 3 / §B5 / Part D P1R#18).
-- Spec: docs/studio/schema-improvements-atlas-rates.md §0.1, §B3.11, §B3.12
-- Depends on: 011 (properties, property_contracts, property_contracted_rates),
--             018 (rate_search_results), 024 (Wave 0), 025 (room external_key).
--
-- price_breakdown shape is frozen in app Zod (@pureluxe/rates); stored in
-- rate_search_results.raw.price_breakdown and trip_line_items.breakdown (already exist).
-- Additive only.

-- =============================================================================
-- 1. properties.preferred_partner — badge / filter (no contract relationship_tier)
-- =============================================================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS preferred_partner boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.properties.preferred_partner IS
  'Preferred-partner badge / filter (Fora Reserve–like). Only on properties — not contracts.';

CREATE INDEX IF NOT EXISTS properties_preferred_partner_idx
  ON public.properties (preferred_partner)
  WHERE preferred_partner = true AND active = true;

-- =============================================================================
-- 2. property_contracted_rates.room_category_external_key — join to Atlas rooms
-- =============================================================================

ALTER TABLE public.property_contracted_rates
  ADD COLUMN IF NOT EXISTS room_category_external_key text;

COMMENT ON COLUMN public.property_contracted_rates.room_category_external_key IS
  'Primary join to kb_hotel_room_categories.external_key. room_category name = display / import fallback.';

CREATE INDEX IF NOT EXISTS property_contracted_rates_room_key_idx
  ON public.property_contracted_rates (property_id, room_category_external_key)
  WHERE active = true AND room_category_external_key IS NOT NULL;

-- =============================================================================
-- 3. property_rate_perks — commercial / quote-time VIP labels
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_rate_perks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  contract_id           uuid REFERENCES public.property_contracts (id) ON DELETE CASCADE,
  contracted_rate_id    uuid REFERENCES public.property_contracted_rates (id) ON DELETE CASCADE,
  perk_key              text NOT NULL,
  label                 text NOT NULL,
  applies_to_all_rates  boolean NOT NULL DEFAULT true,
  active                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT property_rate_perks_perk_key_check
    CHECK (perk_key IN (
      'upgrade',
      'breakfast',
      'resort_credit',
      'early_check_in',
      'late_checkout',
      'other'
    )),
  CONSTRAINT property_rate_perks_label_not_blank
    CHECK (length(trim(label)) > 0)
);

COMMENT ON TABLE public.property_rate_perks IS
  'Perks tied to property / contract / rate at search time. Atlas kb_hotel_partner_perks is editorial; this is commercial.';
COMMENT ON COLUMN public.property_rate_perks.contract_id IS
  'Null = property-level commercial perk.';
COMMENT ON COLUMN public.property_rate_perks.contracted_rate_id IS
  'When set, perk applies to that Layer 1 rate row.';

DROP TRIGGER IF EXISTS property_rate_perks_set_updated_at ON public.property_rate_perks;
CREATE TRIGGER property_rate_perks_set_updated_at
  BEFORE UPDATE ON public.property_rate_perks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS property_rate_perks_property_idx
  ON public.property_rate_perks (property_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS property_rate_perks_contract_idx
  ON public.property_rate_perks (contract_id)
  WHERE active = true AND contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS property_rate_perks_rate_idx
  ON public.property_rate_perks (contracted_rate_id)
  WHERE active = true AND contracted_rate_id IS NOT NULL;

ALTER TABLE public.property_rate_perks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_rate_perks TO service_role;

-- =============================================================================
-- 4. rate_search_results.perk_labels — merged VIP strip at search time
-- =============================================================================

ALTER TABLE public.rate_search_results
  ADD COLUMN IF NOT EXISTS perk_labels text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.rate_search_results.perk_labels IS
  'Merged Atlas partner_perks + property_rate_perks labels resolved at rates_search time.';

COMMENT ON COLUMN public.rate_search_results.raw IS
  'Supplier / contract payload. Prefer raw.price_breakdown (schema_version: 1) for itemized stay math; copy to trip_line_items.breakdown on quote add.';
