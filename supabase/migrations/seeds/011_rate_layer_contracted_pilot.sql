-- Contracted Rate Layer pilot seed for Trip Builder testing.
-- NOT a migration — supabase db push ignores this folder.
--
-- Sources:
--   docs/excel sheets/Contracted Rates Master (Pilot).xlsx
--   docs/contracted rate pdf/ (CCI, CMF, JOALI BEING, JOALI Joyful Journey, SUJÁN letter)
--
-- Hotels:
--   Waldorf Astoria Maldives Ithaafushi (wholesale nightly 2027)
--   SUJÁN Jawai / The Serai / Sher Bagh (INR nightly 2026-27)
--   COMO Cocoa Island (Asia/ME packages 2026 + 2027)
--   COMO Maalifushi (Asia/ME packages 2026 + 2027)
--   JOALI Maldives Joyful Journey 2026
--   JOALI BEING Well-Living Journey 2026
--
-- Depends on:
--   migrations/011_rate_layer.sql
--   seeds/011_rate_layer.sql (Maldives destination_profiles — run first)
--   Optional: seeds/016_atlas_kb_contracted.sql for curated_hotel_id link
--
-- Safe to re-run: each insert skips existing natural keys.
-- Do not run on production until ops has reviewed the nets.
-- Six Senses Kanuhura remains in seeds/011_rate_layer_kanuhura.sql.

-- =============================================================================
-- 0. Destination profiles used by India safari camps
-- =============================================================================

INSERT INTO public.destination_profiles (canonical_name, aliases, destination_type, notes)
SELECT v.canonical_name, v.aliases::jsonb, v.destination_type, v.notes
FROM (VALUES
  ('Jawai', '["Jawai Bandh","sujan jawai"]', 'safari_yacht_special', 'SUJÁN Jawai'),
  ('Jaisalmer', '["The Serai","sujan serai"]', 'safari_yacht_special', 'SUJÁN The Serai'),
  ('Ranthambhore', '["Ranthambore","Sher Bagh"]', 'safari_yacht_special', 'SUJÁN Sher Bagh')
) AS v(canonical_name, aliases, destination_type, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.destination_profiles p
  WHERE lower(p.canonical_name) = lower(v.canonical_name)
);

-- =============================================================================
-- 1. Properties
-- =============================================================================


INSERT INTO public.properties (
  name, brand, chain, destination, city, country, region,
  property_type, destination_profile_id, default_currency,
  min_markup_percent, contracting_entity_name, booking_notes, active
)
SELECT
  'Waldorf Astoria Maldives Ithaafushi',
  'Waldorf Astoria',
  'Hilton',
  'Maldives',
  'South Malé Atoll, Ithaafushi',
  'Maldives',
  'Asia',
  'resort',
  dp.id,
  'USD',
  25,
  'KFT Corporation',
  'Pilot contracted seed for Trip Builder. Source: founder Excel/PDF.',
  true
FROM public.destination_profiles dp
WHERE lower(dp.canonical_name) = lower('Maldives')
  AND NOT EXISTS (
    SELECT 1 FROM public.properties x WHERE lower(x.name) = lower('Waldorf Astoria Maldives Ithaafushi')
  );


INSERT INTO public.properties (
  name, brand, chain, destination, city, country, region,
  property_type, destination_profile_id, default_currency,
  min_markup_percent, contracting_entity_name, booking_notes, active
)
SELECT
  'SUJÁN Jawai',
  'SUJÁN',
  'SUJÁN',
  'Jawai',
  'Jawai',
  'India',
  'Asia',
  'safari',
  dp.id,
  'INR',
  25,
  'KFT Corporation',
  'Pilot contracted seed for Trip Builder. Source: founder Excel/PDF.',
  true
FROM public.destination_profiles dp
WHERE lower(dp.canonical_name) = lower('Jawai')
  AND NOT EXISTS (
    SELECT 1 FROM public.properties x WHERE lower(x.name) = lower('SUJÁN Jawai')
  );


INSERT INTO public.properties (
  name, brand, chain, destination, city, country, region,
  property_type, destination_profile_id, default_currency,
  min_markup_percent, contracting_entity_name, booking_notes, active
)
SELECT
  'SUJÁN The Serai',
  'SUJÁN',
  'SUJÁN',
  'Jaisalmer',
  'Jaisalmer',
  'India',
  'Asia',
  'safari',
  dp.id,
  'INR',
  25,
  'KFT Corporation',
  'Pilot contracted seed for Trip Builder. Source: founder Excel/PDF.',
  true
FROM public.destination_profiles dp
WHERE lower(dp.canonical_name) = lower('Jaisalmer')
  AND NOT EXISTS (
    SELECT 1 FROM public.properties x WHERE lower(x.name) = lower('SUJÁN The Serai')
  );


INSERT INTO public.properties (
  name, brand, chain, destination, city, country, region,
  property_type, destination_profile_id, default_currency,
  min_markup_percent, contracting_entity_name, booking_notes, active
)
SELECT
  'SUJÁN Sher Bagh',
  'SUJÁN',
  'SUJÁN',
  'Ranthambhore',
  'Ranthambhore',
  'India',
  'Asia',
  'safari',
  dp.id,
  'INR',
  25,
  'KFT Corporation',
  'Pilot contracted seed for Trip Builder. Source: founder Excel/PDF.',
  true
FROM public.destination_profiles dp
WHERE lower(dp.canonical_name) = lower('Ranthambhore')
  AND NOT EXISTS (
    SELECT 1 FROM public.properties x WHERE lower(x.name) = lower('SUJÁN Sher Bagh')
  );


INSERT INTO public.properties (
  name, brand, chain, destination, city, country, region,
  property_type, destination_profile_id, default_currency,
  min_markup_percent, contracting_entity_name, booking_notes, active
)
SELECT
  'COMO Cocoa Island',
  'COMO',
  'COMO Hotels and Resorts',
  'Maldives',
  'South Malé Atoll',
  'Maldives',
  'Asia',
  'resort',
  dp.id,
  'USD',
  25,
  'KFT Corporation',
  'Pilot contracted seed for Trip Builder. Source: founder Excel/PDF.',
  true
FROM public.destination_profiles dp
WHERE lower(dp.canonical_name) = lower('Maldives')
  AND NOT EXISTS (
    SELECT 1 FROM public.properties x WHERE lower(x.name) = lower('COMO Cocoa Island')
  );


INSERT INTO public.properties (
  name, brand, chain, destination, city, country, region,
  property_type, destination_profile_id, default_currency,
  min_markup_percent, contracting_entity_name, booking_notes, active
)
SELECT
  'COMO Maalifushi',
  'COMO',
  'COMO Hotels and Resorts',
  'Maldives',
  'Thaa Atoll, Maalefushi',
  'Maldives',
  'Asia',
  'resort',
  dp.id,
  'USD',
  25,
  'KFT Corporation',
  'Pilot contracted seed for Trip Builder. Source: founder Excel/PDF.',
  true
FROM public.destination_profiles dp
WHERE lower(dp.canonical_name) = lower('Maldives')
  AND NOT EXISTS (
    SELECT 1 FROM public.properties x WHERE lower(x.name) = lower('COMO Maalifushi')
  );


INSERT INTO public.properties (
  name, brand, chain, destination, city, country, region,
  property_type, destination_profile_id, default_currency,
  min_markup_percent, contracting_entity_name, booking_notes, active
)
SELECT
  'JOALI Maldives',
  'JOALI',
  'JOALI',
  'Maldives',
  'Raa Atoll',
  'Maldives',
  'Asia',
  'resort',
  dp.id,
  'USD',
  25,
  'KFT Corporation',
  'Pilot contracted seed for Trip Builder. Source: founder Excel/PDF.',
  true
FROM public.destination_profiles dp
WHERE lower(dp.canonical_name) = lower('Maldives')
  AND NOT EXISTS (
    SELECT 1 FROM public.properties x WHERE lower(x.name) = lower('JOALI Maldives')
  );


INSERT INTO public.properties (
  name, brand, chain, destination, city, country, region,
  property_type, destination_profile_id, default_currency,
  min_markup_percent, contracting_entity_name, booking_notes, active
)
SELECT
  'JOALI BEING',
  'JOALI',
  'JOALI',
  'Maldives',
  'Bodufushi Island, Raa Atoll',
  'Maldives',
  'Asia',
  'resort',
  dp.id,
  'USD',
  25,
  'KFT Corporation',
  'Pilot contracted seed for Trip Builder. Source: founder Excel/PDF.',
  true
FROM public.destination_profiles dp
WHERE lower(dp.canonical_name) = lower('Maldives')
  AND NOT EXISTS (
    SELECT 1 FROM public.properties x WHERE lower(x.name) = lower('JOALI BEING')
  );


-- =============================================================================
-- 2. Contracts
-- =============================================================================


