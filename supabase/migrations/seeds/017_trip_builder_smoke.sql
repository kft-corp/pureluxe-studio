-- Trip Builder smoke extras (dev/test).
-- NOT a migration — supabase db push ignores this folder.
--
-- Fills gaps left by Excel seeds so hotel_find / place_get_notes / rates_search
-- / hotel detail work better for contracted pilots.
--
-- Depends on (run after):
--   seeds/011_rate_layer.sql
--   seeds/011_rate_layer_contracted.sql
--   seeds/011_rate_layer_kanuhura.sql
--   seeds/016_atlas_kb.sql
--   migrations through 029 (Wave 0–3 tables)
--
-- Safe to re-run: WHERE NOT EXISTS / ON CONFLICT / COALESCE updates.
-- Demo-only rows are labelled in notes — replace with founder Excel later.

-- =============================================================================
-- 1. Country facts — Maldives + India
-- =============================================================================

INSERT INTO public.kb_country_facts (
  country_id, currency_code, currency_notes, best_season, safety_notes,
  general_notes, kb_tier, provenance
)
SELECT
  c.id,
  'USD',
  'USD widely used at resorts; Rufiyaa for local islands.',
  'Dry season roughly Dec–Apr; shoulder May / Nov often good value.',
  'Resorts are private islands; transfers by speedboat or seaplane.',
  'Indian Ocean atoll resorts. Green tax is usually extra on contracted nets.',
  'kb_scraped',
  'kb'
FROM public.kb_countries c
WHERE lower(c.name) = 'maldives'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_country_facts f WHERE f.country_id = c.id
  );

INSERT INTO public.kb_country_facts (
  country_id, currency_code, currency_notes, best_season, safety_notes,
  general_notes, kb_tier, provenance
)
SELECT
  c.id,
  'INR',
  'INR on property; USD/EUR sometimes accepted at luxury camps.',
  'Safari camps: Oct–Apr cooler/dry; monsoon Jun–Sep quieter.',
  'Follow camp transfer and park rules; wildlife drives are guided.',
  'SUJÁN camps are tented luxury safari stays (Jawai / Jaisalmer / Ranthambhore).',
  'kb_scraped',
  'kb'
FROM public.kb_countries c
WHERE lower(c.name) = 'india'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_country_facts f WHERE f.country_id = c.id
  );

-- =============================================================================
-- 2. Visa — IN passport → Maldives / India (place_get_notes)
-- =============================================================================

INSERT INTO public.kb_country_visa_rules (
  country_id, passport_country_code, summary, details, entry_type,
  official_url, kb_tier, provenance, active
)
SELECT
  c.id,
  'IN',
  'Indian passports normally get a free visa on arrival for tourism (confirm current rules before travel).',
  'Typical stay up to 30 days; passport validity and return ticket usually required. Always re-check official sources before confirming to the client.',
  'visa_on_arrival',
  'https://immigration.gov.mv/',
  'kb_scraped',
  'kb',
  true
FROM public.kb_countries c
WHERE lower(c.name) = 'maldives'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_country_visa_rules v
    WHERE v.country_id = c.id AND v.passport_country_code = 'IN'
  );

INSERT INTO public.kb_country_visa_rules (
  country_id, passport_country_code, summary, details, entry_type,
  official_url, kb_tier, provenance, active
)
SELECT
  c.id,
  'IN',
  'Indian citizens travelling within India do not need a visa.',
  'Domestic travel only. For foreign passports into India, use a separate visa rule row.',
  'visa_free',
  'https://www.india.gov.in/',
  'kb_scraped',
  'kb',
  true
FROM public.kb_countries c
WHERE lower(c.name) = 'india'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_country_visa_rules v
    WHERE v.country_id = c.id AND v.passport_country_code = 'IN'
  );

-- =============================================================================
-- 3. Destination facts + audience notes (pilot cities)
-- =============================================================================

