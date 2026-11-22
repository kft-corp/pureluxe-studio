-- Total guests cap per contracted room category (adults + children; infants excluded).
-- Null = no total cap (max_adults / max_children still apply when set).

ALTER TABLE public.property_contracted_rates
  ADD COLUMN IF NOT EXISTS max_occupancy int;

ALTER TABLE public.property_contracted_rates
  DROP CONSTRAINT IF EXISTS property_contracted_rates_max_occupancy_ok;

ALTER TABLE public.property_contracted_rates
  ADD CONSTRAINT property_contracted_rates_max_occupancy_ok
    CHECK (max_occupancy IS NULL OR max_occupancy >= 1);
