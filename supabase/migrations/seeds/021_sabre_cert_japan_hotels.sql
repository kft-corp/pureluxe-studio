-- Sabre CERT smoke hotels (Japan) → properties + property_supplier_codes + Atlas KB.
-- NOT a migration — supabase db push ignores this folder.
--
-- Purpose (Stage 0): map real CERT HotelCodes so Rate Layer / Trip Builder can
-- shop gds_public by saved code. These are hotels that returned on Sabre CERT
-- GetHotelAvail (geo + shop-by-code) — not the luxury guide shortlist from 019.
--
-- Verified CERT shop window (most rows): 2026-12-18 → 2026-12-20
-- Kyoto Imperial Hotel (100022896) shopped empty on that window; OK on 2027-04-16 → 2027-04-18.
--
-- Depends on:
--   migrations/011_rate_layer.sql (+ external_key / preferred_partner)
--   migrations/016_atlas_kb.sql (+ Wave 0–3 / hotel details columns as used by 018)
--   kb_countries JP + kb_cities Tokyo / Kyoto / Osaka (016 / 018)
-- Safe to re-run: WHERE NOT EXISTS / natural-key guards.
--
-- Hotels (CERT):
--   Tokyo  Hilton Tokyo                 100162196
--   Tokyo  Intercontinental Tokyo Bay   100034130
--   Tokyo  The Westin Tokyo             100074180
--   Kyoto  The Westin Miyako, Kyoto     100062618
--   Kyoto  Kyoto Imperial Hotel         100022896
--   Osaka  The Westin Osaka             100068668
--   Osaka  Hilton Osaka                 100019302
--   Osaka  The Ritz-Carlton Osaka       100050310

-- =============================================================================
-- 0. Destination profiles
-- =============================================================================

INSERT INTO public.destination_profiles (canonical_name, aliases, destination_type, notes)
SELECT v.canonical_name, v.aliases::jsonb, v.destination_type, v.notes
FROM (
  VALUES
    ('Tokyo', '["TYO","tokyo"]', 'city_countryside', 'Sabre CERT smoke seed'),
    ('Kyoto', '["kyoto"]', 'city_countryside', 'Sabre CERT smoke seed'),
    ('Osaka', '["KIX","ITM","osaka"]', 'city_countryside', 'Sabre CERT smoke seed'),
    ('Japan', '["JP","japan"]', 'city_countryside', 'Japan country profile for routing')
) AS v(canonical_name, aliases, destination_type, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.destination_profiles p
  WHERE lower(p.canonical_name) = lower(v.canonical_name)
);

-- =============================================================================
-- 1. Rate Layer properties
-- =============================================================================

INSERT INTO public.properties (
  name, brand, chain, destination, city, country, region,
  property_type, destination_profile_id, default_currency,
  min_markup_percent, contracting_entity_name, aliases,
  external_key, preferred_partner, booking_notes, active
)
SELECT
  v.name,
  NULLIF(v.brand, ''),
  NULLIF(v.chain, ''),
  v.city,
  v.city,
  'Japan',
  'Asia',
  'hotel',
  dp.id,
  'JPY',
  25,
  'KFT Corporation',
  COALESCE(string_to_array(NULLIF(v.aliases, ''), '|'), '{}'::text[]),
  v.external_key,
  true,
  'Sabre CERT smoke — live GDS codes in property_supplier_codes; contracted seasons optional.',
  true