INSERT INTO public.kb_destination_facts (
  city_id, best_time_to_visit, ideal_length_of_stay, vibe, staff_notes,
  kb_tier, provenance
)
SELECT ci.id, v.best_time, v.length, v.vibe, v.staff, 'kb_scraped', 'kb'
FROM (VALUES
  ('Maldives', 'South Malé Atoll, Ithaafushi', 'Dec–Apr dry; May/Nov shoulder', '4–7 nights', 'Private-island ultra-luxury near Malé; speedboat access.', 'Waldorf Ithaafushi city row.'),
  ('Maldives', 'South Malé Atoll', 'Dec–Apr; shoulder value May/Nov', '4–6 nights', 'Quiet COMO wellness island; adults-oriented vibe.', 'COMO Cocoa city.'),
  ('Maldives', 'Raa Atoll', 'Dec–Apr dry season preferred', '5–7 nights', 'Design-forward JOALI; family-friendly with kids club.', NULL),
  ('Maldives', 'Bodufushi Island, Raa Atoll', 'Dry season for wellness focus', '5–7 nights', 'JOALI BEING — wellness / adults-oriented sister.', NULL),
  ('Maldives', 'Maalefushi', 'Dec–Apr; good year-round weather windows', '5–7 nights', 'COMO Maalifushi — family + overwater.', NULL),
  ('Maldives', 'Unspecified', 'Dec–Apr peak; shoulder for value', '5–7 nights', 'Kanuhura (Lhaviyani) often sits under Unspecified city in Atlas seed.', 'Fix city later if atoll row added.'),
  ('India', 'Jawai', 'Oct–Apr cooler safari season', '3–5 nights', 'Leopard country; SUJÁN Jawai tented camp.', NULL),
  ('India', 'Jaisalmer', 'Oct–Mar cooler desert nights', '2–4 nights', 'Desert dunes; SUJÁN The Serai.', NULL),
  ('India', 'Ranthambhore', 'Oct–Apr park season', '3–5 nights', 'Tiger reserve; SUJÁN Sher Bagh.', NULL)
) AS v(country, city, best_time, length, vibe, staff)
JOIN public.kb_countries co ON lower(co.name) = lower(v.country)
JOIN public.kb_cities ci ON ci.country_id = co.id AND lower(ci.name) = lower(v.city)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_destination_facts f WHERE f.city_id = ci.id
);

INSERT INTO public.kb_destination_audience_notes (
  city_id, trip_style, note, kb_tier, provenance, active
)
SELECT ci.id, v.style, v.note, 'kb_scraped', 'kb', true
FROM (VALUES
  ('Maldives', 'South Malé Atoll, Ithaafushi', 'honeymoon', 'Excellent honeymoon fit — private villas, quiet island, celebration amenities.'),
  ('Maldives', 'South Malé Atoll, Ithaafushi', 'family', 'Family-friendly villas with pools; confirm kids club / connecting options when quoting.'),
  ('Maldives', 'South Malé Atoll', 'honeymoon', 'Strong adults-oriented wellness honeymoon — quieter than big party islands.'),
  ('Maldives', 'Raa Atoll', 'family', 'JOALI is a strong design + family pick; ask ages for villa fit.'),
  ('Maldives', 'Raa Atoll', 'honeymoon', 'Romantic overwater / beach villas; great for design-led honeymoons.'),
  ('Maldives', 'Bodufushi Island, Raa Atoll', 'honeymoon', 'BEING suits wellness-led couples; less of a kids-club product.'),
  ('India', 'Jawai', 'honeymoon', 'Intimate safari camp — great for couples who want wildlife without a big lodge.'),
  ('India', 'Jawai', 'family', 'Works for older kids comfortable with drives; confirm age policy with camp.'),
  ('India', 'Ranthambhore', 'family', 'Classic tiger park — family safari staple when park is open.')
) AS v(country, city, style, note)
JOIN public.kb_countries co ON lower(co.name) = lower(v.country)
JOIN public.kb_cities ci ON ci.country_id = co.id AND lower(ci.name) = lower(v.city)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_destination_audience_notes n
  WHERE n.city_id = ci.id AND n.trip_style = v.style
);

-- =============================================================================
-- 4. Pilot entity aliases + short descriptions (hotel_find / shortlist)
-- =============================================================================