INSERT INTO public.property_contracts (
  property_id, name, contract_type, market,
  valid_from, valid_to, currency, booking_code,
  min_markup_percent, source_document_name,
  policies, benefits, payout, notes, active
)
SELECT
  prop.id,
  '2027 Wholesale Rates Agreement — Waldorf Astoria Maldives Ithaafushi',
  'wholesale',
  'worldwide',
  '2027-01-10',
  '2028-01-09',
  'USD',
  NULL,
  25,
  '2027 Wholesale Rates Agreement, Waldorf Astoria Maldives Ithaafushi (14 pages)',
  jsonb_build_object(
    'schema_version', 2,
    'stay', jsonb_build_array(
      jsonb_build_object('text', 'Package or bundled sale only (other substantial travel component). Not published online. Max 9 villas per enquiry.', 'audience', 'team'),
      jsonb_build_object('text', 'Minimum 7 nights from 27 Dec 2027 to 7 Jan 2028.', 'audience', 'client'),
      jsonb_build_object('text', 'No check-in or check-out on 30 Dec 2027, 31 Dec 2027 and 1 Jan 2028.', 'audience', 'client')
    ),
    'payment', jsonb_build_array(),
    'cancellation', jsonb_build_array(),
    'transfer', jsonb_build_array(),
    'legal', jsonb_build_array(
      jsonb_build_object('text', 'Net rates include 10% service charge and 17% TGST. Green tax USD 12 pp/night (age 2+) extra. Non-commissionable.', 'audience', 'team')
    )
  ),
  jsonb_build_array(
    jsonb_build_object('type', 'honeymoon', 'items', jsonb_build_array('Champagne and chef amenities', 'Flower bed decoration', 'Floral bath ritual', 'One-hour photoshoot'))
  ),
  '{}'::jsonb,
  'Digitized from Contracted Rates Master (Pilot). Green tax not in villa rate.',
  true
FROM public.properties prop
WHERE lower(prop.name) = 'waldorf astoria maldives ithaafushi'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracts c
    WHERE c.property_id = prop.id
      AND c.source_document_name = '2027 Wholesale Rates Agreement, Waldorf Astoria Maldives Ithaafushi (14 pages)'
  );


INSERT INTO public.property_contracts (
  property_id, name, contract_type, market,
  valid_from, valid_to, currency, booking_code,
  min_markup_percent, source_document_name,
  policies, benefits, payout, notes, active
)
SELECT
  prop.id,
  'SUJÁN contract rates 2026-27 — KFT Corporation',
  'wholesale',
  'worldwide',
  '2026-05-01',
  '2027-04-30',
  'INR',
  NULL,
  25,
  'Rate Contract - KFT Corporation -2026-27.pdf',
  jsonb_build_object(
    'schema_version', 2,
    'stay', jsonb_build_array(
      jsonb_build_object('text', 'Check-in 14:00 · Check-out 12:00', 'audience', 'client', 'check_in_time', '14:00', 'check_out_time', '12:00'),
      jsonb_build_object('text', 'Maximum 2 adults per room; children under 8 may share (max 2).', 'audience', 'client'),
      jsonb_build_object('text', 'Rates exclusive of taxes and beverages. Mandatory conservation contribution INR 2,500 + 18% GST pp/night.', 'audience', 'team')
    ),
    'payment', jsonb_build_array(
      jsonb_build_object('text', 'FIT: 20% within 10 days of confirming; 100% by 60 days prior.', 'audience', 'team')
    ),
    'cancellation', jsonb_build_array(
      jsonb_build_object('text', 'FIT: 91+ days nil; 61-90 days 10%; 0-60 days 100%.', 'audience', 'team'),
      jsonb_build_object('text', 'Festive 21 Dec 2026–4 Jan 2027: stricter FIT/GIT cancel windows apply.', 'audience', 'team', 'season', 'peak')
    ),
    'transfer', jsonb_build_array(),
    'legal', jsonb_build_array(
      jsonb_build_object('text', 'Rates may not be published unless part of a package.', 'audience', 'team')
    )
  ),
  jsonb_build_array(
    jsonb_build_object('type', 'circuit', 'items', jsonb_build_array('5% off when 2 SUJÁN locations on same itinerary', '7.5% off when 3 locations'))
  ),
  '{}'::jsonb,
  'One commercial letter → three properties. Conservation contribution is a mandatory addon.',
  true
FROM public.properties prop
WHERE lower(prop.name) = lower('SUJÁN Jawai')
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracts c
    WHERE c.property_id = prop.id
      AND c.source_document_name = 'Rate Contract - KFT Corporation -2026-27.pdf'
  );


INSERT INTO public.property_contracts (
  property_id, name, contract_type, market,
  valid_from, valid_to, currency, booking_code,
  min_markup_percent, source_document_name,
  policies, benefits, payout, notes, active
)
SELECT
  prop.id,
  'SUJÁN contract rates 2026-27 — KFT Corporation',
  'wholesale',
  'worldwide',
  '2026-05-01',
  '2027-03-31',
  'INR',
  NULL,
  25,
  'Rate Contract - KFT Corporation -2026-27.pdf',
  jsonb_build_object(
    'schema_version', 2,
    'stay', jsonb_build_array(
      jsonb_build_object('text', 'Check-in 14:00 · Check-out 12:00', 'audience', 'client', 'check_in_time', '14:00', 'check_out_time', '12:00'),
      jsonb_build_object('text', 'Maximum 2 adults per room; children under 8 may share (max 2).', 'audience', 'client'),
      jsonb_build_object('text', 'Rates exclusive of taxes and beverages. Mandatory conservation contribution INR 2,500 + 18% GST pp/night.', 'audience', 'team')
    ),
    'payment', jsonb_build_array(
      jsonb_build_object('text', 'FIT: 20% within 10 days of confirming; 100% by 60 days prior.', 'audience', 'team')
    ),
    'cancellation', jsonb_build_array(
      jsonb_build_object('text', 'FIT: 91+ days nil; 61-90 days 10%; 0-60 days 100%.', 'audience', 'team'),
      jsonb_build_object('text', 'Festive 21 Dec 2026–4 Jan 2027: stricter FIT/GIT cancel windows apply.', 'audience', 'team', 'season', 'peak')
    ),
    'transfer', jsonb_build_array(),
    'legal', jsonb_build_array(
      jsonb_build_object('text', 'Rates may not be published unless part of a package.', 'audience', 'team')
    )
  ),
  jsonb_build_array(
    jsonb_build_object('type', 'circuit', 'items', jsonb_build_array('5% off when 2 SUJÁN locations on same itinerary', '7.5% off when 3 locations'))
  ),
  '{}'::jsonb,
  'One commercial letter → three properties. Conservation contribution is a mandatory addon.',
  true
FROM public.properties prop
WHERE lower(prop.name) = lower('SUJÁN The Serai')
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracts c
    WHERE c.property_id = prop.id
      AND c.source_document_name = 'Rate Contract - KFT Corporation -2026-27.pdf'
  );


INSERT INTO public.property_contracts (
  property_id, name, contract_type, market,
  valid_from, valid_to, currency, booking_code,
  min_markup_percent, source_document_name,
  policies, benefits, payout, notes, active
)
SELECT
  prop.id,
  'SUJÁN contract rates 2026-27 — KFT Corporation',
  'wholesale',
  'worldwide',
  '2026-05-01',
  '2027-04-30',
  'INR',
  NULL,
  25,
  'Rate Contract - KFT Corporation -2026-27.pdf',
  jsonb_build_object(
    'schema_version', 2,
    'stay', jsonb_build_array(
      jsonb_build_object('text', 'Check-in 14:00 · Check-out 12:00', 'audience', 'client', 'check_in_time', '14:00', 'check_out_time', '12:00'),
      jsonb_build_object('text', 'Maximum 2 adults per room; children under 8 may share (max 2).', 'audience', 'client'),
      jsonb_build_object('text', 'Rates exclusive of taxes and beverages. Mandatory conservation contribution INR 2,500 + 18% GST pp/night.', 'audience', 'team')
    ),
    'payment', jsonb_build_array(
      jsonb_build_object('text', 'FIT: 20% within 10 days of confirming; 100% by 60 days prior.', 'audience', 'team')
    ),
    'cancellation', jsonb_build_array(
      jsonb_build_object('text', 'FIT: 91+ days nil; 61-90 days 10%; 0-60 days 100%.', 'audience', 'team'),
      jsonb_build_object('text', 'Festive 21 Dec 2026–4 Jan 2027: stricter FIT/GIT cancel windows apply.', 'audience', 'team', 'season', 'peak')
    ),
    'transfer', jsonb_build_array(),
    'legal', jsonb_build_array(
      jsonb_build_object('text', 'Rates may not be published unless part of a package.', 'audience', 'team')
    )
  ),
  jsonb_build_array(
    jsonb_build_object('type', 'circuit', 'items', jsonb_build_array('5% off when 2 SUJÁN locations on same itinerary', '7.5% off when 3 locations'))
  ),
  '{}'::jsonb,
  'One commercial letter → three properties. Conservation contribution is a mandatory addon.',
  true
FROM public.properties prop
WHERE lower(prop.name) = lower('SUJÁN Sher Bagh')
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracts c
    WHERE c.property_id = prop.id
      AND c.source_document_name = 'Rate Contract - KFT Corporation -2026-27.pdf'
  );