FROM (
  VALUES
    -- Tokyo
    ('Hilton Tokyo', 'Hilton', 'Hilton', 'Tokyo', 'hilton-tokyo', 'Hilton Tokyo'),
    ('Intercontinental Tokyo Bay', 'InterContinental', 'IHG', 'Tokyo', 'intercontinental-tokyo-bay', 'Intercontinental Tokyo Bay|InterContinental Tokyo Bay'),
    ('The Westin Tokyo', 'Westin', 'Marriott', 'Tokyo', 'westin-tokyo', 'The Westin Tokyo|Westin Tokyo'),
    -- Kyoto
    ('The Westin Miyako, Kyoto', 'Westin', 'Marriott', 'Kyoto', 'westin-miyako-kyoto', 'The Westin Miyako, Kyoto|Westin Miyako Kyoto'),
    ('Kyoto Imperial Hotel', 'Imperial', '', 'Kyoto', 'kyoto-imperial-hotel', 'Kyoto Imperial Hotel|Imperial Hotel Kyoto'),
    -- Osaka
    ('The Westin Osaka', 'Westin', 'Marriott', 'Osaka', 'westin-osaka', 'The Westin Osaka|Westin Osaka'),
    ('Hilton Osaka', 'Hilton', 'Hilton', 'Osaka', 'hilton-osaka', 'Hilton Osaka'),
    ('The Ritz-Carlton Osaka', 'Ritz-Carlton', 'Marriott', 'Osaka', 'ritz-carlton-osaka', 'The Ritz-Carlton Osaka|Ritz-Carlton Osaka|The Ritz-carlton Osaka')
) AS v(name, brand, chain, city, external_key, aliases)
JOIN public.destination_profiles dp ON lower(dp.canonical_name) = lower(v.city)
WHERE NOT EXISTS (
  SELECT 1 FROM public.properties x
  WHERE lower(x.external_key) = lower(v.external_key)
     OR lower(x.name) = lower(v.name)
);

-- =============================================================================
-- 2. Sabre hotel codes (real CERT HotelCode — do not invent)
-- =============================================================================

INSERT INTO public.property_supplier_codes (
  property_id, supplier_key, supplier_property_code, meta, active
)
SELECT
  p.id,
  'sabre',
  v.sabre_code,
  jsonb_build_object(
    'code_context', 'GLOBAL',
    'sabre_cert_verified', true,
    'sabre_hotel_name', v.sabre_name,
    'verified_check_in', v.verified_check_in,
    'verified_check_out', v.verified_check_out
  ),
  true
FROM (
  VALUES
    ('hilton-tokyo',               '100162196', 'Hilton Tokyo',                 '2026-12-18', '2026-12-20'),
    ('intercontinental-tokyo-bay', '100034130', 'Intercontinental Tokyo Bay',   '2026-12-18', '2026-12-20'),
    ('westin-tokyo',               '100074180', 'The Westin Tokyo',             '2026-12-18', '2026-12-20'),
    ('westin-miyako-kyoto',        '100062618', 'The Westin Miyako, Kyoto',     '2026-12-18', '2026-12-20'),
    ('kyoto-imperial-hotel',       '100022896', 'Kyoto Imperial Hotel',         '2027-04-16', '2027-04-18'),
    ('westin-osaka',               '100068668', 'The Westin Osaka',             '2026-12-18', '2026-12-20'),
    ('hilton-osaka',               '100019302', 'Hilton Osaka',                 '2026-12-18', '2026-12-20'),
    ('ritz-carlton-osaka',         '100050310', 'The Ritz-carlton Osaka',       '2026-12-18', '2026-12-20')
) AS v(external_key, sabre_code, sabre_name, verified_check_in, verified_check_out)
JOIN public.properties p ON lower(p.external_key) = lower(v.external_key)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.property_supplier_codes c
  WHERE c.property_id = p.id
    AND c.supplier_key = 'sabre'
);

-- If row exists but code was empty/wrong, refresh active CERT mapping.
UPDATE public.property_supplier_codes c
SET
  supplier_property_code = v.sabre_code,
  meta = coalesce(c.meta, '{}'::jsonb) || jsonb_build_object(
    'code_context', 'GLOBAL',
    'sabre_cert_verified', true,
    'sabre_hotel_name', v.sabre_name,
    'verified_check_in', v.verified_check_in,
    'verified_check_out', v.verified_check_out
  ),
  active = true,
  updated_at = now()