UPDATE public.kb_entities e
SET
  aliases = (
    SELECT ARRAY(
      SELECT DISTINCT a
      FROM unnest(
        coalesce(e.aliases, '{}'::text[]) || v.add_aliases
      ) AS a
      WHERE length(trim(a)) > 0
    )
  ),
  description = COALESCE(NULLIF(e.description, ''), v.description),
  updated_at = now()
FROM (VALUES
  ('waldorf-astoria-maldives',
   ARRAY['Ithaafushi', 'Waldorf Ithaafushi', 'Waldorf Astoria Maldives Ithaafushi']::text[],
   'Private-island Waldorf Astoria resort on Ithaafushi — overwater and beach villas with pools.'),
  ('six-senses-kanuhura',
   ARRAY['Kanuhura', 'Six Senses Maldives', 'SS Kanuhura']::text[],
   'Six Senses Kanuhura — Lhaviyani Atoll beach and water villas; family and wellness oriented.'),
  ('como-cocoa-island',
   ARRAY['Cocoa Island', 'CCI', 'COMO Cocoa']::text[],
   'Intimate COMO island in South Malé Atoll — wellness-forward, adults-oriented.'),
  ('como-maalifushi',
   ARRAY['Maalifushi', 'CMF', 'COMO Thaa']::text[],
   'COMO Maalifushi — Thaa Atoll family and overwater stay.'),
  ('joali-maldives',
   ARRAY['JOALI', 'Joali Raa', 'JOALI Maldives']::text[],
   'Design-led JOALI Maldives in Raa Atoll — strong for honeymoon and families.'),
  ('joali-being',
   ARRAY['Joali Being', 'BEING', 'JOALI wellness']::text[],
   'JOALI BEING — wellness sister resort on Bodufushi, Raa Atoll.'),
  ('suj-n-jawai',
   ARRAY['Sujan Jawai', 'Jawai camp', 'SUJAN Jawai']::text[],
   'SUJÁN Jawai — luxury tented leopard camp in Rajasthan.'),
  ('suj-n-the-serai',
   ARRAY['The Serai', 'Sujan Serai', 'SUJAN Serai']::text[],
   'SUJÁN The Serai — desert camp near Jaisalmer.'),
  ('suj-n-sher-bagh',
   ARRAY['Sher Bagh', 'Sujan Sher Bagh', 'Ranthambore camp']::text[],
   'SUJÁN Sher Bagh — tented camp at Ranthambhore.')
) AS v(external_key, add_aliases, description)
WHERE e.external_key = v.external_key
  AND e.entity_type = 'hotel'
  AND e.active = true;

-- Mirror useful aliases onto Rate Layer properties (search_properties).
UPDATE public.properties p
SET
  aliases = (
    SELECT ARRAY(
      SELECT DISTINCT a
      FROM unnest(coalesce(p.aliases, '{}'::text[]) || e.aliases) AS a
      WHERE length(trim(a)) > 0
    )
  ),
  updated_at = now()
FROM public.kb_entities e
WHERE e.property_id = p.id
  AND e.entity_type = 'hotel'
  AND e.active = true
  AND e.external_key IN (
    'waldorf-astoria-maldives',
    'six-senses-kanuhura',
    'como-cocoa-island',
    'como-maalifushi',
    'joali-maldives',
    'joali-being',
    'suj-n-jawai',
    'suj-n-the-serai',
    'suj-n-sher-bagh'
  );

-- =============================================================================
-- 5. Ensure luxury_band + style_tags on all contracted pilots
-- =============================================================================

INSERT INTO public.kb_hotel_details (
  entity_id, amenities, dining_notes, wellness_notes, style_tags, luxury_band
)
SELECT
  e.id,
  '{}'::text[],
  NULL,
  NULL,
  v.style_tags::text[],
  v.luxury_band