INSERT INTO public.property_contracts (
  property_id, name, contract_type, market,
  valid_from, valid_to, currency, booking_code,
  min_markup_percent, source_document_name,
  policies, benefits, payout, notes, active
)
SELECT
  prop.id,
  'COMO Cocoa Island Escape Package 2027 — Asia & Middle East',
  'package',
  'asia_middle_east',
  '2027-01-06',
  '2027-12-19',
  'USD',
  'CCI_ASIAME_27_150827',
  25,
  'CCI pacakges - Asia & ME - 2027 - Updated.pdf',
  jsonb_build_object(
    'schema_version', 2,
    'stay', jsonb_build_array(
      jsonb_build_object('text', 'New bookings only. Markets: Middle East, India, Thailand, Vietnam, Singapore, Malaysia, Indonesia, Philippines.', 'audience', 'team'),
      jsonb_build_object('text', '3N includes breakfast + 3-course dinner, shared speedboat, 60-min massage (18+). 4N adds one complimentary experience.', 'audience', 'client')
    ),
    'payment', jsonb_build_array(
      jsonb_build_object('text', 'Full payment minimum 14 days prior to arrival.', 'audience', 'team')
    ),
    'cancellation', jsonb_build_array(
      jsonb_build_object('text', '14–8 days: 50%. Within 7 days / no-show / early departure: 100%.', 'audience', 'team', 'cancel_days', 7, 'charge_pct', 100)
    ),
    'transfer', jsonb_build_array(
      jsonb_build_object('text', 'Roundtrip shared speedboat included in package.', 'audience', 'client')
    ),
    'legal', jsonb_build_array(
      jsonb_build_object('text', 'Rates include 10% SC, government taxes and green tax.', 'audience', 'team')
    )
  ),
  jsonb_build_array(
    jsonb_build_object('type', 'package_value_adds', 'items', jsonb_build_array('Daily breakfast', 'Three-course dinner', 'Shared speedboat', '60-min COMO Shambhala massage'))
  ),
  '{}'::jsonb,
  'Package totals for 2 adults. Combinable with honeymoon/anniversary.',
  true
FROM public.properties prop
WHERE lower(prop.name) = 'como cocoa island'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracts c
    WHERE c.property_id = prop.id AND c.booking_code = 'CCI_ASIAME_27_150827'
  );

INSERT INTO public.property_contracts (
  property_id, name, contract_type, market,
  valid_from, valid_to, currency, booking_code,
  min_markup_percent, source_document_name,
  policies, benefits, payout, notes, active
)
SELECT
  prop.id,
  'COMO Cocoa Island Escape Package 2026 — Asia & Middle East',
  'package',
  'asia_middle_east',
  '2026-08-21',
  '2026-12-19',
  'USD',
  'CCI_ASIAME_26_150826',
  25,
  'CCI pacakges update - Asia & ME - 2026 - Updated.pdf',
  jsonb_build_object(
    'schema_version', 2,
    'stay', jsonb_build_array(
      jsonb_build_object('text', 'New bookings only. Asia & Middle East markets as per PDF.', 'audience', 'team')
    ),
    'payment', jsonb_build_array(
      jsonb_build_object('text', 'Full payment minimum 14 days prior.', 'audience', 'team')
    ),
    'cancellation', jsonb_build_array(
      jsonb_build_object('text', '14–8 days 50%; within 7 days 100%.', 'audience', 'team', 'cancel_days', 7, 'charge_pct', 100)
    ),
    'transfer', jsonb_build_array(
      jsonb_build_object('text', 'Shared speedboat included.', 'audience', 'client')
    ),
    'legal', jsonb_build_array(
      jsonb_build_object('text', 'Includes SC, taxes and green tax.', 'audience', 'team')
    )
  ),
  '[]'::jsonb,
  '{}'::jsonb,
  '2026 package season from CCI PDF.',
  true
FROM public.properties prop
WHERE lower(prop.name) = 'como cocoa island'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracts c
    WHERE c.property_id = prop.id AND c.booking_code = 'CCI_ASIAME_26_150826'
  );


INSERT INTO public.property_contracts (
  property_id, name, contract_type, market,
  valid_from, valid_to, currency, booking_code,
  min_markup_percent, source_document_name,
  policies, benefits, payout, notes, active
)
SELECT
  prop.id,
  'COMO Maalifushi Island Escape Package 2027 — Asia & Middle East',
  'package',
  'asia_middle_east',
  '2027-01-06',
  '2027-12-19',
  'USD',
  'CMF_ASIAME_27_150826',
  25,
  'CMF pacakges - Asia & ME - 2027 -Updated.pdf',
  jsonb_build_object(
    'schema_version', 2,
    'stay', jsonb_build_array(
      jsonb_build_object('text', '4N package: breakfast + dinner, shared seaplane, 60-min massage, guided snorkel, photo shoot.', 'audience', 'client')
    ),
    'payment', jsonb_build_array(
      jsonb_build_object('text', 'Full payment minimum 14 days prior.', 'audience', 'team')
    ),
    'cancellation', jsonb_build_array(
      jsonb_build_object('text', '14–8 days 50%; within 7 days 100%.', 'audience', 'team', 'cancel_days', 7, 'charge_pct', 100)
    ),
    'transfer', jsonb_build_array(
      jsonb_build_object('text', 'Roundtrip shared seaplane included in 4N package.', 'audience', 'client')
    ),
    'legal', jsonb_build_array(
      jsonb_build_object('text', 'Includes SC, taxes and green tax. Asia/ME markets only.', 'audience', 'team')
    )
  ),
  '[]'::jsonb,
  '{}'::jsonb,
  'Digitized from CMF PDF. 4N package + additional night.',
  true
FROM public.properties prop
WHERE lower(prop.name) = 'como maalifushi'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracts c
    WHERE c.property_id = prop.id AND c.booking_code = 'CMF_ASIAME_27_150826'
  );


INSERT INTO public.property_contracts (
  property_id, name, contract_type, market,
  valid_from, valid_to, currency, booking_code,
  min_markup_percent, source_document_name,
  policies, benefits, payout, notes, active
)
SELECT
  prop.id,
  'COMO Maalifushi Island Escape Package 2026 — Asia & Middle East',
  'package',
  'asia_middle_east',
  '2026-08-21',
  '2026-12-19',
  'USD',
  'CMF_ASIAME_26_150826',
  25,
  'CMF pacakges update - Asia & ME - 2026 - Updated.pdf',
  jsonb_build_object(
    'schema_version', 2,
    'stay', jsonb_build_array(
      jsonb_build_object('text', '4N package: breakfast + dinner, shared seaplane, 60-min massage, guided snorkel, photo shoot.', 'audience', 'client')
    ),
    'payment', jsonb_build_array(
      jsonb_build_object('text', 'Full payment minimum 14 days prior.', 'audience', 'team')
    ),
    'cancellation', jsonb_build_array(
      jsonb_build_object('text', '14–8 days 50%; within 7 days 100%.', 'audience', 'team', 'cancel_days', 7, 'charge_pct', 100)
    ),
    'transfer', jsonb_build_array(
      jsonb_build_object('text', 'Roundtrip shared seaplane included in 4N package.', 'audience', 'client')
    ),
    'legal', jsonb_build_array(
      jsonb_build_object('text', 'Includes SC, taxes and green tax. Asia/ME markets only.', 'audience', 'team')
    )
  ),
  '[]'::jsonb,
  '{}'::jsonb,
  'Digitized from CMF PDF. 4N package + additional night.',
  true
FROM public.properties prop
WHERE lower(prop.name) = 'como maalifushi'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracts c
    WHERE c.property_id = prop.id AND c.booking_code = 'CMF_ASIAME_26_150826'
  );


INSERT INTO public.property_contracts (
  property_id, name, contract_type, market,
  valid_from, valid_to, currency, booking_code,
  min_markup_percent, source_document_name,
  policies, benefits, payout, notes, active
)
SELECT
  prop.id,
  'JOALI Maldives — Joyful Journey 2026',
  'package',
  'india_middle_east_gcc',
  '2026-10-11',
  '2026-12-20',
  'USD',
  'JOYJ26',
  25,
  'JM 2026 - Joyful Journey - 2026.pdf',
  jsonb_build_object(
    'schema_version', 2,
    'stay', jsonb_build_array(
      jsonb_build_object('text', 'India / Middle East / GCC passport holders. Min 3 or 4 nights. Half board included.', 'audience', 'client'),
      jsonb_build_object('text', 'Book by 20 Dec 2026. New bookings only. Promo JOYJ26.', 'audience', 'team')
    ),
    'payment', jsonb_build_array(),
    'cancellation', jsonb_build_array(),
    'transfer', jsonb_build_array(
      jsonb_build_object('text', 'Shared return seaplane included in 3N/4N package (adult USD 1,148 / child USD 355 listed separately for extras).', 'audience', 'client')
    ),
    'legal', jsonb_build_array(
      jsonb_build_object('text', 'Green tax included in package and extra-night charges. Not combinable with other contracted offers except Kids Offer.', 'audience', 'team')
    )
  ),
  jsonb_build_array(
    jsonb_build_object('type', 'package_value_adds', 'items', jsonb_build_array('Welcome amenities + champagne', 'Butler (Jadugar)', 'Half board', 'Non-motorised watersports', 'Yoga/fitness classes'))
  ),
  '{}'::jsonb,
  'Joyful Journey premium shoulder package.',
  true
FROM public.properties prop
WHERE lower(prop.name) = 'joali maldives'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracts c
    WHERE c.property_id = prop.id AND c.booking_code = 'JOYJ26'
  );

INSERT INTO public.property_contracts (
  property_id, name, contract_type, market,
  valid_from, valid_to, currency, booking_code,
  min_markup_percent, source_document_name,
  policies, benefits, payout, notes, active
)
SELECT
  prop.id,
  'JOALI BEING — Well-Living Journey 2026',
  'package',
  'india_middle_east_gcc',
  '2026-10-11',
  '2026-12-20',
  'USD',
  'WELE26',
  25,
  'JOALI BEING - Well-Living Journey - INDIA, Middle East & GCC 2026.pdf',
  jsonb_build_object(
    'schema_version', 2,
    'stay', jsonb_build_array(
      jsonb_build_object('text', 'India / Middle East / GCC. Min 3 or 4 nights. Half board + wellbeing consultation.', 'audience', 'client'),
      jsonb_build_object('text', 'Book by 20 Dec 2026. Promo WELE26. New bookings only.', 'audience', 'team')
    ),
    'payment', jsonb_build_array(),
    'cancellation', jsonb_build_array(),
    'transfer', jsonb_build_array(
      jsonb_build_object('text', 'Shared return seaplane included in package rates.', 'audience', 'client')
    ),
    'legal', jsonb_build_array(
      jsonb_build_object('text', 'Green tax included in package and extra nights.', 'audience', 'team')
    )
  ),
  jsonb_build_array(
    jsonb_build_object('type', 'package_value_adds', 'items', jsonb_build_array('30-min wellbeing consultation', 'Butler', 'Half board', 'Mind & movement classes'))
  ),
  '{}'::jsonb,
  'Well-Living Journey shoulder package.',
  true