FROM (
  VALUES
    ('hilton-tokyo',               '100162196', 'Hilton Tokyo',                 '2026-12-18', '2026-12-20'),
    ('intercontinental-tokyo-bay', '100034130', 'Intercontinental Tokyo Bay',   '2026-12-18', '2026-12-20'),
    ('westin-tokyo',               '100074180', 'The Westin Tokyo',             '2026-12-18', '2026-12-20'),
    ('westin-miyako-kyoto',        '100062618', 'The Westin Miyako, Kyoto',     '2026-12-18', '2026-12-20'),
    ('kyoto-imperial-hotel',       '100022896', 'Kyoto Imperial Hotel',         '2027-04-16', '2027-04-18'),
    ('westin-osaka',               '100068668', 'The Westin Osaka',             '2026-12-18', '2026-12-20'),
    ('hilton-osaka',               '100019302', 'Hilton Osaka',                 '2026-12-18', '2026-12-20'),
    ('ritz-carlton-osaka',         '100050310', 'The Ritz-carlton Osaka',       '2026-12-18', '2026-12-20')
) AS v(external_key, sabre_code, sabre_name, verified_check_in, verified_check_out)
JOIN public.properties p ON lower(p.external_key) = lower(v.external_key)
WHERE c.property_id = p.id
  AND c.supplier_key = 'sabre'
  AND (
    c.supplier_property_code IS DISTINCT FROM v.sabre_code
    OR c.active IS DISTINCT FROM true
  );

-- =============================================================================
-- 3. Atlas KB entities (hotel)
-- =============================================================================

INSERT INTO public.kb_entities (
  entity_type, name, brand, description, kb_tier, provenance,
  source_name, region_id, country_id, city_id,
  contract_status, client_ready, placeholder, not_yet_open,
  external_key, aliases, external_ids, legacy_notes, active
)
SELECT
  'hotel',
  v.name,
  NULLIF(v.brand, ''),
  v.description,
  'kb_scraped',
  'kb',
  'Sabre CERT smoke — PureLuxe Studio Stage 0',
  co.region_id,
  co.id,
  ci.id,
  'contracted',
  true,
  false,
  false,
  v.kb_external_key,
  COALESCE(string_to_array(NULLIF(v.aliases, ''), '|'), '{}'::text[]),
  jsonb_build_object(
    'sabre_cert_smoke', true,
    'sabre_hotel_id', v.sabre_code,
    'sabre_hotel_name', v.sabre_name,
    'guide_proposed_tier', v.tier
  ),
  v.legacy_notes,
  true
FROM (
  VALUES
    ('Hilton Tokyo', 'Hilton', 'Tokyo', 'Tier 2', 'hilton-tokyo', 'sabre-cert-hilton-tokyo', 'Hilton Tokyo', '100162196', 'Hilton Tokyo', 'CERT smoke hotel with Sabre code 100162196. Guide proposed Tier 2.', 'sabre_cert; city=Tokyo; code=100162196'),
    ('Intercontinental Tokyo Bay', 'InterContinental', 'Tokyo', 'Tier 2', 'intercontinental-tokyo-bay', 'sabre-cert-intercontinental-tokyo-bay', 'Intercontinental Tokyo Bay|InterContinental Tokyo Bay', '100034130', 'Intercontinental Tokyo Bay', 'CERT smoke hotel with Sabre code 100034130. Guide proposed Tier 2.', 'sabre_cert; city=Tokyo; code=100034130'),
    ('The Westin Tokyo', 'Westin', 'Tokyo', 'Tier 2', 'westin-tokyo', 'sabre-cert-westin-tokyo', 'The Westin Tokyo|Westin Tokyo', '100074180', 'The Westin Tokyo', 'CERT smoke hotel with Sabre code 100074180. Guide proposed Tier 2.', 'sabre_cert; city=Tokyo; code=100074180'),
    ('The Westin Miyako, Kyoto', 'Westin', 'Kyoto', 'Tier 2', 'westin-miyako-kyoto', 'sabre-cert-westin-miyako-kyoto', 'The Westin Miyako, Kyoto|Westin Miyako Kyoto', '100062618', 'The Westin Miyako, Kyoto', 'CERT smoke hotel with Sabre code 100062618. Guide proposed Tier 2.', 'sabre_cert; city=Kyoto; code=100062618'),
    ('Kyoto Imperial Hotel', 'Imperial', 'Kyoto', 'Tier 2', 'kyoto-imperial-hotel', 'sabre-cert-kyoto-imperial-hotel', 'Kyoto Imperial Hotel|Imperial Hotel Kyoto', '100022896', 'Kyoto Imperial Hotel', 'CERT smoke hotel with Sabre code 100022896. Prefer shop dates 2027-04-16→2027-04-18 on CERT.', 'sabre_cert; city=Kyoto; code=100022896'),
    ('The Westin Osaka', 'Westin', 'Osaka', 'Tier 2', 'westin-osaka', 'sabre-cert-westin-osaka', 'The Westin Osaka|Westin Osaka', '100068668', 'The Westin Osaka', 'CERT smoke hotel with Sabre code 100068668. Guide proposed Tier 2.', 'sabre_cert; city=Osaka; code=100068668'),
    ('Hilton Osaka', 'Hilton', 'Osaka', 'Tier 2', 'hilton-osaka', 'sabre-cert-hilton-osaka', 'Hilton Osaka', '100019302', 'Hilton Osaka', 'CERT smoke hotel with Sabre code 100019302. Guide proposed Tier 2.', 'sabre_cert; city=Osaka; code=100019302'),
    ('The Ritz-Carlton Osaka', 'Ritz-Carlton', 'Osaka', 'Tier 1', 'ritz-carlton-osaka', 'sabre-cert-ritz-carlton-osaka', 'The Ritz-Carlton Osaka|Ritz-Carlton Osaka|The Ritz-carlton Osaka', '100050310', 'The Ritz-carlton Osaka', 'CERT smoke hotel with Sabre code 100050310. Guide proposed Tier 1.', 'sabre_cert; city=Osaka; code=100050310')
) AS v(name, brand, city, tier, prop_key, kb_external_key, aliases, sabre_code, sabre_name, description, legacy_notes)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_cities ci ON ci.country_id = co.id AND lower(ci.name) = lower(v.city)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_entities e
  WHERE e.entity_type = 'hotel'
    AND e.active = true
    AND (
      e.external_key = v.kb_external_key
      OR (e.city_id = ci.id AND lower(e.name) = lower(v.name))
      OR (e.country_id = co.id AND lower(e.name) = lower(v.name))
    )
);