FROM (VALUES
  ('waldorf-astoria-maldives', '{"overwater","family","ultra_luxury"}', 'ultra_luxury'),
  ('six-senses-kanuhura', '{"overwater","family","wellness"}', 'ultra_luxury'),
  ('como-cocoa-island', '{"overwater","adults_oriented","wellness"}', 'ultra_luxury'),
  ('como-maalifushi', '{"overwater","family","wellness"}', 'ultra_luxury'),
  ('joali-maldives', '{"overwater","design","family"}', 'ultra_luxury'),
  ('joali-being', '{"wellness","adults_oriented","overwater"}', 'ultra_luxury'),
  ('suj-n-jawai', '{"safari","wildlife","tented"}', 'luxury'),
  ('suj-n-the-serai', '{"safari","desert","tented"}', 'luxury'),
  ('suj-n-sher-bagh', '{"safari","wildlife","tented"}', 'luxury')
) AS v(external_key, style_tags, luxury_band)
JOIN public.kb_entities e ON e.external_key = v.external_key AND e.entity_type = 'hotel'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_hotel_details d WHERE d.entity_id = e.id
);

UPDATE public.kb_hotel_details d
SET
  luxury_band = COALESCE(d.luxury_band, v.luxury_band),
  style_tags = CASE
    WHEN d.style_tags = '{}'::text[] THEN v.style_tags::text[]
    ELSE d.style_tags
  END,
  best_for = CASE
    WHEN d.best_for = '{}'::text[] THEN v.best_for::text[]
    ELSE d.best_for
  END,
  updated_at = now()
FROM (VALUES
  ('waldorf-astoria-maldives', 'ultra_luxury', '{"overwater","family","ultra_luxury"}', '{"honeymoon","family"}'),
  ('six-senses-kanuhura', 'ultra_luxury', '{"overwater","family","wellness"}', '{"family","honeymoon","wellness"}'),
  ('como-cocoa-island', 'ultra_luxury', '{"overwater","adults_oriented","wellness"}', '{"honeymoon","wellness"}'),
  ('como-maalifushi', 'ultra_luxury', '{"overwater","family","wellness"}', '{"family","honeymoon"}'),
  ('joali-maldives', 'ultra_luxury', '{"overwater","design","family"}', '{"honeymoon","family"}'),
  ('joali-being', 'ultra_luxury', '{"wellness","adults_oriented","overwater"}', '{"honeymoon","wellness"}'),
  ('suj-n-jawai', 'luxury', '{"safari","wildlife","tented"}', '{"honeymoon","safari"}'),
  ('suj-n-the-serai', 'luxury', '{"safari","desert","tented"}', '{"honeymoon","safari"}'),
  ('suj-n-sher-bagh', 'luxury', '{"safari","wildlife","tented"}', '{"family","safari"}')
) AS v(external_key, luxury_band, style_tags, best_for)
JOIN public.kb_entities e ON e.external_key = v.external_key AND e.entity_type = 'hotel'
WHERE d.entity_id = e.id;

-- =============================================================================
-- 6. Stay info (house rules) for pilots
-- =============================================================================

INSERT INTO public.kb_hotel_stay_info (
  entity_id, check_in_time, check_out_time, min_age, pets_allowed,
  smoking_policy, id_requirements, couple_policy, extra_rules, kb_tier
)
SELECT
  e.id,
  v.check_in,
  v.check_out,
  v.min_age,
  false,
  'Non-smoking villas; designated areas only where offered.',
  'Passport required at check-in for all guests.',
  v.couple,
  jsonb_build_object('seed', '017_trip_builder_smoke'),
  'kb_scraped'
FROM (VALUES
  ('waldorf-astoria-maldives', '14:00', '12:00', NULL::int, 'Married / documented couples policies follow Maldivian resort rules — confirm with reservations.'),
  ('six-senses-kanuhura', '14:00', '12:00', NULL, 'Confirm couple documentation requirements with resort before arrival.'),
  ('como-cocoa-island', '14:00', '12:00', 12, 'Adults-oriented; younger teens only when policy allows — confirm ages.'),
  ('como-maalifushi', '14:00', '12:00', NULL, 'Family-friendly; confirm couple documentation if relevant.'),
  ('joali-maldives', '14:00', '12:00', NULL, 'Confirm couple documentation with reservations.'),
  ('joali-being', '14:00', '12:00', 16, 'Wellness / adults-oriented — confirm minimum age.'),
  ('suj-n-jawai', '14:00', '11:00', NULL, NULL),
  ('suj-n-the-serai', '14:00', '11:00', NULL, NULL),
  ('suj-n-sher-bagh', '14:00', '11:00', NULL, NULL)
) AS v(external_key, check_in, check_out, min_age, couple)
JOIN public.kb_entities e ON e.external_key = v.external_key AND e.entity_type = 'hotel'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_hotel_stay_info s WHERE s.entity_id = e.id
);

