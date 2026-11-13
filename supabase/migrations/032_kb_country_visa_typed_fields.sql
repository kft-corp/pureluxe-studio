-- Typed visa fields for Trip Builder (multi-country × passport).
-- Avoids regex scraping of details prose for fee / apply / processing / docs.
-- Depends on: 016 (kb_country_visa_rules).
-- Additive only.

ALTER TABLE public.kb_country_visa_rules
  ADD COLUMN IF NOT EXISTS fee_text text,
  ADD COLUMN IF NOT EXISTS processing_text text,
  ADD COLUMN IF NOT EXISTS where_to_apply text,
  ADD COLUMN IF NOT EXISTS documents_text text,
  ADD COLUMN IF NOT EXISTS advisor_tips text,
  ADD COLUMN IF NOT EXISTS alternate_routes text,
  ADD COLUMN IF NOT EXISTS is_pureluxe_default boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.kb_country_visa_rules.fee_text IS
  'Advisor-facing fee line (e.g. Rs 3,100 per person). Null = unknown — never invent.';
COMMENT ON COLUMN public.kb_country_visa_rules.processing_text IS
  'Typical processing window (e.g. About 2 weeks).';
COMMENT ON COLUMN public.kb_country_visa_rules.where_to_apply IS
  'Where to lodge (VFS / embassy / consulate).';
COMMENT ON COLUMN public.kb_country_visa_rules.documents_text IS
  'Typical documents list (prose or newline / | separated).';
COMMENT ON COLUMN public.kb_country_visa_rules.advisor_tips IS
  'PureLuxe advisor tips (lead time vs trip dates, hotel vouchers early, …).';
COMMENT ON COLUMN public.kb_country_visa_rules.alternate_routes IS
  'Non-default routes (e.g. e-Visa exists but not PureLuxe default).';
COMMENT ON COLUMN public.kb_country_visa_rules.is_pureluxe_default IS
  'True when this row is the PureLuxe default process for this passport × country.';

COMMENT ON COLUMN public.kb_country_visa_rules.entry_type IS
  'Badge for the default / this row route: visa_free, e_visa, visa_on_arrival, embassy. summary + typed fields are the answer.';