FROM public.properties prop
WHERE lower(prop.name) = 'joali being'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracts c
    WHERE c.property_id = prop.id AND c.booking_code = 'WELE26'
  );


-- =============================================================================
-- 3. Nightly contracted rates (Waldorf + SUJÁN) — stay windows expanded
-- =============================================================================


INSERT INTO public.property_contracted_rates (
  property_id, contract_id, room_category, season_code, rate_basis,
  valid_from, valid_to, currency, cost_amount, cost_unit,
  base_adults, base_children,
  board, includes_breakfast, includes_lunch, includes_dinner,
  includes_transfer, includes_green_tax, min_nights,
  sort_order, inclusions, notes, active
)
SELECT
  c.property_id, c.id, v.room, v.season, 'nightly',
  v.vf::date, v.vt::date, v.currency, v.amount, 'per_night',
  v.base_a, 0,
  'BB', true, false, false,
  false, false, 1,
  v.sort, '["10% service charge","17% TGST"]'::jsonb, 'Wholesale net villa/night. Green tax USD12 pp/night (age 2+) extra.', true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (VALUES
  ('Reef Villa with Pool', 'high', '2027-01-10', '2027-03-09', 3050.0, 'USD', 2, 10),
  ('Reef Villa with Pool', 'high', '2027-03-29', '2027-05-07', 3050.0, 'USD', 2, 20),
  ('Reef Villa with Pool', 'high', '2027-10-01', '2027-12-20', 3050.0, 'USD', 2, 30),
  ('Reef Villa with Pool', 'other', '2027-03-10', '2027-03-28', 3400.0, 'USD', 2, 40),
  ('Reef Villa with Pool', 'shoulder', '2027-05-08', '2027-09-30', 2700.0, 'USD', 2, 50),
  ('Reef Villa with Pool', 'peak', '2027-12-21', '2028-01-09', 7000.0, 'USD', 2, 60),
  ('Overwater Villa with Pool', 'high', '2027-01-10', '2027-03-09', 3250.0, 'USD', 2, 70),
  ('Overwater Villa with Pool', 'high', '2027-03-29', '2027-05-07', 3250.0, 'USD', 2, 80),
  ('Overwater Villa with Pool', 'high', '2027-10-01', '2027-12-20', 3250.0, 'USD', 2, 90),
  ('Overwater Villa with Pool', 'other', '2027-03-10', '2027-03-28', 3500.0, 'USD', 2, 100),
  ('Overwater Villa with Pool', 'shoulder', '2027-05-08', '2027-09-30', 3200.0, 'USD', 2, 110),
  ('Overwater Villa with Pool', 'peak', '2027-12-21', '2028-01-09', 7650.0, 'USD', 2, 120),
  ('Beach Villa with Pool', 'high', '2027-01-10', '2027-03-09', 3400.0, 'USD', 2, 130),
  ('Beach Villa with Pool', 'high', '2027-03-29', '2027-05-07', 3400.0, 'USD', 2, 140),
  ('Beach Villa with Pool', 'high', '2027-10-01', '2027-12-20', 3400.0, 'USD', 2, 150),
  ('Beach Villa with Pool', 'other', '2027-03-10', '2027-03-28', 3800.0, 'USD', 2, 160),
  ('Beach Villa with Pool', 'shoulder', '2027-05-08', '2027-09-30', 3100.0, 'USD', 2, 170),
  ('Beach Villa with Pool', 'peak', '2027-12-21', '2028-01-09', 8200.0, 'USD', 2, 180),
  ('Grand Reef Villa with Pool', 'high', '2027-01-10', '2027-03-09', 4050.0, 'USD', 2, 190),
  ('Grand Reef Villa with Pool', 'high', '2027-03-29', '2027-05-07', 4050.0, 'USD', 2, 200),
  ('Grand Reef Villa with Pool', 'high', '2027-10-01', '2027-12-20', 4050.0, 'USD', 2, 210),
  ('Grand Reef Villa with Pool', 'other', '2027-03-10', '2027-03-28', 4250.0, 'USD', 2, 220),
  ('Grand Reef Villa with Pool', 'shoulder', '2027-05-08', '2027-09-30', 3300.0, 'USD', 2, 230),
  ('Grand Reef Villa with Pool', 'peak', '2027-12-21', '2028-01-09', 8300.0, 'USD', 2, 240),
  ('Grand Overwater Villa with Pool', 'high', '2027-01-10', '2027-03-09', 4550.0, 'USD', 2, 250),
  ('Grand Overwater Villa with Pool', 'high', '2027-03-29', '2027-05-07', 4550.0, 'USD', 2, 260),
  ('Grand Overwater Villa with Pool', 'high', '2027-10-01', '2027-12-20', 4550.0, 'USD', 2, 270),
  ('Grand Overwater Villa with Pool', 'other', '2027-03-10', '2027-03-28', 4750.0, 'USD', 2, 280),
  ('Grand Overwater Villa with Pool', 'shoulder', '2027-05-08', '2027-09-30', 3900.0, 'USD', 2, 290),
  ('Grand Overwater Villa with Pool', 'peak', '2027-12-21', '2028-01-09', 9000.0, 'USD', 2, 300),
  ('Grand Beach Villa with Pool', 'high', '2027-01-10', '2027-03-09', 4900.0, 'USD', 2, 310),
  ('Grand Beach Villa with Pool', 'high', '2027-03-29', '2027-05-07', 4900.0, 'USD', 2, 320),
  ('Grand Beach Villa with Pool', 'high', '2027-10-01', '2027-12-20', 4900.0, 'USD', 2, 330),
  ('Grand Beach Villa with Pool', 'other', '2027-03-10', '2027-03-28', 5050.0, 'USD', 2, 340),
  ('Grand Beach Villa with Pool', 'shoulder', '2027-05-08', '2027-09-30', 3700.0, 'USD', 2, 350),
  ('Grand Beach Villa with Pool', 'peak', '2027-12-21', '2028-01-09', 9300.0, 'USD', 2, 360),
  ('Two Bedroom Reef Villa with Pool', 'high', '2027-01-10', '2027-03-09', 9300.0, 'USD', 4, 370),
  ('Two Bedroom Reef Villa with Pool', 'high', '2027-03-29', '2027-05-07', 9300.0, 'USD', 4, 380),
  ('Two Bedroom Reef Villa with Pool', 'high', '2027-10-01', '2027-12-20', 9300.0, 'USD', 4, 390),
  ('Two Bedroom Reef Villa with Pool', 'other', '2027-03-10', '2027-03-28', 11000.0, 'USD', 4, 400),
  ('Two Bedroom Reef Villa with Pool', 'shoulder', '2027-05-08', '2027-09-30', 8150.0, 'USD', 4, 410),
  ('Two Bedroom Reef Villa with Pool', 'peak', '2027-12-21', '2028-01-09', 15200.0, 'USD', 4, 420),
  ('Two Bedroom Overwater Villa with Pool', 'high', '2027-01-10', '2027-03-09', 9800.0, 'USD', 4, 430),
  ('Two Bedroom Overwater Villa with Pool', 'high', '2027-03-29', '2027-05-07', 9800.0, 'USD', 4, 440),
  ('Two Bedroom Overwater Villa with Pool', 'high', '2027-10-01', '2027-12-20', 9800.0, 'USD', 4, 450),
  ('Two Bedroom Overwater Villa with Pool', 'other', '2027-03-10', '2027-03-28', 13000.0, 'USD', 4, 460),
  ('Two Bedroom Overwater Villa with Pool', 'shoulder', '2027-05-08', '2027-09-30', 9200.0, 'USD', 4, 470),
  ('Two Bedroom Overwater Villa with Pool', 'peak', '2027-12-21', '2028-01-09', 16800.0, 'USD', 4, 480),
  ('Two Bedroom Beach Villa with Pool', 'high', '2027-01-10', '2027-03-09', 10800.0, 'USD', 4, 490),
  ('Two Bedroom Beach Villa with Pool', 'high', '2027-03-29', '2027-05-07', 10800.0, 'USD', 4, 500),
  ('Two Bedroom Beach Villa with Pool', 'high', '2027-10-01', '2027-12-20', 10800.0, 'USD', 4, 510),
  ('Two Bedroom Beach Villa with Pool', 'other', '2027-03-10', '2027-03-28', 14000.0, 'USD', 4, 520),
  ('Two Bedroom Beach Villa with Pool', 'shoulder', '2027-05-08', '2027-09-30', 9350.0, 'USD', 4, 530),
  ('Two Bedroom Beach Villa with Pool', 'peak', '2027-12-21', '2028-01-09', 18500.0, 'USD', 4, 540),
  ('Two Bedroom Grand Beach Villa with Pool', 'high', '2027-01-10', '2027-03-09', 11800.0, 'USD', 4, 550),
  ('Two Bedroom Grand Beach Villa with Pool', 'high', '2027-03-29', '2027-05-07', 11800.0, 'USD', 4, 560),
  ('Two Bedroom Grand Beach Villa with Pool', 'high', '2027-10-01', '2027-12-20', 11800.0, 'USD', 4, 570),
  ('Two Bedroom Grand Beach Villa with Pool', 'other', '2027-03-10', '2027-03-28', 15600.0, 'USD', 4, 580),
  ('Two Bedroom Grand Beach Villa with Pool', 'shoulder', '2027-05-08', '2027-09-30', 10100.0, 'USD', 4, 590),
  ('Two Bedroom Grand Beach Villa with Pool', 'peak', '2027-12-21', '2028-01-09', 21000.0, 'USD', 4, 600),
  ('Three Bedroom Overwater Villa with Pool', 'high', '2027-01-10', '2027-03-09', 23500.0, 'USD', 6, 610),
  ('Three Bedroom Overwater Villa with Pool', 'high', '2027-03-29', '2027-05-07', 23500.0, 'USD', 6, 620),
  ('Three Bedroom Overwater Villa with Pool', 'high', '2027-10-01', '2027-12-20', 23500.0, 'USD', 6, 630),
  ('Three Bedroom Overwater Villa with Pool', 'other', '2027-03-10', '2027-03-28', 27300.0, 'USD', 6, 640),
  ('Three Bedroom Overwater Villa with Pool', 'shoulder', '2027-05-08', '2027-09-30', 20200.0, 'USD', 6, 650),
  ('Three Bedroom Overwater Villa with Pool', 'peak', '2027-12-21', '2028-01-09', 33100.0, 'USD', 6, 660),
  ('Three Bedroom Grand Beach Villa with Pool', 'high', '2027-01-10', '2027-03-09', 32000.0, 'USD', 6, 670),
  ('Three Bedroom Grand Beach Villa with Pool', 'high', '2027-03-29', '2027-05-07', 32000.0, 'USD', 6, 680),
  ('Three Bedroom Grand Beach Villa with Pool', 'high', '2027-10-01', '2027-12-20', 32000.0, 'USD', 6, 690),
  ('Three Bedroom Grand Beach Villa with Pool', 'other', '2027-03-10', '2027-03-28', 38000.0, 'USD', 6, 700),
  ('Three Bedroom Grand Beach Villa with Pool', 'shoulder', '2027-05-08', '2027-09-30', 29200.0, 'USD', 6, 710),
  ('Three Bedroom Grand Beach Villa with Pool', 'peak', '2027-12-21', '2028-01-09', 46000.0, 'USD', 6, 720)
) AS v(room, season, vf, vt, amount, currency, base_a, sort)
WHERE lower(prop.name) = 'waldorf astoria maldives ithaafushi'
  AND c.source_document_name = '2027 Wholesale Rates Agreement, Waldorf Astoria Maldives Ithaafushi (14 pages)'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracted_rates r
    WHERE r.property_id = c.property_id
      AND r.contract_id = c.id
      AND r.room_category = v.room
      AND r.season_code = v.season
      AND r.valid_from = v.vf::date
      AND r.valid_to = v.vt::date
      AND r.rate_basis = 'nightly'
      AND r.cost_amount = v.amount
  );


