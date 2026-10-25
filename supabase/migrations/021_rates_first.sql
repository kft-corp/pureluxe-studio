-- Trip Builder agent v2, Stage 3a–3d foundations: hotel search, tiers, price bands,
-- destination IDs, contract tax/market columns, and quote-option columns.
-- Spec: docs/trip-builder-agent-redesign.md §7.2, §7.3, §7.5, §8 (R5, R7, R8, R10, R11),
--       §14 Stage 3a–3d, Appendix A.4–A.6 (021 parts only).
-- Depends on: 003 (pg_trgm), 011 (properties, property_contracts, property_contracted_rates),
--             012 (trip_legs, trip_line_items), 016 (kb_countries, kb_cities, kb_entities,
--             kb_hotel_details), 018 (rate_search_results).
--
-- Additive. Safe to re-run: IF NOT EXISTS / DROP IF EXISTS + CREATE OR REPLACE.
-- Stage 3a wires search + hotel_find; 3b uses tax/market; 3d uses quote columns.

-- =============================================================================
-- 1. properties — aliases + destination IDs (R5, R7)
-- =============================================================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS kb_country_id uuid REFERENCES public.kb_countries (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kb_city_id uuid REFERENCES public.kb_cities (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.properties.aliases IS
  'Alternate hotel names for fuzzy search (e.g. Kanuhura for Six Senses Kanuhura).';
COMMENT ON COLUMN public.properties.kb_country_id IS
  'Atlas country for matching; free-text country/destination stay for display.';
COMMENT ON COLUMN public.properties.kb_city_id IS
  'Atlas city for matching; free-text city stays for display.';

CREATE INDEX IF NOT EXISTS properties_aliases_idx
  ON public.properties USING gin (aliases);

CREATE INDEX IF NOT EXISTS properties_kb_country_idx
  ON public.properties (kb_country_id)
  WHERE active = true AND kb_country_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS properties_kb_city_idx
  ON public.properties (kb_city_id)
  WHERE active = true AND kb_city_id IS NOT NULL;

-- =============================================================================
-- 2. trip_legs — destination IDs (R7)
-- =============================================================================

ALTER TABLE public.trip_legs
  ADD COLUMN IF NOT EXISTS kb_country_id uuid REFERENCES public.kb_countries (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kb_city_id uuid REFERENCES public.kb_cities (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.trip_legs.kb_country_id IS
  'Atlas country for the stop; destination text stays for display.';
COMMENT ON COLUMN public.trip_legs.kb_city_id IS
  'Atlas city for the stop; destination text stays for display.';

-- =============================================================================
-- 3. kb_hotel_details — style tags and Hotels-sheet price tier (R8 / Feedback v2 note 5)
-- =============================================================================

ALTER TABLE public.kb_hotel_details
  ADD COLUMN IF NOT EXISTS style_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS price_tier text;

COMMENT ON COLUMN public.kb_hotel_details.style_tags IS
  'Style labels for similar-hotel matching (overwater, family, adults-only, …).';
COMMENT ON COLUMN public.kb_hotel_details.price_tier IS
  'Hotels-sheet tier: ultra_luxury / luxury / premium. Null until imported.';

ALTER TABLE public.kb_hotel_details
  DROP CONSTRAINT IF EXISTS kb_hotel_details_price_tier_check;

ALTER TABLE public.kb_hotel_details
  ADD CONSTRAINT kb_hotel_details_price_tier_check
    CHECK (price_tier IS NULL OR price_tier IN ('ultra_luxury', 'luxury', 'premium'));

CREATE INDEX IF NOT EXISTS kb_hotel_details_style_tags_idx
  ON public.kb_hotel_details USING gin (style_tags);

CREATE INDEX IF NOT EXISTS kb_hotel_details_price_tier_idx
  ON public.kb_hotel_details (price_tier)
  WHERE price_tier IS NOT NULL;

-- =============================================================================
-- 4. search_properties() — ranked fuzzy hotel search (R5)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_properties(
  q text,
  dest text DEFAULT NULL,
  lim int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  name text,
  destination text,
  city text,
  country text,
  score real,
  aliases text[],
  price_tier text,
  style_tags text[]
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.name,
    p.destination,
    p.city,
    p.country,
    GREATEST(
      CASE WHEN lower(p.name) = lower(trim(q)) THEN 1.0 ELSE 0 END,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM unnest(p.aliases) a WHERE lower(a) = lower(trim(q))
        ) THEN 0.95
        ELSE 0
      END,
      similarity(p.name, trim(q)),
      COALESCE(
        (
          SELECT max(similarity(a, trim(q)))
          FROM unnest(p.aliases) a
        ),
        0
      )
    )::real AS score,
    p.aliases,
    d.price_tier,
    COALESCE(d.style_tags, '{}'::text[]) AS style_tags
  FROM public.properties p
  LEFT JOIN public.kb_entities e
    ON e.property_id = p.id
   AND e.active = true
   AND e.entity_type = 'hotel'
  LEFT JOIN public.kb_hotel_details d
    ON d.entity_id = e.id
  WHERE p.active
    AND length(trim(q)) >= 2
    AND (
      dest IS NULL
      OR length(trim(dest)) = 0
      OR lower(coalesce(p.destination, '')) = lower(trim(dest))
      OR lower(coalesce(p.country, '')) = lower(trim(dest))
      OR lower(coalesce(p.city, '')) = lower(trim(dest))
    )
    AND (
      p.name % trim(q)
      OR p.name ILIKE '%' || trim(q) || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(p.aliases) a
        WHERE lower(a) = lower(trim(q))
           OR a ILIKE '%' || trim(q) || '%'
           OR a % trim(q)
      )
    )
  ORDER BY score DESC, p.name
  LIMIT greatest(1, least(coalesce(lim, 8), 20));
$$;

COMMENT ON FUNCTION public.search_properties(text, text, int) IS
  'Ranked active hotels by name/alias (pg_trgm). Optional destination filter. Includes Atlas tier and style tags when linked.';

GRANT EXECUTE ON FUNCTION public.search_properties(text, text, int) TO service_role;

-- =============================================================================
-- 5. property_price_bands — typical nightly from contracted rates (R8)
-- =============================================================================

CREATE OR REPLACE VIEW public.property_price_bands AS
SELECT
  r.property_id,
  r.season_code,
  r.currency,
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY CASE
      WHEN r.rate_basis = 'nightly' THEN r.cost_amount
      WHEN r.package_nights IS NOT NULL AND r.package_nights > 0
        THEN r.cost_amount / r.package_nights
      ELSE r.cost_amount
    END
  ) AS typical_nightly,
  min(
    CASE
      WHEN r.rate_basis = 'nightly' THEN r.cost_amount
      WHEN r.package_nights IS NOT NULL AND r.package_nights > 0
        THEN r.cost_amount / r.package_nights
      ELSE r.cost_amount
    END
  ) AS min_nightly,
  max(
    CASE
      WHEN r.rate_basis = 'nightly' THEN r.cost_amount
      WHEN r.package_nights IS NOT NULL AND r.package_nights > 0
        THEN r.cost_amount / r.package_nights
      ELSE r.cost_amount
    END
  ) AS max_nightly,
  count(*)::int AS rate_count
FROM public.property_contracted_rates r
WHERE r.active = true
GROUP BY r.property_id, r.season_code, r.currency;

COMMENT ON VIEW public.property_price_bands IS
  'Typical / min / max nightly team cost per hotel and season from active contracted rates. Used for similar price-range suggestions.';

GRANT SELECT ON public.property_price_bands TO service_role;

-- =============================================================================
-- 6. property_contracts — tax, service charge, market codes (R10, R11; Stage 3b)
-- =============================================================================

ALTER TABLE public.property_contracts
  ADD COLUMN IF NOT EXISTS taxes_included boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_charge_pct numeric,
  ADD COLUMN IF NOT EXISTS tax_pct numeric,
  ADD COLUMN IF NOT EXISTS tax_on_service_charge boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS market_codes text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.property_contracts.taxes_included IS
  'When true, contracted room cost already includes tax.';
COMMENT ON COLUMN public.property_contracts.service_charge_pct IS
  'Service charge percent to add for all-in pricing when not included.';
COMMENT ON COLUMN public.property_contracts.tax_pct IS
  'Tax percent for all-in pricing when taxes_included is false.';
COMMENT ON COLUMN public.property_contracts.tax_on_service_charge IS
  'Maldives-style: tax applies to room + service charge.';
COMMENT ON COLUMN public.property_contracts.market_codes IS
  'ISO country codes this contract may be sold to. Empty = all markets. Free-text market stays for display.';

ALTER TABLE public.property_contracts
  DROP CONSTRAINT IF EXISTS property_contracts_service_charge_pct_range,
  DROP CONSTRAINT IF EXISTS property_contracts_tax_pct_range,
  DROP CONSTRAINT IF EXISTS property_contracts_market_codes_format;

ALTER TABLE public.property_contracts
  ADD CONSTRAINT property_contracts_service_charge_pct_range
    CHECK (service_charge_pct IS NULL OR service_charge_pct BETWEEN 0 AND 100),
  ADD CONSTRAINT property_contracts_tax_pct_range
    CHECK (tax_pct IS NULL OR tax_pct BETWEEN 0 AND 100),
  ADD CONSTRAINT property_contracts_market_codes_format
    CHECK (array_to_string(market_codes, ',') ~ '^([A-Z]{2}(,|$))*$');

-- =============================================================================
-- 7. trip_line_items — quote option columns (Stage 3d)
-- =============================================================================

ALTER TABLE public.trip_line_items
  ADD COLUMN IF NOT EXISTS rate_search_result_id uuid
    REFERENCES public.rate_search_results (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS markup_percent numeric,
  ADD COLUMN IF NOT EXISTS option_rank integer,
  ADD COLUMN IF NOT EXISTS added_via text;

COMMENT ON COLUMN public.trip_line_items.rate_search_result_id IS
  'Stored rate offer this option was copied from (re-check before booking).';
COMMENT ON COLUMN public.trip_line_items.markup_percent IS
  'Markup used when the option was added; re-price at the same markup if cost changes.';
COMMENT ON COLUMN public.trip_line_items.option_rank IS
  'Option 1 / option 2 order per hotel for compare view and PDF.';
COMMENT ON COLUMN public.trip_line_items.added_via IS
  'How the option was added: agent / button / paste / manual.';

ALTER TABLE public.trip_line_items
  DROP CONSTRAINT IF EXISTS trip_line_items_markup_percent_range,
  DROP CONSTRAINT IF EXISTS trip_line_items_option_rank_positive,
  DROP CONSTRAINT IF EXISTS trip_line_items_added_via_check;

ALTER TABLE public.trip_line_items
  ADD CONSTRAINT trip_line_items_markup_percent_range
    CHECK (markup_percent IS NULL OR markup_percent BETWEEN 0 AND 100),
  ADD CONSTRAINT trip_line_items_option_rank_positive
    CHECK (option_rank IS NULL OR option_rank >= 1),
  ADD CONSTRAINT trip_line_items_added_via_check
    CHECK (added_via IS NULL OR added_via IN ('agent', 'button', 'paste', 'manual'));

CREATE INDEX IF NOT EXISTS trip_line_items_rate_search_result_idx
  ON public.trip_line_items (rate_search_result_id)
  WHERE rate_search_result_id IS NOT NULL;