-- Keep sabre_hotel_id on existing matching KB rows (name / prop key).
UPDATE public.kb_entities e
SET
  external_ids = coalesce(e.external_ids, '{}'::jsonb) || jsonb_build_object(
    'sabre_cert_smoke', true,
    'sabre_hotel_id', v.sabre_code,
    'sabre_hotel_name', v.sabre_name
  ),
  contract_status = CASE
    WHEN e.contract_status IN ('unknown', 'not_yet_contracted') THEN 'contracted'
    ELSE e.contract_status
  END,
  client_ready = true,
  updated_at = now()
FROM (
  VALUES
    ('hilton-tokyo', 'sabre-cert-hilton-tokyo', 'Hilton Tokyo', '100162196', 'Hilton Tokyo'),
    ('intercontinental-tokyo-bay', 'sabre-cert-intercontinental-tokyo-bay', 'Intercontinental Tokyo Bay', '100034130', 'Intercontinental Tokyo Bay'),
    ('westin-tokyo', 'sabre-cert-westin-tokyo', 'The Westin Tokyo', '100074180', 'The Westin Tokyo'),
    ('westin-miyako-kyoto', 'sabre-cert-westin-miyako-kyoto', 'The Westin Miyako, Kyoto', '100062618', 'The Westin Miyako, Kyoto'),
    ('kyoto-imperial-hotel', 'sabre-cert-kyoto-imperial-hotel', 'Kyoto Imperial Hotel', '100022896', 'Kyoto Imperial Hotel'),
    ('westin-osaka', 'sabre-cert-westin-osaka', 'The Westin Osaka', '100068668', 'The Westin Osaka'),
    ('hilton-osaka', 'sabre-cert-hilton-osaka', 'Hilton Osaka', '100019302', 'Hilton Osaka'),
    ('ritz-carlton-osaka', 'sabre-cert-ritz-carlton-osaka', 'The Ritz-Carlton Osaka', '100050310', 'The Ritz-carlton Osaka')
) AS v(prop_key, kb_key, name, sabre_code, sabre_name)
WHERE e.entity_type = 'hotel'
  AND e.active = true
  AND (
    e.external_key IN (v.kb_key, v.prop_key)
    OR lower(e.name) = lower(v.name)
  );