-- =============================================================================
-- 7. Partner perks (Atlas VIP strip)
-- =============================================================================

INSERT INTO public.kb_hotel_partner_perks (entity_id, perk_key, label, notes, active)
SELECT e.id, v.perk_key, v.label, v.notes, true
FROM (VALUES
  ('waldorf-astoria-maldives', 'upgrade', 'Room upgrade when available', 'Preferred partner strip — confirm at booking.'),
  ('waldorf-astoria-maldives', 'breakfast', 'Daily breakfast for two', NULL),
  ('waldorf-astoria-maldives', 'resort_credit', 'USD 100 resort credit', 'Demo label for TB perk strip.'),
  ('six-senses-kanuhura', 'upgrade', 'Category upgrade when available', NULL),
  ('six-senses-kanuhura', 'breakfast', 'Daily breakfast included on contracted nets', 'Wholesale nets already include breakfast.'),
  ('como-cocoa-island', 'early_check_in', 'Early check-in when available', NULL),
  ('como-cocoa-island', 'late_checkout', 'Late check-out when available', NULL),
  ('joali-maldives', 'upgrade', 'Room upgrade when available', NULL),
  ('joali-maldives', 'resort_credit', 'Resort credit on select packages', 'Confirm package JOYJ26 inclusions.'),
  ('joali-being', 'breakfast', 'Breakfast included on Well-Living package', NULL),
  ('suj-n-jawai', 'other', 'Park / conservation contribution guidance on file', 'See contract addons.')
) AS v(external_key, perk_key, label, notes)
JOIN public.kb_entities e ON e.external_key = v.external_key AND e.entity_type = 'hotel'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_hotel_partner_perks p
  WHERE p.entity_id = e.id AND p.perk_key = v.perk_key AND p.label = v.label
);

-- =============================================================================
-- 8. Rate perks (commercial / search-time)
-- =============================================================================

INSERT INTO public.property_rate_perks (
  property_id, contract_id, perk_key, label, applies_to_all_rates, active
)
SELECT
  p.id,
  c.id,
  v.perk_key,
  v.label,
  true,
  true
FROM (VALUES
  ('waldorf-astoria-maldives', 'breakfast', 'Breakfast for two (contracted)'),
  ('waldorf-astoria-maldives', 'other', 'Green tax extra — not in villa net'),
  ('six-senses-kanuhura', 'breakfast', 'Breakfast included on wholesale nets'),
  ('como-cocoa-island', 'breakfast', 'Package board per contract sheet'),
  ('joali-maldives', 'resort_credit', 'Joyful Journey package value-adds'),
  ('joali-being', 'other', 'Well-Living Journey inclusions per WELE26')
) AS v(external_key, perk_key, label)
JOIN public.properties p ON p.external_key = v.external_key AND p.active = true
JOIN LATERAL (
  SELECT c.id
  FROM public.property_contracts c
  WHERE c.property_id = p.id AND c.active = true
  ORDER BY c.valid_from DESC NULLS LAST
  LIMIT 1
) c ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.property_rate_perks r
  WHERE r.property_id = p.id
    AND r.perk_key = v.perk_key
    AND r.label = v.label
);

-- =============================================================================
-- 9. Ops contacts (never client PDF by default)
-- =============================================================================

INSERT INTO public.kb_entity_contacts (
  entity_id, title, name, email, phone, role_tags, source, kb_tier, active
)
SELECT
  e.id,
  v.title,
  v.name,
  v.email,
  v.phone,
  v.roles::text[],
  '017_trip_builder_smoke',
  'kb_scraped',
  true
