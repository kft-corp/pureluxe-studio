-- Rate Wave 2 — commission at search (§I6 step 5 / §B5 / Part D P1R#19).
-- Spec: docs/studio/schema-improvements-atlas-rates.md §0.1 (commission basis), §B3.11 R3
-- Depends on: 011 (property_contracts, properties.default_commission), 026 (Rate Wave 1).
--
-- Studio math (app, not DB):
--   pct = contract.commission_percent ?? property.default_commission
--   basis = net → price_breakdown.cost_total | commissionable → sell_total
--   expected_commission_amount = basis * pct / 100
-- Never show on client PDF. No commission ledger table here (Bookings owns ledger).
-- Additive only.

-- =============================================================================
-- 1. property_contracts.commission_percent
-- =============================================================================

ALTER TABLE public.property_contracts
  ADD COLUMN IF NOT EXISTS commission_percent numeric;

COMMENT ON COLUMN public.property_contracts.commission_percent IS
  'Expected advisor commission % for this deal. Fallback = properties.default_commission. Studio only.';

ALTER TABLE public.property_contracts
  DROP CONSTRAINT IF EXISTS property_contracts_commission_percent_range;

ALTER TABLE public.property_contracts
  ADD CONSTRAINT property_contracts_commission_percent_range
    CHECK (
      commission_percent IS NULL
      OR commission_percent BETWEEN 0 AND 100
    );

COMMENT ON COLUMN public.properties.default_commission IS
  'Fallback commission % when property_contracts.commission_percent is null. Studio expected_commission only.';