-- =============================================================================
-- 4. kb_hotel_details (minimal Tier rows for suggest / coverage)
-- =============================================================================

INSERT INTO public.kb_hotel_details (
  entity_id, amenities, style_tags, luxury_band,
  guide_area, guide_partner, guide_score, best_for
)
SELECT
  e.id,
  '{}'::text[],
  ARRAY[lower(replace(v.tier, ' ', '_'))],
  v.tier,
  v.city,
  'Sabre CERT smoke',
  NULL,
  '{}'::text[]
FROM (
  VALUES
    ('Hilton Tokyo', 'Tokyo', 'Tier 2', 'sabre-cert-hilton-tokyo', 'hilton-tokyo'),
    ('Intercontinental Tokyo Bay', 'Tokyo', 'Tier 2', 'sabre-cert-intercontinental-tokyo-bay', 'intercontinental-tokyo-bay'),
    ('The Westin Tokyo', 'Tokyo', 'Tier 2', 'sabre-cert-westin-tokyo', 'westin-tokyo'),
    ('The Westin Miyako, Kyoto', 'Kyoto', 'Tier 2', 'sabre-cert-westin-miyako-kyoto', 'westin-miyako-kyoto'),
    ('Kyoto Imperial Hotel', 'Kyoto', 'Tier 2', 'sabre-cert-kyoto-imperial-hotel', 'kyoto-imperial-hotel'),
    ('The Westin Osaka', 'Osaka', 'Tier 2', 'sabre-cert-westin-osaka', 'westin-osaka'),
    ('Hilton Osaka', 'Osaka', 'Tier 2', 'sabre-cert-hilton-osaka', 'hilton-osaka'),
    ('The Ritz-Carlton Osaka', 'Osaka', 'Tier 1', 'sabre-cert-ritz-carlton-osaka', 'ritz-carlton-osaka')
) AS v(name, city, tier, kb_key, prop_key)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_cities ci ON ci.country_id = co.id AND lower(ci.name) = lower(v.city)
JOIN public.kb_entities e ON e.entity_type = 'hotel' AND e.active = true AND e.country_id = co.id
  AND (
    e.external_key IN (v.kb_key, v.prop_key)
    OR lower(e.name) = lower(v.name)
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_hotel_details d WHERE d.entity_id = e.id
);

-- =============================================================================
-- 5. Link KB ↔ properties (canonical money link)
-- =============================================================================

UPDATE public.kb_entities e
SET
  property_id = p.id,
  contract_status = 'contracted',
  updated_at = now()
FROM public.properties p
JOIN (
  VALUES
    ('hilton-tokyo', 'sabre-cert-hilton-tokyo', 'Hilton Tokyo'),
    ('intercontinental-tokyo-bay', 'sabre-cert-intercontinental-tokyo-bay', 'Intercontinental Tokyo Bay'),
    ('westin-tokyo', 'sabre-cert-westin-tokyo', 'The Westin Tokyo'),
    ('westin-miyako-kyoto', 'sabre-cert-westin-miyako-kyoto', 'The Westin Miyako, Kyoto'),
    ('kyoto-imperial-hotel', 'sabre-cert-kyoto-imperial-hotel', 'Kyoto Imperial Hotel'),
    ('westin-osaka', 'sabre-cert-westin-osaka', 'The Westin Osaka'),
    ('hilton-osaka', 'sabre-cert-hilton-osaka', 'Hilton Osaka'),
    ('ritz-carlton-osaka', 'sabre-cert-ritz-carlton-osaka', 'The Ritz-Carlton Osaka')
) AS m(prop_key, kb_key, name) ON lower(p.external_key) = lower(m.prop_key)
WHERE e.entity_type = 'hotel'
  AND e.active = true
  AND (
    e.external_key IN (m.kb_key, m.prop_key)
    OR lower(e.name) = lower(m.name)
  )
  AND (
    e.property_id IS DISTINCT FROM p.id
    OR e.contract_status IS DISTINCT FROM 'contracted'
  );