FROM (VALUES
  ('waldorf-astoria-maldives', 'Reservations', 'Waldorf Ithaafushi Reservations', 'reservations.maldives@waldorfastoria.com', NULL, '{"reservations"}'),
  ('six-senses-kanuhura', 'Reservations', 'Six Senses Kanuhura Reservations', 'reservations-maldives@sixsenses.com', '+960 662 0044', '{"reservations"}'),
  ('como-cocoa-island', 'Reservations', 'COMO Cocoa Island Reservations', 'res.cocoaisland@comohotels.com', NULL, '{"reservations"}'),
  ('joali-maldives', 'Sales', 'JOALI Maldives Sales', 'sales@joali.com', NULL, '{"sales","reservations"}'),
  ('suj-n-jawai', 'Reservations', 'SUJÁN Reservations', 'reservations@sujan.com', NULL, '{"reservations"}')
) AS v(external_key, title, name, email, phone, roles)
JOIN public.kb_entities e ON e.external_key = v.external_key AND e.entity_type = 'hotel'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_entity_contacts c
  WHERE c.entity_id = e.id
    AND c.email IS NOT DISTINCT FROM v.email
    AND c.active = true
);

-- =============================================================================
-- 10. Commission % on pilot contracts (Studio expected_commission)
-- =============================================================================

UPDATE public.property_contracts c
SET
  commission_percent = COALESCE(c.commission_percent, 10),
  updated_at = now()
FROM public.properties p
WHERE c.property_id = p.id
  AND p.external_key IN (
    'waldorf-astoria-maldives',
    'six-senses-kanuhura',
    'como-cocoa-island',
    'como-maalifushi',
    'joali-maldives',
    'joali-being',
    'suj-n-jawai',
    'suj-n-the-serai',
    'suj-n-sher-bagh'
  )
  AND c.active = true;

UPDATE public.properties p
SET
  default_commission = COALESCE(p.default_commission, 10),
  updated_at = now()
WHERE p.external_key IN (
  'waldorf-astoria-maldives',
  'six-senses-kanuhura',
  'como-cocoa-island',
  'como-maalifushi',
  'joali-maldives',
  'joali-being',
  'suj-n-jawai',
  'suj-n-the-serai',
  'suj-n-sher-bagh'
);

-- =============================================================================
-- 11. Waldorf DEMO rates — Nov–Dec 2026 smoke window (not the live PDF season)
-- =============================================================================

INSERT INTO public.property_contracts (
  property_id, name, contract_type, market,
  valid_from, valid_to, currency, booking_code,
  min_markup_percent, source_document_name, external_key,
  taxes_included, service_charge_pct, tax_pct, tax_on_service_charge, market_codes,
  commission_percent,
  policies, benefits, payout, notes, active
)
SELECT
  prop.id,
  'DEMO smoke window Nov–Dec 2026 — Waldorf Ithaafushi',
  'tactical',
  'worldwide',
  '2026-11-01',
  '2026-12-20',
  'USD',
  NULL,
  25,
  'DEMO ONLY — 017_trip_builder_smoke (not founder PDF)',
  'waldorf-demo-2026-11',
  true, 10, 17, true, ARRAY[]::text[],
  10,
  jsonb_build_object(
    'schema_version', 2,
    'stay', jsonb_build_array(
      jsonb_build_object(
        'text', 'Demo contracted window for Trip Builder smoke tests only. Replace with live season rates.',
        'audience', 'team'
      )
    ),
    'payment', jsonb_build_array(),
    'cancellation', jsonb_build_array(),
    'transfer', jsonb_build_array(),
    'legal', jsonb_build_array()
  ),
  '[]'::jsonb,
  '{}'::jsonb,
  'DEV/TEST only — enables rates_search for Nov–Dec 2026 without waiting for 2027 wholesale.',
  true
FROM public.properties prop
WHERE prop.external_key = 'waldorf-astoria-maldives'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracts c
    WHERE c.property_id = prop.id
      AND c.external_key = 'waldorf-demo-2026-11'
  );

