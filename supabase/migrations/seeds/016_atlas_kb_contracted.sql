-- Atlas KB rows for contracted / pilot hotels used in Trip Builder testing.
-- NOT a migration — supabase db push ignores this folder.
--
-- Sources:
--   docs/excel sheets/PureLuxe Atlas KB — Hotels (...).xlsx (matching hotels)
--   docs/excel sheets/Contracted Rates Master (Pilot).xlsx
--   docs/contracted rate pdf/*.pdf (hotels missing from Atlas sheet)
--
-- Depends on:
--   migrations/011_rate_layer.sql (destination_profiles, properties)
--   migrations/016_atlas_kb.sql
--   seeds/011_rate_layer.sql (Maldives destination profile — run first)
--   Prefer also: seeds/011_rate_layer_contracted_pilot.sql (properties) before linking
--
-- Safe to re-run: inserts skip existing rows by natural keys.
-- Ensures every contracted hotel has at least region/country/city + kb_entities (+ details).

-- =============================================================================
-- 1. Source
-- =============================================================================

INSERT INTO public.kb_sources (name, source_type, terms_notes, active)
SELECT 'Contracted rates pilot + Atlas sheet', 'other',
       'Seeded from founder Excel/PDF digitization for Trip Builder testing.', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_sources s
  WHERE lower(s.name) = 'contracted rates pilot + atlas sheet'
);

-- =============================================================================
-- 2. Geography
-- =============================================================================

INSERT INTO public.kb_regions (name, sort_order, active)
SELECT v.name, v.sort_order, true
FROM (VALUES
  ('Asia', 10),
  ('Middle East', 20)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_regions r WHERE lower(r.name) = lower(v.name)
);

INSERT INTO public.kb_countries (region_id, name, country_code, active)
SELECT r.id, v.name, v.code, true
FROM (VALUES
  ('Asia', 'Maldives', 'MV'),
  ('Asia', 'India', 'IN')
) AS v(region, name, code)
JOIN public.kb_regions r ON lower(r.name) = lower(v.region)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_countries c WHERE c.country_code = v.code
);

INSERT INTO public.kb_cities (country_id, name, destination_profile_id, active)
SELECT c.id, v.city, dp.id, true
FROM (VALUES
  ('MV', 'South Malé Atoll, Ithaafushi', 'Maldives'),
  ('MV', 'South Malé Atoll', 'Maldives'),
  ('MV', 'Thaa Atoll, Maalefushi', 'Maldives'),
  ('MV', 'Raa Atoll', 'Maldives'),
  ('MV', 'Bodufushi Island, Raa Atoll', 'Maldives'),
  ('MV', 'Kanuhura Island, Lhaviyani Atoll', 'Maldives'),
  ('MV', 'Maalefushi', 'Maldives'),
  ('IN', 'Jawai', NULL),
  ('IN', 'Jaisalmer', NULL),
  ('IN', 'Ranthambhore', NULL)
) AS v(cc, city, dest)
JOIN public.kb_countries c ON c.country_code = v.cc
LEFT JOIN public.destination_profiles dp
  ON v.dest IS NOT NULL AND lower(dp.canonical_name) = lower(v.dest)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_cities x
  WHERE x.country_id = c.id AND lower(x.name) = lower(v.city)
);


-- =============================================================================
-- 3. Hotel entities (+ details). Match Atlas sheet names where they exist.
-- =============================================================================


INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, destination_profile_id,
  contract_status, client_ready, external_ids, active
)
SELECT
  'hotel',
  'Waldorf Astoria Maldives',
  'Waldorf Astoria',
  'kb_verified',
  'kb',
  src.id,
  'Traveller Made — full partner directory',
  co.region_id,
  co.id,
  ci.id,
  ci.destination_profile_id,
  'contracted',
  true,
  jsonb_build_object(
    'atlas_sheet_key', 'waldorf-astoria-maldives',
    'aliases', '["Waldorf Astoria Maldives", "Ithaafushi"]'::jsonb
  ),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id AND (lower(ci.name) = lower('South Malé Atoll, Ithaafushi'))
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'MV'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel'
      AND lower(e.name) = lower('Waldorf Astoria Maldives')
      AND e.active = true
  );
-- If city mismatch left no row, insert against first matching country city fallback
INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, contract_status, client_ready, external_ids, active
)
SELECT
  'hotel', 'Waldorf Astoria Maldives', 'Waldorf Astoria', 'kb_verified', 'kb',
  src.id, 'Traveller Made — full partner directory', co.region_id, co.id, ci.id,
  'contracted', true,
  jsonb_build_object('atlas_sheet_key', 'waldorf-astoria-maldives'),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'MV'
  AND lower(ci.name) = lower('South Malé Atoll, Ithaafushi')
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('Waldorf Astoria Maldives') AND e.active
  );

INSERT INTO public.kb_hotel_details (entity_id, amenities, style_tags, price_tier)
SELECT e.id, ARRAY[]::text[], '{overwater,family,ultra_luxury}'::text[], 'ultra_luxury'
FROM public.kb_entities e
WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('Waldorf Astoria Maldives')
  AND NOT EXISTS (SELECT 1 FROM public.kb_hotel_details d WHERE d.entity_id = e.id);

UPDATE public.kb_entities e
SET contract_status = 'contracted',
    client_ready = true,
    updated_at = now()
WHERE e.entity_type = 'hotel'
  AND lower(e.name) = lower('Waldorf Astoria Maldives');


INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, destination_profile_id,
  contract_status, client_ready, external_ids, active
)
SELECT
  'hotel',
  'SUJÁN Jawai',
  'SUJÁN',
  'kb_verified',
  'kb',
  src.id,
  'SUJÁN contract rate letter',
  co.region_id,
  co.id,
  ci.id,
  ci.destination_profile_id,
  'contracted',
  true,
  jsonb_build_object(
    'atlas_sheet_key', 'suj-n-jawai',
    'aliases', '["SUJAN Jawai", "Jawai"]'::jsonb
  ),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id AND (lower(ci.name) = lower('Jawai'))
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'IN'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel'
      AND lower(e.name) = lower('SUJÁN Jawai')
      AND e.active = true
  );
-- If city mismatch left no row, insert against first matching country city fallback
INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, contract_status, client_ready, external_ids, active
)
SELECT
  'hotel', 'SUJÁN Jawai', 'SUJÁN', 'kb_verified', 'kb',
  src.id, 'SUJÁN contract rate letter', co.region_id, co.id, ci.id,
  'contracted', true,
  jsonb_build_object('atlas_sheet_key', 'suj-n-jawai'),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'IN'
  AND lower(ci.name) = lower('Jawai')
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('SUJÁN Jawai') AND e.active
  );

INSERT INTO public.kb_hotel_details (entity_id, amenities, style_tags, price_tier)
SELECT e.id, ARRAY[]::text[], '{safari,tented,wildlife}'::text[], 'ultra_luxury'
FROM public.kb_entities e
WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('SUJÁN Jawai')
  AND NOT EXISTS (SELECT 1 FROM public.kb_hotel_details d WHERE d.entity_id = e.id);

UPDATE public.kb_entities e
SET contract_status = 'contracted',
    client_ready = true,
    updated_at = now()
WHERE e.entity_type = 'hotel'
  AND lower(e.name) = lower('SUJÁN Jawai');


INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, destination_profile_id,
  contract_status, client_ready, external_ids, active
)
SELECT
  'hotel',
  'SUJÁN The Serai',
  'SUJÁN',
  'kb_verified',
  'kb',
  src.id,
  'SUJÁN contract rate letter',
  co.region_id,
  co.id,
  ci.id,
  ci.destination_profile_id,
  'contracted',
  true,
  jsonb_build_object(
    'atlas_sheet_key', 'suj-n-the-serai',
    'aliases', '["SUJAN The Serai", "The Serai"]'::jsonb
  ),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id AND (lower(ci.name) = lower('Jaisalmer'))
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'IN'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel'
      AND lower(e.name) = lower('SUJÁN The Serai')
      AND e.active = true
  );
-- If city mismatch left no row, insert against first matching country city fallback
INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, contract_status, client_ready, external_ids, active
)
SELECT
  'hotel', 'SUJÁN The Serai', 'SUJÁN', 'kb_verified', 'kb',
  src.id, 'SUJÁN contract rate letter', co.region_id, co.id, ci.id,
  'contracted', true,
  jsonb_build_object('atlas_sheet_key', 'suj-n-the-serai'),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'IN'
  AND lower(ci.name) = lower('Jaisalmer')
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('SUJÁN The Serai') AND e.active
  );

INSERT INTO public.kb_hotel_details (entity_id, amenities, style_tags, price_tier)
SELECT e.id, ARRAY[]::text[], '{desert,tented,rajasthan}'::text[], 'ultra_luxury'
FROM public.kb_entities e
WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('SUJÁN The Serai')
  AND NOT EXISTS (SELECT 1 FROM public.kb_hotel_details d WHERE d.entity_id = e.id);

UPDATE public.kb_entities e
SET contract_status = 'contracted',
    client_ready = true,
    updated_at = now()
WHERE e.entity_type = 'hotel'
  AND lower(e.name) = lower('SUJÁN The Serai');


INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, destination_profile_id,
  contract_status, client_ready, external_ids, active
)
SELECT
  'hotel',
  'SUJÁN Sher Bagh',
  'SUJÁN',
  'kb_verified',
  'kb',
  src.id,
  'SUJÁN contract rate letter',
  co.region_id,
  co.id,
  ci.id,
  ci.destination_profile_id,
  'contracted',
  true,
  jsonb_build_object(
    'atlas_sheet_key', 'suj-n-sher-bagh',
    'aliases', '["SUJAN Sher Bagh", "Sher Bagh"]'::jsonb
  ),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id AND (lower(ci.name) = lower('Ranthambhore'))
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'IN'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel'
      AND lower(e.name) = lower('SUJÁN Sher Bagh')
      AND e.active = true
  );
-- If city mismatch left no row, insert against first matching country city fallback
INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, contract_status, client_ready, external_ids, active
)
SELECT
  'hotel', 'SUJÁN Sher Bagh', 'SUJÁN', 'kb_verified', 'kb',
  src.id, 'SUJÁN contract rate letter', co.region_id, co.id, ci.id,
  'contracted', true,
  jsonb_build_object('atlas_sheet_key', 'suj-n-sher-bagh'),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'IN'
  AND lower(ci.name) = lower('Ranthambhore')
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('SUJÁN Sher Bagh') AND e.active
  );

INSERT INTO public.kb_hotel_details (entity_id, amenities, style_tags, price_tier)
SELECT e.id, ARRAY[]::text[], '{safari,tiger,tented}'::text[], 'ultra_luxury'
FROM public.kb_entities e
WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('SUJÁN Sher Bagh')
  AND NOT EXISTS (SELECT 1 FROM public.kb_hotel_details d WHERE d.entity_id = e.id);

UPDATE public.kb_entities e
SET contract_status = 'contracted',
    client_ready = true,
    updated_at = now()
WHERE e.entity_type = 'hotel'
  AND lower(e.name) = lower('SUJÁN Sher Bagh');


INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, destination_profile_id,
  contract_status, client_ready, external_ids, active
)
SELECT
  'hotel',
  'COMO Cocoa Island',
  'COMO',
  'kb_verified',
  'kb',
  src.id,
  'COMO Cocoa Island Escape package PDF',
  co.region_id,
  co.id,
  ci.id,
  ci.destination_profile_id,
  'contracted',
  true,
  jsonb_build_object(
    'atlas_sheet_key', 'como-cocoa-island',
    'aliases', '["Cocoa Island", "COMO Cocoa"]'::jsonb
  ),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id AND (lower(ci.name) = lower('South Malé Atoll'))
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'MV'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel'
      AND lower(e.name) = lower('COMO Cocoa Island')
      AND e.active = true
  );
-- If city mismatch left no row, insert against first matching country city fallback
INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, contract_status, client_ready, external_ids, active
)
SELECT
  'hotel', 'COMO Cocoa Island', 'COMO', 'kb_verified', 'kb',
  src.id, 'COMO Cocoa Island Escape package PDF', co.region_id, co.id, ci.id,
  'contracted', true,
  jsonb_build_object('atlas_sheet_key', 'como-cocoa-island'),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'MV'
  AND lower(ci.name) = lower('South Malé Atoll')
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('COMO Cocoa Island') AND e.active
  );

INSERT INTO public.kb_hotel_details (entity_id, amenities, style_tags, price_tier)
SELECT e.id, ARRAY[]::text[], '{overwater,wellness,intimate}'::text[], 'luxury'
FROM public.kb_entities e
WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('COMO Cocoa Island')
  AND NOT EXISTS (SELECT 1 FROM public.kb_hotel_details d WHERE d.entity_id = e.id);

UPDATE public.kb_entities e
SET contract_status = 'contracted',
    client_ready = true,
    updated_at = now()
WHERE e.entity_type = 'hotel'
  AND lower(e.name) = lower('COMO Cocoa Island');


INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, destination_profile_id,
  contract_status, client_ready, external_ids, active
)
SELECT
  'hotel',
  'COMO Maalifushi',
  'COMO',
  'kb_verified',
  'kb',
  src.id,
  'Traveller Made — full partner directory',
  co.region_id,
  co.id,
  ci.id,
  ci.destination_profile_id,
  'contracted',
  true,
  jsonb_build_object(
    'atlas_sheet_key', 'como-maalifushi',
    'aliases', '["Maalifushi", "COMO Maalefushi"]'::jsonb
  ),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id AND (lower(ci.name) = lower('Maalefushi') OR lower(ci.name) = lower('Thaa Atoll, Maalefushi'))
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'MV'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel'
      AND lower(e.name) = lower('COMO Maalifushi')
      AND e.active = true
  );
-- If city mismatch left no row, insert against first matching country city fallback
INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, contract_status, client_ready, external_ids, active
)
SELECT
  'hotel', 'COMO Maalifushi', 'COMO', 'kb_verified', 'kb',
  src.id, 'Traveller Made — full partner directory', co.region_id, co.id, ci.id,
  'contracted', true,
  jsonb_build_object('atlas_sheet_key', 'como-maalifushi'),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'MV'
  AND lower(ci.name) = lower('Maalefushi')
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('COMO Maalifushi') AND e.active
  );

INSERT INTO public.kb_hotel_details (entity_id, amenities, style_tags, price_tier)
SELECT e.id, ARRAY[]::text[], '{overwater,family,wellness}'::text[], 'luxury'
FROM public.kb_entities e
WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('COMO Maalifushi')
  AND NOT EXISTS (SELECT 1 FROM public.kb_hotel_details d WHERE d.entity_id = e.id);

UPDATE public.kb_entities e
SET contract_status = 'contracted',
    client_ready = true,
    updated_at = now()
WHERE e.entity_type = 'hotel'
  AND lower(e.name) = lower('COMO Maalifushi');


INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, destination_profile_id,
  contract_status, client_ready, external_ids, active
)
SELECT
  'hotel',
  'Joali Maldives',
  'JOALI',
  'kb_verified',
  'kb',
  src.id,
  'Traveller Made — full partner directory',
  co.region_id,
  co.id,
  ci.id,
  ci.destination_profile_id,
  'contracted',
  true,
  jsonb_build_object(
    'atlas_sheet_key', 'joali-maldives',
    'aliases', '["JOALI", "Joali Maldives"]'::jsonb
  ),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id AND (lower(ci.name) = lower('Raa Atoll'))
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'MV'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel'
      AND lower(e.name) = lower('Joali Maldives')
      AND e.active = true
  );
-- If city mismatch left no row, insert against first matching country city fallback
INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, contract_status, client_ready, external_ids, active
)
SELECT
  'hotel', 'Joali Maldives', 'JOALI', 'kb_verified', 'kb',
  src.id, 'Traveller Made — full partner directory', co.region_id, co.id, ci.id,
  'contracted', true,
  jsonb_build_object('atlas_sheet_key', 'joali-maldives'),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'MV'
  AND lower(ci.name) = lower('Raa Atoll')
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('Joali Maldives') AND e.active
  );

INSERT INTO public.kb_hotel_details (entity_id, amenities, style_tags, price_tier)
SELECT e.id, ARRAY[]::text[], '{art,overwater,ultra_luxury}'::text[], 'ultra_luxury'
FROM public.kb_entities e
WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('Joali Maldives')
  AND NOT EXISTS (SELECT 1 FROM public.kb_hotel_details d WHERE d.entity_id = e.id);

UPDATE public.kb_entities e
SET contract_status = 'contracted',
    client_ready = true,
    updated_at = now()
WHERE e.entity_type = 'hotel'
  AND lower(e.name) = lower('Joali Maldives');


INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, destination_profile_id,
  contract_status, client_ready, external_ids, active
)
SELECT
  'hotel',
  'JOALI BEING',
  'JOALI',
  'kb_verified',
  'kb',
  src.id,
  'JOALI BEING Well-Living Journey PDF',
  co.region_id,
  co.id,
  ci.id,
  ci.destination_profile_id,
  'contracted',
  true,
  jsonb_build_object(
    'atlas_sheet_key', 'joali-being',
    'aliases', '["Joali Being", "JOALI Being"]'::jsonb
  ),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id AND (lower(ci.name) = lower('Bodufushi Island, Raa Atoll'))
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'MV'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel'
      AND lower(e.name) = lower('JOALI BEING')
      AND e.active = true
  );
-- If city mismatch left no row, insert against first matching country city fallback
INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, contract_status, client_ready, external_ids, active
)
SELECT
  'hotel', 'JOALI BEING', 'JOALI', 'kb_verified', 'kb',
  src.id, 'JOALI BEING Well-Living Journey PDF', co.region_id, co.id, ci.id,
  'contracted', true,
  jsonb_build_object('atlas_sheet_key', 'joali-being'),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'MV'
  AND lower(ci.name) = lower('Bodufushi Island, Raa Atoll')
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('JOALI BEING') AND e.active
  );

INSERT INTO public.kb_hotel_details (entity_id, amenities, style_tags, price_tier)
SELECT e.id, ARRAY[]::text[], '{wellness,overwater,ultra_luxury}'::text[], 'ultra_luxury'
FROM public.kb_entities e
WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('JOALI BEING')
  AND NOT EXISTS (SELECT 1 FROM public.kb_hotel_details d WHERE d.entity_id = e.id);

UPDATE public.kb_entities e
SET contract_status = 'contracted',
    client_ready = true,
    updated_at = now()
WHERE e.entity_type = 'hotel'
  AND lower(e.name) = lower('JOALI BEING');


INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, destination_profile_id,
  contract_status, client_ready, external_ids, active
)
SELECT
  'hotel',
  'Six Senses Kanuhura',
  'Six Senses',
  'kb_verified',
  'kb',
  src.id,
  'IHG Destined Lookbook',
  co.region_id,
  co.id,
  ci.id,
  ci.destination_profile_id,
  'contracted',
  true,
  jsonb_build_object(
    'atlas_sheet_key', 'six-senses-kanuhura',
    'aliases', '["Kanuhura"]'::jsonb
  ),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id AND (lower(ci.name) = lower('Kanuhura Island, Lhaviyani Atoll') OR lower(ci.name) = lower('Maldives'))
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'MV'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel'
      AND lower(e.name) = lower('Six Senses Kanuhura')
      AND e.active = true
  );
-- If city mismatch left no row, insert against first matching country city fallback
INSERT INTO public.kb_entities (
  entity_type, name, brand, kb_tier, provenance, source_id, source_name,
  region_id, country_id, city_id, contract_status, client_ready, external_ids, active
)
SELECT
  'hotel', 'Six Senses Kanuhura', 'Six Senses', 'kb_verified', 'kb',
  src.id, 'IHG Destined Lookbook', co.region_id, co.id, ci.id,
  'contracted', true,
  jsonb_build_object('atlas_sheet_key', 'six-senses-kanuhura'),
  true
FROM public.kb_countries co
JOIN public.kb_cities ci ON ci.country_id = co.id
JOIN public.kb_sources src ON lower(src.name) = 'contracted rates pilot + atlas sheet'
WHERE co.country_code = 'MV'
  AND lower(ci.name) = lower('Kanuhura Island, Lhaviyani Atoll')
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities e
    WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('Six Senses Kanuhura') AND e.active
  );

INSERT INTO public.kb_hotel_details (entity_id, amenities, style_tags, price_tier)
SELECT e.id, ARRAY[]::text[], '{wellness,family,beach}'::text[], 'luxury'
FROM public.kb_entities e
WHERE e.entity_type = 'hotel' AND lower(e.name) = lower('Six Senses Kanuhura')
  AND NOT EXISTS (SELECT 1 FROM public.kb_hotel_details d WHERE d.entity_id = e.id);

UPDATE public.kb_entities e
SET contract_status = 'contracted',
    client_ready = true,
    updated_at = now()
WHERE e.entity_type = 'hotel'
  AND lower(e.name) = lower('Six Senses Kanuhura');


-- =============================================================================
-- 4. Room categories from contracted rate grids (content only — no money)
-- =============================================================================

INSERT INTO public.kb_hotel_room_categories (entity_id, name, sort_order, active)
SELECT e.id, v.room, v.sort_order, true
FROM public.kb_entities e
JOIN (
  VALUES
    -- Waldorf Astoria Maldives
    ('Waldorf Astoria Maldives', 'Reef Villa with Pool', 10),
    ('Waldorf Astoria Maldives', 'Beach Villa with Pool', 20),
    ('Waldorf Astoria Maldives', 'Overwater Villa with Pool', 30),
    ('Waldorf Astoria Maldives', 'Grand Reef Villa with Pool', 40),
    ('Waldorf Astoria Maldives', 'Grand Beach Villa with Pool', 50),
    ('Waldorf Astoria Maldives', 'Grand Overwater Villa with Pool', 60),
    ('Waldorf Astoria Maldives', 'Two Bedroom Reef Villa with Pool', 70),
    ('Waldorf Astoria Maldives', 'Two Bedroom Beach Villa with Pool', 80),
    ('Waldorf Astoria Maldives', 'Two Bedroom Overwater Villa with Pool', 90),
    ('Waldorf Astoria Maldives', 'Two Bedroom Grand Beach Villa with Pool', 100),
    ('Waldorf Astoria Maldives', 'Three Bedroom Grand Beach Villa with Pool', 110),
    ('Waldorf Astoria Maldives', 'Three Bedroom Overwater Villa with Pool', 120),
    -- SUJÁN
    ('SUJÁN Jawai', 'The Tented Rock Suite', 10),
    ('SUJÁN Jawai', 'The Family Felidae Suite (two bedroom)', 20),
    ('SUJÁN Jawai', 'The Royal Panthera Suite', 30),
    ('SUJÁN Jawai', 'Eden at Jawai Private Camp', 40),
    ('SUJÁN The Serai', 'Luxury Tent', 10),
    ('SUJÁN The Serai', 'Luxury Tented Suite', 20),
    ('SUJÁN The Serai', 'Royal Tented Suite', 30),
    ('SUJÁN Sher Bagh', 'Tented Jungle Suite', 10),
    ('SUJÁN Sher Bagh', 'The Family Machhli Suite (two bedroom)', 20),
    ('SUJÁN Sher Bagh', 'The Royal Sher Suite', 30),
    ('SUJÁN Sher Bagh', 'The Imperial Raj Bagh Suite', 40),
    -- COMO Cocoa
    ('COMO Cocoa Island', 'Dhoni Water Villa', 10),
    ('COMO Cocoa Island', 'Dhoni Loft Water Villa', 20),
    ('COMO Cocoa Island', 'Loft Water Villa', 30),
    ('COMO Cocoa Island', 'One Bedroom Water Villa with Pool', 40),
    -- COMO Maalifushi
    ('COMO Maalifushi', 'Beach Suite', 10),
    ('COMO Maalifushi', 'Water Suite', 20),
    ('COMO Maalifushi', 'Beach Villa', 30),
    ('COMO Maalifushi', 'Water Villa', 40),
    -- JOALI Maldives
    ('Joali Maldives', 'Water Villa with Pool', 10),
    ('Joali Maldives', 'Luxury Water Villa with Pool', 20),
    ('Joali Maldives', 'Luxury Sunset Water Villa with Pool', 30),
    ('Joali Maldives', 'Beach Villa with Pool', 40),
    ('Joali Maldives', 'Luxury Beach Villa with Pool', 50),
    ('Joali Maldives', 'Two Bedroom Water Villa with Pool', 60),
    ('Joali Maldives', 'Two Bedroom Beach Villa with Pool', 70),
    -- JOALI BEING
    ('JOALI BEING', 'Ocean Pool Villa', 10),
    ('JOALI BEING', 'Sunset Ocean Pool Villa', 20),
    ('JOALI BEING', 'Grand Ocean Pool Villa', 30),
    ('JOALI BEING', 'Sunset Grand Ocean Pool Villa', 40),
    ('JOALI BEING', 'Beach Pool Villa', 50),
    ('JOALI BEING', 'Grand Beach Pool Villa', 60),
    ('JOALI BEING', 'Two Bedroom Ocean Pool Villa', 70),
    ('JOALI BEING', 'Two Bedroom Beach Pool Villa', 80)
) AS v(hotel, room, sort_order)
  ON lower(e.name) = lower(v.hotel)
WHERE e.entity_type = 'hotel'
  AND e.active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_hotel_room_categories r
    WHERE r.entity_id = e.id AND lower(r.name) = lower(v.room)
  );

-- =============================================================================
-- 5. Link Atlas ↔ Rate Layer properties (when properties seed has been run)
-- =============================================================================

UPDATE public.properties p
SET curated_hotel_id = e.id,
    updated_at = now()
FROM public.kb_entities e
WHERE e.entity_type = 'hotel'
  AND e.active = true
  AND (
    lower(p.name) = lower(e.name)
    OR (lower(p.name) = 'waldorf astoria maldives ithaafushi' AND lower(e.name) = 'waldorf astoria maldives')
    OR (lower(p.name) = 'joali maldives' AND lower(e.name) = 'joali maldives')
  )
  AND (p.curated_hotel_id IS DISTINCT FROM e.id);

UPDATE public.kb_entities e
SET property_id = p.id,
    contract_status = 'contracted',
    client_ready = true,
    updated_at = now()
FROM public.properties p
WHERE e.entity_type = 'hotel'
  AND e.active = true
  AND p.curated_hotel_id = e.id
  AND (
    e.property_id IS DISTINCT FROM p.id
    OR e.contract_status IS DISTINCT FROM 'contracted'
  );