INSERT INTO public.property_contracted_rates (
  property_id, contract_id, room_category, season_code, rate_basis,
  valid_from, valid_to, currency, cost_amount, cost_unit,
  base_adults, base_children,
  board, includes_breakfast, includes_lunch, includes_dinner,
  includes_transfer, includes_green_tax, min_nights,
  sort_order, inclusions, notes, active
)
SELECT
  c.property_id, c.id, v.room, v.season, 'nightly',
  v.vf::date, v.vt::date, v.currency, v.amount, 'per_night',
  v.base_a, 0,
  NULL, false, false, false,
  false, false, 1,
  v.sort, '[]'::jsonb, 'INR exclusive of taxes/beverages. Conservation INR2500+18% GST pp/night mandatory.', true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (VALUES
  ('The Tented Rock Suite', 'low', '2026-05-01', '2026-09-30', 63000.0, 'INR', 2, 10),
  ('The Tented Rock Suite', 'high', '2026-10-01', '2026-12-20', 115000.0, 'INR', 2, 20),
  ('The Tented Rock Suite', 'high', '2027-01-05', '2027-04-30', 115000.0, 'INR', 2, 30),
  ('The Tented Rock Suite', 'peak', '2026-12-21', '2027-01-04', 135000.0, 'INR', 2, 40),
  ('The Family Felidae Suite (two bedroom)', 'low', '2026-05-01', '2026-09-30', 119000.0, 'INR', 2, 50),
  ('The Family Felidae Suite (two bedroom)', 'high', '2026-10-01', '2026-12-20', 212000.0, 'INR', 2, 60),
  ('The Family Felidae Suite (two bedroom)', 'high', '2027-01-05', '2027-04-30', 212000.0, 'INR', 2, 70),
  ('The Royal Panthera Suite', 'low', '2026-05-01', '2026-09-30', 145000.0, 'INR', 2, 80),
  ('The Royal Panthera Suite', 'high', '2026-10-01', '2026-12-20', 239000.0, 'INR', 2, 90),
  ('The Royal Panthera Suite', 'high', '2027-01-05', '2027-04-30', 239000.0, 'INR', 2, 100),
  ('The Royal Panthera Suite', 'peak', '2026-12-21', '2027-01-04', 270000.0, 'INR', 2, 110),
  ('Eden at Jawai Private Camp', 'low', '2026-05-01', '2026-09-30', 224000.0, 'INR', 2, 120),
  ('Eden at Jawai Private Camp', 'high', '2026-10-01', '2026-12-20', 363000.0, 'INR', 2, 130),
  ('Eden at Jawai Private Camp', 'high', '2027-01-05', '2027-04-30', 363000.0, 'INR', 2, 140),
  ('Eden at Jawai Private Camp', 'peak', '2026-12-21', '2027-01-04', 415000.0, 'INR', 2, 150)
) AS v(room, season, vf, vt, amount, currency, base_a, sort)
WHERE lower(prop.name) = 'suján jawai'
  AND c.source_document_name = 'Rate Contract - KFT Corporation -2026-27.pdf'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracted_rates r
    WHERE r.property_id = c.property_id
      AND r.contract_id = c.id
      AND r.room_category = v.room
      AND r.season_code = v.season
      AND r.valid_from = v.vf::date
      AND r.valid_to = v.vt::date
      AND r.rate_basis = 'nightly'
      AND r.cost_amount = v.amount
  );


INSERT INTO public.property_contracted_rates (
  property_id, contract_id, room_category, season_code, rate_basis,
  valid_from, valid_to, currency, cost_amount, cost_unit,
  base_adults, base_children,
  board, includes_breakfast, includes_lunch, includes_dinner,
  includes_transfer, includes_green_tax, min_nights,
  sort_order, inclusions, notes, active
)
SELECT
  c.property_id, c.id, v.room, v.season, 'nightly',
  v.vf::date, v.vt::date, v.currency, v.amount, 'per_night',
  v.base_a, 0,
  NULL, false, false, false,
  false, false, 1,
  v.sort, '[]'::jsonb, 'INR exclusive of taxes/beverages. Conservation mandatory.', true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (VALUES
  ('Luxury Tent', 'low', '2026-09-15', '2026-09-30', 45000.0, 'INR', 2, 10),
  ('Luxury Tent', 'high', '2026-10-01', '2026-12-20', 74000.0, 'INR', 2, 20),
  ('Luxury Tent', 'high', '2027-01-05', '2027-03-31', 74000.0, 'INR', 2, 30),
  ('Luxury Tent', 'peak', '2026-12-21', '2027-01-04', 90000.0, 'INR', 2, 40),
  ('Luxury Tented Suite', 'low', '2026-09-15', '2026-09-30', 60000.0, 'INR', 2, 50),
  ('Luxury Tented Suite', 'high', '2026-10-01', '2026-12-20', 108000.0, 'INR', 2, 60),
  ('Luxury Tented Suite', 'high', '2027-01-05', '2027-03-31', 108000.0, 'INR', 2, 70),
  ('Luxury Tented Suite', 'peak', '2026-12-21', '2027-01-04', 123000.0, 'INR', 2, 80),
  ('Royal Tented Suite', 'low', '2026-09-15', '2026-09-30', 90000.0, 'INR', 2, 90),
  ('Royal Tented Suite', 'high', '2026-10-01', '2026-12-20', 168000.0, 'INR', 2, 100),
  ('Royal Tented Suite', 'high', '2027-01-05', '2027-03-31', 168000.0, 'INR', 2, 110),
  ('Royal Tented Suite', 'peak', '2026-12-21', '2027-01-04', 191000.0, 'INR', 2, 120)
) AS v(room, season, vf, vt, amount, currency, base_a, sort)
WHERE lower(prop.name) = 'suján the serai'
  AND c.source_document_name = 'Rate Contract - KFT Corporation -2026-27.pdf'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracted_rates r
    WHERE r.property_id = c.property_id
      AND r.contract_id = c.id
      AND r.room_category = v.room
      AND r.season_code = v.season
      AND r.valid_from = v.vf::date
      AND r.valid_to = v.vt::date
      AND r.rate_basis = 'nightly'
      AND r.cost_amount = v.amount
  );