INSERT INTO public.property_contracted_rates (
  property_id, contract_id, room_category, room_category_external_key,
  season_code, rate_basis,
  valid_from, valid_to, currency, cost_amount, cost_unit,
  base_adults, base_children,
  board, includes_breakfast, includes_lunch, includes_dinner,
  includes_transfer, includes_green_tax, min_nights,
  sort_order, inclusions, notes, active
)
SELECT
  c.property_id,
  c.id,
  v.room,
  v.room_key,
  'other',  -- CHECK allows peak|high|low|shoulder|other only (demo window labelled in notes)
  'nightly',
  '2026-11-01'::date,
  '2026-12-20'::date,
  'USD',
  v.amount,
  'per_night',
  2, 0,
  'breakfast',
  true, false, false,
  false, false, 3,
  v.sort,
  '["demo breakfast","green tax extra"]'::jsonb,
  'DEMO nightly net for TB smoke — not live PDF.',
  true
FROM public.property_contracts c
JOIN public.properties p ON p.id = c.property_id
CROSS JOIN (VALUES
  ('Reef Villa with Pool', 'reef-villa-pool', 2800, 10),
  ('Overwater Villa with Pool', 'overwater-villa-pool', 3100, 20),
  ('Beach Villa with Pool', 'beach-villa-pool', 3300, 30)
) AS v(room, room_key, amount, sort)
WHERE c.external_key = 'waldorf-demo-2026-11'
  AND p.external_key = 'waldorf-astoria-maldives'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracted_rates r
    WHERE r.contract_id = c.id
      AND r.room_category = v.room
      AND r.valid_from = '2026-11-01'::date
  );

-- Optional Atlas room keys for demo join (create if missing).
INSERT INTO public.kb_hotel_room_categories (
  entity_id, name, external_key, sort_order, active
)
SELECT e.id, v.name, v.external_key, v.sort, true
FROM (VALUES
  ('waldorf-astoria-maldives', 'Reef Villa with Pool', 'reef-villa-pool', 10),
  ('waldorf-astoria-maldives', 'Overwater Villa with Pool', 'overwater-villa-pool', 20),
  ('waldorf-astoria-maldives', 'Beach Villa with Pool', 'beach-villa-pool', 30)
) AS v(entity_key, name, external_key, sort)
JOIN public.kb_entities e ON e.external_key = v.entity_key AND e.entity_type = 'hotel'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_hotel_room_categories r
  WHERE r.entity_id = e.id
    AND (
      r.external_key = v.external_key
      OR lower(r.name) = lower(v.name)
    )
);

UPDATE public.kb_hotel_room_categories r
SET
  external_key = COALESCE(r.external_key, v.external_key),
  updated_at = now()
FROM (VALUES
  ('waldorf-astoria-maldives', 'Reef Villa with Pool', 'reef-villa-pool'),
  ('waldorf-astoria-maldives', 'Overwater Villa with Pool', 'overwater-villa-pool'),
  ('waldorf-astoria-maldives', 'Beach Villa with Pool', 'beach-villa-pool')
) AS v(entity_key, name, external_key)
JOIN public.kb_entities e ON e.external_key = v.entity_key AND e.entity_type = 'hotel'
WHERE r.entity_id = e.id
  AND lower(r.name) = lower(v.name);

-- =============================================================================
-- 12. Nearby POIs (quick TB “near airport?”)
-- =============================================================================

INSERT INTO public.kb_nearby_pois (
  entity_id, name, poi_type, distance_text, sort_order, active
)
SELECT e.id, v.name, v.poi_type, v.distance_text, v.sort, true
FROM (VALUES
  ('waldorf-astoria-maldives', 'Velana International Airport (MLE)', 'airport', 'Approx 20–30 min speedboat', 10),
  ('como-cocoa-island', 'Velana International Airport (MLE)', 'airport', 'Approx 40 min speedboat', 10),
  ('six-senses-kanuhura', 'Velana International Airport (MLE)', 'airport', 'Seaplane transfer (time varies by schedule)', 10),
  ('joali-maldives', 'Velana International Airport (MLE)', 'airport', 'Domestic flight + speedboat / seaplane', 10),
  ('suj-n-jawai', 'Udaipur Airport (UDR)', 'airport', 'Road transfer ~2–3 hrs depending on route', 10)
) AS v(external_key, name, poi_type, distance_text, sort)
JOIN public.kb_entities e ON e.external_key = v.external_key AND e.entity_type = 'hotel'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_nearby_pois p
  WHERE p.entity_id = e.id
    AND lower(p.name) = lower(v.name)
    AND p.active = true
);