INSERT INTO public.property_contracted_rates (
  property_id, contract_id, room_category, season_code, rate_basis,
  valid_from, valid_to, currency, cost_amount, cost_unit,
  base_adults, base_children,
  board, includes_breakfast, includes_lunch, includes_dinner,
  includes_transfer, includes_green_tax, min_nights,
  sort_order, inclusions, notes, active
)
SELECT
  c.property_id, c.id, v.room, v.season, 'nightly',
  v.vf::date, v.vt::date, v.currency, v.amount, 'per_night',
  v.base_a, 0,
  NULL, false, false, false,
  false, false, 1,
  v.sort, '[]'::jsonb, 'INR exclusive of taxes/beverages. Conservation mandatory.', true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (VALUES
  ('Tented Jungle Suite', 'low', '2026-05-01', '2026-09-30', 51000.0, 'INR', 2, 10),
  ('Tented Jungle Suite', 'high', '2026-10-01', '2026-12-20', 94000.0, 'INR', 2, 20),
  ('Tented Jungle Suite', 'high', '2027-01-05', '2027-04-30', 94000.0, 'INR', 2, 30),
  ('Tented Jungle Suite', 'peak', '2026-12-21', '2027-01-04', 123000.0, 'INR', 2, 40),
  ('The Family Machhli Suite (two bedroom)', 'low', '2026-05-01', '2026-09-30', 90000.0, 'INR', 2, 50),
  ('The Family Machhli Suite (two bedroom)', 'high', '2026-10-01', '2026-12-20', 168000.0, 'INR', 2, 60),
  ('The Family Machhli Suite (two bedroom)', 'high', '2027-01-05', '2027-04-30', 168000.0, 'INR', 2, 70),
  ('The Royal Sher Suite', 'low', '2026-05-01', '2026-09-30', 98000.0, 'INR', 2, 80),
  ('The Royal Sher Suite', 'high', '2026-10-01', '2026-12-20', 171000.0, 'INR', 2, 90),
  ('The Royal Sher Suite', 'high', '2027-01-05', '2027-04-30', 171000.0, 'INR', 2, 100),
  ('The Royal Sher Suite', 'peak', '2026-12-21', '2027-01-04', 194000.0, 'INR', 2, 110),
  ('The Imperial Raj Bagh Suite', 'low', '2026-05-01', '2026-09-30', 134000.0, 'INR', 2, 120),
  ('The Imperial Raj Bagh Suite', 'high', '2026-10-01', '2026-12-20', 253000.0, 'INR', 2, 130),
  ('The Imperial Raj Bagh Suite', 'high', '2027-01-05', '2027-04-30', 253000.0, 'INR', 2, 140),
  ('The Imperial Raj Bagh Suite', 'peak', '2026-12-21', '2027-01-04', 296000.0, 'INR', 2, 150)
) AS v(room, season, vf, vt, amount, currency, base_a, sort)
WHERE lower(prop.name) = 'suján sher bagh'
  AND c.source_document_name = 'Rate Contract - KFT Corporation -2026-27.pdf'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracted_rates r
    WHERE r.property_id = c.property_id
      AND r.contract_id = c.id
      AND r.room_category = v.room
      AND r.season_code = v.season
      AND r.valid_from = v.vf::date
      AND r.valid_to = v.vt::date
      AND r.rate_basis = 'nightly'
      AND r.cost_amount = v.amount
  );


-- =============================================================================
-- 4. Package rates from Excel (COMO Cocoa 2027 + JOALI Maldives)
-- =============================================================================


INSERT INTO public.property_contracted_rates (
  property_id, contract_id, room_category, season_code, rate_basis,
  valid_from, valid_to, currency, cost_amount, cost_unit,
  package_nights, extra_night_amount,
  base_adults, base_children,
  board, includes_breakfast, includes_lunch, includes_dinner,
  includes_transfer, includes_green_tax, min_nights,
  sort_order, inclusions, notes, active
)
SELECT
  c.property_id, c.id, v.room, v.season, 'package',
  v.vf::date, v.vt::date, 'USD', v.amount, 'package',
  v.nights, v.extra,
  v.base_a, 0,
  'HB', true, false, true,
  true, true, v.nights,
  v.sort, '["breakfast","three-course dinner","shared speedboat","green tax","10% SC","taxes"]'::jsonb, 'CCI 2027 Asia/ME package.', true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (VALUES
  ('Dhoni Water Villa', 'high', '2027-01-06', '2027-04-04', 4510.0, 3, 1055.0, 2, 10),
  ('Dhoni Water Villa', 'high', '2027-01-06', '2027-04-04', 5385.0, 4, NULL, 2, 20),
  ('Dhoni Water Villa', 'low', '2027-04-05', '2027-09-30', 3380.0, 3, 685.0, 2, 30),
  ('Dhoni Water Villa', 'low', '2027-04-05', '2027-09-30', 3895.0, 4, NULL, 2, 40),
  ('Dhoni Water Villa', 'shoulder', '2027-10-01', '2027-12-19', 3800.0, 3, 805.0, 2, 50),
  ('Dhoni Water Villa', 'shoulder', '2027-10-01', '2027-12-19', 4390.0, 4, NULL, 2, 60),
  ('Dhoni Loft Water Villa', 'high', '2027-01-06', '2027-04-04', 5100.0, 3, 1235.0, 2, 70),
  ('Dhoni Loft Water Villa', 'high', '2027-01-06', '2027-04-04', 6115.0, 4, NULL, 2, 80),
  ('Dhoni Loft Water Villa', 'low', '2027-04-05', '2027-09-30', 3670.0, 3, 775.0, 2, 90),
  ('Dhoni Loft Water Villa', 'low', '2027-04-05', '2027-09-30', 4255.0, 4, NULL, 2, 100),
  ('Dhoni Loft Water Villa', 'shoulder', '2027-10-01', '2027-12-19', 4100.0, 3, 899.0, 2, 110),
  ('Dhoni Loft Water Villa', 'shoulder', '2027-10-01', '2027-12-19', 4760.0, 4, NULL, 2, 120),
  ('Loft Water Villa', 'high', '2027-01-06', '2027-04-04', 5485.0, 3, 1355.0, 2, 130),
  ('Loft Water Villa', 'high', '2027-01-06', '2027-04-04', 6595.0, 4, NULL, 2, 140),
  ('Loft Water Villa', 'low', '2027-04-05', '2027-09-30', 3770.0, 3, 805.0, 2, 150),
  ('Loft Water Villa', 'low', '2027-04-05', '2027-09-30', 4390.0, 4, NULL, 2, 160),
  ('Loft Water Villa', 'shoulder', '2027-10-01', '2027-12-19', 4200.0, 3, 930.0, 2, 170),
  ('Loft Water Villa', 'shoulder', '2027-10-01', '2027-12-19', 4880.0, 4, NULL, 2, 180),
  ('One Bedroom Water Villa with Pool', 'high', '2027-01-06', '2027-04-04', 6295.0, 3, 1610.0, 2, 190),
  ('One Bedroom Water Villa with Pool', 'high', '2027-01-06', '2027-04-04', 7595.0, 4, NULL, 2, 200),
  ('One Bedroom Water Villa with Pool', 'low', '2027-04-05', '2027-09-30', 4375.0, 3, 990.0, 2, 210),
  ('One Bedroom Water Villa with Pool', 'low', '2027-04-05', '2027-09-30', 5120.0, 4, NULL, 2, 220),
  ('One Bedroom Water Villa with Pool', 'shoulder', '2027-10-01', '2027-12-19', 4800.0, 3, 1115.0, 2, 230),
  ('One Bedroom Water Villa with Pool', 'shoulder', '2027-10-01', '2027-12-19', 5625.0, 4, NULL, 2, 240)
) AS v(room, season, vf, vt, amount, nights, extra, base_a, sort)
WHERE lower(prop.name) = 'como cocoa island'
  AND c.booking_code = 'CCI_ASIAME_27_150827'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracted_rates r
    WHERE r.property_id = c.property_id
      AND r.contract_id = c.id
      AND r.room_category = v.room
      AND r.season_code = v.season
      AND r.valid_from = v.vf::date
      AND r.rate_basis = 'package'
      AND r.package_nights = v.nights
      AND r.cost_amount = v.amount
  );


INSERT INTO public.property_contracted_rates (
  property_id, contract_id, room_category, season_code, rate_basis,
  valid_from, valid_to, currency, cost_amount, cost_unit,
  package_nights, extra_night_amount,
  base_adults, base_children,
  board, includes_breakfast, includes_lunch, includes_dinner,
  includes_transfer, includes_green_tax, min_nights,
  sort_order, inclusions, notes, active
)
SELECT
  c.property_id, c.id, v.room, v.season, 'package',
  v.vf::date, v.vt::date, 'USD', v.amount, 'package',
  v.nights, v.extra,
  v.base_a, 0,
  'HB', true, false, true,
  true, true, v.nights,
  v.sort, '["half board","shared return seaplane","green tax","welcome amenities"]'::jsonb, 'Joyful Journey 2026 package.', true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (VALUES
  ('Water Villa with Pool', 'shoulder', '2026-10-11', '2026-12-20', 8734.0, 3, 2146.0, 2, 10),
  ('Water Villa with Pool', 'shoulder', '2026-10-11', '2026-12-20', 10880.0, 4, NULL, 2, 20),
  ('Luxury Water Villa with Pool', 'shoulder', '2026-10-11', '2026-12-20', 9167.0, 3, 2290.0, 2, 30),
  ('Luxury Water Villa with Pool', 'shoulder', '2026-10-11', '2026-12-20', 11457.0, 4, NULL, 2, 40),
  ('Luxury Sunset Water Villa with Pool', 'shoulder', '2026-10-11', '2026-12-20', 9681.0, 3, 2462.0, 2, 50),
  ('Luxury Sunset Water Villa with Pool', 'shoulder', '2026-10-11', '2026-12-20', 12143.0, 4, NULL, 2, 60),
  ('Two Bedroom Water Villa with Pool', 'shoulder', '2026-10-11', '2026-12-20', 18004.0, 3, 4471.0, 2, 70),
  ('Two Bedroom Water Villa with Pool', 'shoulder', '2026-10-11', '2026-12-20', 22474.0, 4, NULL, 2, 80),
  ('Beach Villa with Pool', 'shoulder', '2026-10-11', '2026-12-20', 9935.0, 3, 2546.0, 2, 90),
  ('Beach Villa with Pool', 'shoulder', '2026-10-11', '2026-12-20', 12482.0, 4, NULL, 2, 100),
  ('Luxury Beach Villa with Pool', 'shoulder', '2026-10-11', '2026-12-20', 10994.0, 3, 2899.0, 2, 110),
  ('Luxury Beach Villa with Pool', 'shoulder', '2026-10-11', '2026-12-20', 13894.0, 4, NULL, 2, 120),
  ('Two Bedroom Beach Villa with Pool', 'shoulder', '2026-10-11', '2026-12-20', 21986.0, 3, 5798.0, 2, 130),
  ('Two Bedroom Beach Villa with Pool', 'shoulder', '2026-10-11', '2026-12-20', 27785.0, 4, NULL, 2, 140)
) AS v(room, season, vf, vt, amount, nights, extra, base_a, sort)
WHERE lower(prop.name) = 'joali maldives'
  AND c.booking_code = 'JOYJ26'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracted_rates r
    WHERE r.property_id = c.property_id
      AND r.contract_id = c.id
      AND r.room_category = v.room
      AND r.season_code = v.season
      AND r.valid_from = v.vf::date
      AND r.rate_basis = 'package'
      AND r.package_nights = v.nights
      AND r.cost_amount = v.amount
  );


-- =============================================================================
-- 5. COMO Cocoa Island 2026 packages (PDF)
-- =============================================================================


INSERT INTO public.property_contracted_rates (
  property_id, contract_id, room_category, season_code, rate_basis,
  valid_from, valid_to, currency, cost_amount, cost_unit,
  package_nights, extra_night_amount,
  base_adults, board, includes_breakfast, includes_dinner,
  includes_transfer, includes_green_tax, min_nights,
  sort_order, inclusions, notes, active
)
SELECT
  c.property_id, c.id, v.room, v.season, 'package',
  v.vf::date, v.vt::date, 'USD', v.amount, 'package',
  v.nights, v.extra,
  2, 'HB', true, true, true, true, v.nights,
  v.sort,
  '["breakfast","three-course dinner","shared speedboat","green tax"]'::jsonb,
  'CCI 2026 Asia/ME package from PDF.',
  true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (VALUES
  ('Dhoni Water Villa', 'low', '2026-08-21', '2026-09-30', 3115, 3, 675, 10),
  ('Dhoni Water Villa', 'low', '2026-08-21', '2026-09-30', 3840, 4, NULL, 20),
  ('Dhoni Loft Water Villa', 'low', '2026-08-21', '2026-09-30', 3440, 3, 765, 30),
  ('Dhoni Loft Water Villa', 'low', '2026-08-21', '2026-09-30', 4190, 4, NULL, 40),
  ('Loft Water Villa', 'low', '2026-08-21', '2026-09-30', 3540, 3, 795, 50),
  ('Loft Water Villa', 'low', '2026-08-21', '2026-09-30', 4310, 4, NULL, 60),
  ('One Bedroom Water Villa with Pool', 'low', '2026-08-21', '2026-09-30', 4140, 3, 980, 70),
  ('One Bedroom Water Villa with Pool', 'low', '2026-08-21', '2026-09-30', 5055, 4, NULL, 80),
  ('Dhoni Water Villa', 'shoulder', '2026-10-01', '2026-12-19', 3565, 3, 805, 90),
  ('Dhoni Water Villa', 'shoulder', '2026-10-01', '2026-12-19', 4350, 4, NULL, 100),
  ('Dhoni Loft Water Villa', 'shoulder', '2026-10-01', '2026-12-19', 3780, 3, 899, 110),
  ('Dhoni Loft Water Villa', 'shoulder', '2026-10-01', '2026-12-19', 4720, 4, NULL, 120),
  ('Loft Water Villa', 'shoulder', '2026-10-01', '2026-12-19', 3965, 3, 930, 130),
  ('Loft Water Villa', 'shoulder', '2026-10-01', '2026-12-19', 4840, 4, NULL, 140),
  ('One Bedroom Water Villa with Pool', 'shoulder', '2026-10-01', '2026-12-19', 4570, 3, 1115, 150),
  ('One Bedroom Water Villa with Pool', 'shoulder', '2026-10-01', '2026-12-19', 5585, 4, NULL, 160)
) AS v(room, season, vf, vt, amount, nights, extra, sort)
WHERE lower(prop.name) = 'como cocoa island'
  AND c.booking_code = 'CCI_ASIAME_26_150826'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracted_rates r
    WHERE r.property_id = c.property_id AND r.contract_id = c.id
      AND r.room_category = v.room AND r.season_code = v.season
      AND r.package_nights = v.nights AND r.cost_amount = v.amount
  );


-- =============================================================================
-- 6. COMO Maalifushi packages (PDF 2026 + 2027)
-- =============================================================================


INSERT INTO public.property_contracted_rates (
  property_id, contract_id, room_category, season_code, rate_basis,
  valid_from, valid_to, currency, cost_amount, cost_unit,
  package_nights, extra_night_amount,
  base_adults, board, includes_breakfast, includes_dinner,
  includes_transfer, includes_green_tax, min_nights,
  sort_order, inclusions, notes, active
)
SELECT
  c.property_id, c.id, v.room, v.season, 'package',
  v.vf::date, v.vt::date, 'USD', v.amount, 'package',
  v.nights, v.extra,
  2, 'HB', true, true, true, true, v.nights,
  v.sort,
  '["breakfast","dinner","shared seaplane","massage","snorkel","photo shoot","green tax"]'::jsonb,
  'CMF package from PDF.',
  true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (VALUES
  ('Beach Suite', 'high', '2027-01-06', '2027-04-04', 6005, 4, 885, 10),
  ('Water Suite', 'high', '2027-01-06', '2027-04-04', 6555, 4, 1020, 20),
  ('Beach Villa', 'high', '2027-01-06', '2027-04-04', 7110, 4, 1160, 30),
  ('Water Villa', 'high', '2027-01-06', '2027-04-04', 7660, 4, 1300, 40),
  ('Beach Suite', 'low', '2027-04-05', '2027-09-30', 4900, 4, 610, 50),
  ('Water Suite', 'low', '2027-04-05', '2027-09-30', 5240, 4, 690, 60),
  ('Beach Villa', 'low', '2027-04-05', '2027-09-30', 5340, 4, 715, 70),
  ('Water Villa', 'low', '2027-04-05', '2027-09-30', 5645, 4, 795, 80),
  ('Beach Suite', 'shoulder', '2027-10-01', '2027-12-19', 5285, 4, 705, 90),
  ('Water Suite', 'shoulder', '2027-10-01', '2027-12-19', 5599, 4, 780, 100),
  ('Beach Villa', 'shoulder', '2027-10-01', '2027-12-19', 6030, 4, 890, 110),
  ('Water Villa', 'shoulder', '2027-10-01', '2027-12-19', 6370, 4, 975, 120)
) AS v(room, season, vf, vt, amount, nights, extra, sort)
WHERE lower(prop.name) = 'como maalifushi'
  AND c.booking_code = 'CMF_ASIAME_27_150826'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracted_rates r
    WHERE r.property_id = c.property_id AND r.contract_id = c.id
      AND r.room_category = v.room AND r.season_code = v.season
      AND r.package_nights = v.nights AND r.cost_amount = v.amount
  );


INSERT INTO public.property_contracted_rates (
  property_id, contract_id, room_category, season_code, rate_basis,
  valid_from, valid_to, currency, cost_amount, cost_unit,
  package_nights, extra_night_amount,
  base_adults, board, includes_breakfast, includes_dinner,
  includes_transfer, includes_green_tax, min_nights,
  sort_order, inclusions, notes, active
)
SELECT
  c.property_id, c.id, v.room, v.season, 'package',
  v.vf::date, v.vt::date, 'USD', v.amount, 'package',
  v.nights, v.extra,
  2, 'HB', true, true, true, true, v.nights,
  v.sort,
  '["breakfast","dinner","shared seaplane","massage","snorkel","photo shoot","green tax"]'::jsonb,
  'CMF package from PDF.',
  true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (VALUES
  ('Beach Suite', 'low', '2026-08-21', '2026-09-30', 4800, 4, 610, 10),
  ('Water Suite', 'low', '2026-08-21', '2026-09-30', 5140, 4, 690, 20),
  ('Beach Villa', 'low', '2026-08-21', '2026-09-30', 5240, 4, 715, 30),
  ('Water Villa', 'low', '2026-08-21', '2026-09-30', 5545, 4, 795, 40),
  ('Beach Suite', 'shoulder', '2026-10-01', '2026-12-19', 5185, 4, 705, 50),
  ('Water Suite', 'shoulder', '2026-10-01', '2026-12-19', 5499, 4, 780, 60),
  ('Beach Villa', 'shoulder', '2026-10-01', '2026-12-19', 5930, 4, 890, 70),
  ('Water Villa', 'shoulder', '2026-10-01', '2026-12-19', 6270, 4, 975, 80)
) AS v(room, season, vf, vt, amount, nights, extra, sort)
WHERE lower(prop.name) = 'como maalifushi'
  AND c.booking_code = 'CMF_ASIAME_26_150826'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracted_rates r
    WHERE r.property_id = c.property_id AND r.contract_id = c.id
      AND r.room_category = v.room AND r.season_code = v.season
      AND r.package_nights = v.nights AND r.cost_amount = v.amount
  );


-- =============================================================================
-- 7. JOALI BEING Well-Living Journey packages
-- =============================================================================


INSERT INTO public.property_contracted_rates (
  property_id, contract_id, room_category, season_code, rate_basis,
  valid_from, valid_to, currency, cost_amount, cost_unit,
  package_nights, extra_night_amount,
  base_adults, board, includes_breakfast, includes_dinner,
  includes_transfer, includes_green_tax, min_nights,
  sort_order, inclusions, notes, active
)
SELECT
  c.property_id, c.id, v.room, v.season, 'package',
  v.vf::date, v.vt::date, 'USD', v.amount, 'package',
  v.nights, v.extra,
  2, 'HB', true, true, true, true, v.nights,
  v.sort,
  '["half board","shared return seaplane","green tax","wellbeing consultation"]'::jsonb,
  'WELE26 Well-Living Journey.',
  true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (VALUES
  ('Ocean Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 8489, 3, 1930, 10),
  ('Ocean Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 10418, 4, NULL, 20),
  ('Sunset Ocean Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 8590, 3, 2098, 30),
  ('Sunset Ocean Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 10688, 4, NULL, 40),
  ('Grand Ocean Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 9093, 3, 2266, 50),
  ('Grand Ocean Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 11359, 4, NULL, 60),
  ('Sunset Grand Ocean Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 9574, 3, 2426, 70),
  ('Sunset Grand Ocean Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 12000, 4, NULL, 80),
  ('Two Bedroom Ocean Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 18461, 3, 4623, 90),
  ('Two Bedroom Ocean Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 23084, 4, NULL, 100),
  ('Beach Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 9574, 3, 2426, 110),
  ('Beach Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 12000, 4, NULL, 120),
  ('Grand Beach Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 10331, 3, 2678, 130),
  ('Grand Beach Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 13009, 4, NULL, 140),
  ('Two Bedroom Beach Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 19904, 3, 5104, 150),
  ('Two Bedroom Beach Pool Villa', 'shoulder', '2026-10-11', '2026-12-20', 25007, 4, NULL, 160)
) AS v(room, season, vf, vt, amount, nights, extra, sort)
WHERE lower(prop.name) = 'joali being'
  AND c.booking_code = 'WELE26'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracted_rates r
    WHERE r.property_id = c.property_id AND r.contract_id = c.id
      AND r.room_category = v.room AND r.package_nights = v.nights AND r.cost_amount = v.amount
  );


-- =============================================================================
-- 8. Add-ons (green tax / conservation / transfers / extras)
-- =============================================================================

INSERT INTO public.property_rate_addons (
  property_id, contract_id, addon_type, name, amount, currency, unit,
  age_from, age_to, valid_from, valid_to, mandatory, notes, active
)
SELECT c.property_id, c.id, 'green_tax', 'Green Tax', 12, 'USD', 'per_person_per_night',
       2, NULL, c.valid_from, c.valid_to, true, 'Age 2+; outside villa rate', true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
WHERE lower(prop.name) = 'waldorf astoria maldives ithaafushi'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_rate_addons a
    WHERE a.property_id = c.property_id AND a.contract_id = c.id AND a.name = 'Green Tax'
  );

INSERT INTO public.property_rate_addons (
  property_id, contract_id, addon_type, name, amount, currency, unit,
  age_from, valid_from, valid_to, mandatory, notes, active
)
SELECT c.property_id, c.id, 'other', 'Conservation contribution (ex-GST)', 2500, 'INR', 'per_person_per_night',
       NULL, c.valid_from, c.valid_to, true, 'Plus 18% GST. Mandatory at booking.', true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
WHERE lower(prop.name) LIKE 'suján %'
  AND c.source_document_name = 'Rate Contract - KFT Corporation -2026-27.pdf'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_rate_addons a
    WHERE a.property_id = c.property_id AND a.contract_id = c.id AND a.name = 'Conservation contribution (ex-GST)'
  );

-- JOALI seaplane listed amounts (packages already include for base occupancy)
INSERT INTO public.property_rate_addons (
  property_id, contract_id, addon_type, name, amount, currency, unit,
  age_from, age_to, valid_from, valid_to, mandatory, notes, active
)
SELECT c.property_id, c.id, v.atype, v.name, v.amount, 'USD', v.unit,
       v.age_from, v.age_to, c.valid_from, c.valid_to, false, v.notes, true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (VALUES
  ('transfer'::text, 'Shared return seaplane — adult 12+'::text, 1148::numeric, 'per_person'::text, 12::int, NULL::int, 'Listed on Joyful Journey / Well-Living PDFs; included in package for base guests'::text),
  ('transfer', 'Shared return seaplane — child 2-11.99', 355, 'per_person', 2, 11, 'Included in package for base child occupancy rules per PDF'),
  ('extra_adult', 'Extra adult supplement (package night)', 329, 'per_person_per_night', 12, NULL, 'From JOALI package grids'),
  ('extra_child', 'Extra child supplement 6-11.99 (package night)', 178, 'per_person_per_night', 6, 11, 'From JOALI package grids')
) AS v(atype, name, amount, unit, age_from, age_to, notes)
WHERE lower(prop.name) IN ('joali maldives', 'joali being')
  AND c.booking_code IN ('JOYJ26', 'WELE26')
  AND NOT EXISTS (
    SELECT 1 FROM public.property_rate_addons a
    WHERE a.property_id = c.property_id AND a.contract_id = c.id AND a.name = v.name
  );


-- =============================================================================
-- 9. Key commercial offers
-- =============================================================================

INSERT INTO public.property_contract_offers (
  property_id, contract_id, name, offer_type, percent_off_villa,
  valid_from, valid_to, min_nights, notes, active
)
SELECT c.property_id, c.id, v.name, v.offer_type, v.pct,
       v.vf::date, v.vt::date, v.min_n, v.notes, true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (VALUES
  ('Early Bird 10%'::text, 'percent_off_villa'::text, 10::numeric, '2027-01-10'::text, '2027-05-07'::text, NULL::int, 'Book 90 days before arrival; excludes 10-17 Mar'::text),
  ('Live Unforgettable 15% (4N+)', 'percent_off_villa', 15, '2027-05-08', '2027-12-20', 4, 'Also unlocks HB + shared yacht transfers per PDF'),
  ('Live Unforgettable 20% (7N+)', 'percent_off_villa', 20, '2027-05-08', '2027-12-20', 7, 'Also unlocks HB + shared yacht transfers per PDF')
) AS v(name, offer_type, pct, vf, vt, min_n, notes)
WHERE lower(prop.name) = 'waldorf astoria maldives ithaafushi'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contract_offers o
    WHERE o.property_id = c.property_id AND o.contract_id = c.id AND o.name = v.name
  );

INSERT INTO public.property_contract_offers (
  property_id, contract_id, name, offer_type, free_board,
  valid_from, valid_to, book_by, notes, active
)
SELECT c.property_id, c.id, 'Flavours of JOALI — complimentary Half Board', 'free_board_upgrade', 'HB',
       '2026-10-11', '2026-12-20', '2026-12-20',
       'Promo FLJ26. Combinable with contracted offers. From JMG 2026 PDF.', true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
WHERE lower(prop.name) IN ('joali maldives', 'joali being')
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contract_offers o
    WHERE o.property_id = c.property_id AND o.name = 'Flavours of JOALI — complimentary Half Board'
  );

INSERT INTO public.property_contract_offers (
  property_id, contract_id, name, offer_type,
  valid_from, valid_to, book_by, notes, active
)
SELECT c.property_id, c.id, v.name, 'other',
       v.vf::date, v.vt::date, v.book_by::date, v.notes, true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (VALUES
  ('como cocoa island'::text, 'CCI_ASIAME_26_150826'::text, 'Loft Upgrade Escape COMOLOFT26'::text, '2026-08-21'::text, '2026-12-19'::text, '2026-09-30'::text, 'Book Dhoni Loft → complimentary upgrade to Loft Water Villa'::text),
  ('como cocoa island', 'CCI_ASIAME_27_150827', 'Loft Upgrade Escape COMOLOFT27', '2027-04-05', '2027-12-19', '2027-03-31', 'Book Dhoni Loft → complimentary upgrade to Loft Water Villa'),
  ('como maalifushi', 'CMF_ASIAME_26_150826', 'Upgrade Your Escape COMOWATER26', '2026-08-21', '2026-12-19', '2026-09-30', 'Beach Suite→Water Suite / Beach Villa→Water Villa'),
  ('como maalifushi', 'CMF_ASIAME_27_150826', 'Upgrade Your Escape COMOWATER27', '2027-04-05', '2027-12-19', '2027-03-31', 'Beach Suite→Water Suite / Beach Villa→Water Villa')
) AS v(prop_name, code, name, vf, vt, book_by, notes)
WHERE lower(prop.name) = v.prop_name
  AND c.booking_code = v.code
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contract_offers o
    WHERE o.property_id = c.property_id AND o.contract_id = c.id AND o.name = v.name
  );


-- =============================================================================
-- 10. Link properties → Atlas entities when Atlas seed already ran
-- =============================================================================

UPDATE public.properties p
SET curated_hotel_id = e.id,
    updated_at = now()
FROM public.kb_entities e
WHERE e.entity_type = 'hotel' AND e.active = true
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
WHERE p.curated_hotel_id = e.id
  AND (e.property_id IS DISTINCT FROM p.id OR e.contract_status IS DISTINCT FROM 'contracted');
