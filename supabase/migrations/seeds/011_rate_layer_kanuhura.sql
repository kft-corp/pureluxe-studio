-- Optional Six Senses Kanuhura contract digitization for migration 011_rate_layer.sql.
-- NOT a migration — supabase db push ignores this folder.
--
-- Source PDFs (Downloads / founder share):
--   Six Senses Kanuhura Wholesale Rates Agreement 2026-2027 - KFT Corporation.pdf
--   Six Senses Kanuhura - India Package 2026 - Low & Shoulder Seasons (1).pdf
--
-- Depends on:
--   migrations/011_rate_layer.sql
--   seeds/011_rate_layer.sql (Maldives destination_profiles — run that first)
--
-- Safe to re-run: each insert skips rows that already exist.
-- Do not run on production until ops has reviewed the nets.

-- =============================================================================
-- 1. property
-- =============================================================================

INSERT INTO public.properties (
  name, brand, chain, destination, city, country, region,
  property_type, destination_profile_id, default_currency,
  min_markup_percent, contracting_entity_name,
  reservations_email, general_phone, booking_notes, active
)
SELECT
  'Six Senses Kanuhura',
  'Six Senses',
  'Six Senses',
  'Maldives',
  'Kanuhura Island, Lhaviyani Atoll',
  'Maldives',
  'Maldives',
  'resort',
  p.id,
  'USD',
  25,
  'KFT Corporation',
  'reservations-maldives@sixsenses.com',
  '+960 662 0044',
  'Book direct to resort. India package code SSK26IN. Min markup 25% on villa. Confidential nets.',
  true
FROM public.destination_profiles p
WHERE lower(p.canonical_name) = 'maldives'
  AND NOT EXISTS (
    SELECT 1 FROM public.properties x
    WHERE lower(x.name) = 'six senses kanuhura'
  );

-- =============================================================================
-- 2. contracts (wholesale + India package)
-- =============================================================================

INSERT INTO public.property_contracts (
  property_id, name, contract_type, market,
  valid_from, valid_to, currency, booking_code,
  min_markup_percent, source_document_name,
  policies, benefits, payout, notes, active
)
SELECT
  prop.id,
  'Wholesale Rates Agreement 2026-2027 — KFT Corporation',
  'wholesale',
  'worldwide',
  '2026-12-22',
  '2027-12-21',
  'USD',
  NULL,
  25,
  'Six Senses Kanuhura Wholesale Rates Agreement 2026-2027 - KFT Corporation.pdf',
  jsonb_build_object(
    'stay_rules', jsonb_build_array(
      'Peak min 5N for 1BR; Peak min 7N for 2BR/3BR listed categories',
      'No checkout on 2026-12-30 or 2026-12-31',
      'Up to 2 children 0-11 complimentary room share (green tax extra)',
      'Groups = 5+ villas — separate quote',
      'Check-in 14:00 / check-out 12:00'
    ),
    'payment_rules', jsonb_build_array(
      jsonb_build_object('season', 'peak', 'prepay_days', 90, 'cancel_days', 90, 'charge_pct', 100),
      jsonb_build_object('season', 'high', 'prepay_days', 30, 'cancel_days', 30, 'charge_pct', 100),
      jsonb_build_object('season', 'low', 'prepay_days', 14, 'cancel_days', 14, 'charge_pct', 100),
      jsonb_build_object('season', 'shoulder', 'prepay_days', 21, 'cancel_days', 21, 'charge_pct', 100)
    ),
    'transfer_policies', jsonb_build_array(
      'Shared seaplane ~40 min via Manta Air',
      'Daylight only; same-day if MLE arrive by 15:30 / depart after 09:00',
      'Luggage 25kg + 5kg hand; cancel/amend ≤3 days = 100%'
    ),
    'legal', jsonb_build_object(
      'direct_book_only', true,
      'confidential', true,
      'no_ota_bedbank_resell', true,
      'min_markup_percent', 25
    )
  ),
  jsonb_build_array(
    jsonb_build_object(
      'type', 'honeymoon',
      'min_nights', 4,
      'requires', 'marriage_certificate_within_6_months',
      'items', jsonb_build_array(
        'Welcome amenity', 'Departure gift', 'Personalized bicycle tags',
        'Wedding cake OR anniversary cake', 'Sparkling wine on arrival',
        'Lunch at Drift OR 60-min couple massage before 14:00'
      ),
      'combinable_with_offers', true
    ),
    jsonb_build_object(
      'type', 'anniversary',
      'min_nights', 4,
      'requires', 'marriage_certificate; anniversary during stay or within 30 days',
      'items', jsonb_build_array(
        'Welcome amenity', 'Departure gift', 'Personalized bicycle tags',
        'Anniversary cake', 'Sparkling wine on arrival',
        'Lunch at Drift OR 60-min couple massage before 14:00'
      ),
      'combinable_with_offers', true
    )
  ),
  jsonb_build_object(
    'account_name', 'LEISURE OCEANS PRIVATE LIMITED',
    'bank_name', 'State Bank of India (SBI)',
    'account_number', '12608 91372 0203 USD',
    'swift', 'SBINMVMVXXX',
    'currency', 'USD',
    'correspondent_bank', 'BANK OF AMERICA NEW YORK',
    'correspondent_swift', 'BOFAUS3N'
  ),
  'Issued 2026-09-03. Partner: KFT Corporation (sonali@kft.travel; sanjay@kft.travel). Rates include 10% SC + 17% GST + breakfast. Green tax NOT included.',
  true
FROM public.properties prop
WHERE lower(prop.name) = 'six senses kanuhura'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracts c
    WHERE c.property_id = prop.id
      AND c.source_document_name ILIKE '%Wholesale Rates Agreement 2026-2027%'
  );

INSERT INTO public.property_contracts (
  property_id, name, contract_type, market,
  valid_from, valid_to, currency, booking_code,
  min_markup_percent, source_document_name,
  policies, benefits, payout, notes, active
)
SELECT
  prop.id,
  'India Offer — Low & Shoulder Seasons 2026',
  'package',
  'india',
  '2026-04-13',
  '2026-12-21',
  'USD',
  'SSK26IN',
  25,
  'Six Senses Kanuhura - India Package 2026 - Low & Shoulder Seasons (1).pdf',
  jsonb_build_object(
    'stay_rules', jsonb_build_array(
      'Minimum 3 nights',
      'India market only; new bookings only',
      'Not combinable with other contracted/tactical offers (honeymoon/anniversary OK)',
      'Not for 5+ villa groups',
      'Stop sale with 2 business days notice',
      'Quote booking code SSK26IN'
    ),
    'payment_rules', jsonb_build_array('As per main wholesale contract'),
    'transfer_policies', jsonb_build_array(
      'Shared return seaplane included for rate-based occupancy',
      'Extra adult seaplane USD 695 return; child 2-11 complimentary'
    )
  ),
  jsonb_build_array(
    jsonb_build_object(
      'type', 'package_value_adds',
      'min_nights', 4,
      'items', jsonb_build_array(
        '60-min couple massage (before 14:00) for 4N+',
        'Floating breakfast once per villa',
        'Group house reef snorkel',
        'Cinema Under the Stars',
        'Ice cream throughout stay',
        'Snorkel gear rental'
      )
    )
  ),
  '{}'::jsonb,
  'Package for 2A in 1BR / 4A in 2BR. Includes HB (B+D), shared seaplane, 10%+17% tax, green tax USD12 pp/night. Kids 0-11 (upto 2) complimentary FB from kids menu.',
  true
FROM public.properties prop
WHERE lower(prop.name) = 'six senses kanuhura'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracts c
    WHERE c.property_id = prop.id AND c.booking_code = 'SSK26IN'
  );

-- =============================================================================
-- 3. wholesale contracted_rates (per_night, BB) — all villas × 4 seasons
-- =============================================================================

INSERT INTO public.property_contracted_rates (
  property_id, contract_id, room_category, season_code, rate_basis,
  valid_from, valid_to, currency, cost_amount, cost_unit,
  base_adults, base_children, max_adults, max_children,
  board, includes_breakfast, includes_lunch, includes_dinner,
  includes_transfer, includes_green_tax, min_nights, units_count,
  sort_order, inclusions, notes, active
)
SELECT
  c.property_id, c.id, v.room, v.season, 'nightly',
  v.vf::date, v.vt::date, 'USD', v.amount, 'per_night',
  v.base_a, 0, v.max_a, v.max_c,
  'BB', true, false, false,
  false, false, v.min_n, v.units,
  v.sort,
  '["breakfast at The Market","10% service charge","17% GST"]'::jsonb,
  'Wholesale net villa/night. Green tax + transfers + meals extra. Extra adult USD 285/night BB where allowed.',
  true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (
  VALUES
  -- Peak 22.12.26–06.01.27
  ('Beach Villa', 'peak', '2026-12-22', '2027-01-06', 2450, 2, 2, 0, 5, 6, 10),
  ('Beach Villa with Pool', 'peak', '2026-12-22', '2027-01-06', 2700, 2, 3, 1, 5, 10, 20),
  ('Deluxe Beach Villa with Pool', 'peak', '2026-12-22', '2027-01-06', 3090, 2, 3, 1, 5, 18, 30),
  ('Water Villa with Pool', 'peak', '2026-12-22', '2027-01-06', 3560, 2, 3, 2, 5, 15, 40),
  ('Deluxe Beach Villa Suite with Pool', 'peak', '2026-12-22', '2027-01-06', 3680, 2, 3, 2, 5, 6, 50),
  ('Family Water Villa with Pool', 'peak', '2026-12-22', '2027-01-06', 3950, 2, 3, 2, 5, 4, 60),
  ('Two Bedroom Beach Villa with Pool', 'peak', '2026-12-22', '2027-01-06', 7000, 4, 4, 2, 7, 5, 70),
  ('Two Bedroom Beach Villa Suite with Pool', 'peak', '2026-12-22', '2027-01-06', 7700, 4, 4, 2, 7, 7, 80),
  ('Two Bedroom Water Villa with Pool', 'peak', '2026-12-22', '2027-01-06', 10100, 4, 4, 2, 7, 1, 90),
  ('Three Bedroom Beach Villa Suite with Pool', 'peak', '2026-12-22', '2027-01-06', 13790, 6, 6, 3, 7, 1, 100),
  ('Beach Retreat with Pool', 'peak', '2026-12-22', '2027-01-06', 6380, 2, 3, 2, 5, 7, 110),
  ('Family Beach Retreat with Pool', 'peak', '2026-12-22', '2027-01-06', 6735, 2, 3, 2, 5, 3, 120),
  ('Two Bedroom Beach Retreat with Pool', 'peak', '2026-12-22', '2027-01-06', 14285, 4, 4, 2, 7, 1, 130),
  ('Three Bedroom Beach Reserve', 'peak', '2026-12-22', '2027-01-06', 20930, 6, 6, 3, 7, 1, 140),

  -- High 07.01.27–11.04.27
  ('Beach Villa', 'high', '2027-01-07', '2027-04-11', 1470, 2, 2, 0, 1, 6, 10),
  ('Beach Villa with Pool', 'high', '2027-01-07', '2027-04-11', 1690, 2, 3, 1, 3, 10, 20),
  ('Deluxe Beach Villa with Pool', 'high', '2027-01-07', '2027-04-11', 1975, 2, 3, 1, 3, 18, 30),
  ('Water Villa with Pool', 'high', '2027-01-07', '2027-04-11', 2130, 2, 3, 2, 3, 15, 40),
  ('Deluxe Beach Villa Suite with Pool', 'high', '2027-01-07', '2027-04-11', 2320, 2, 3, 2, 3, 6, 50),
  ('Family Water Villa with Pool', 'high', '2027-01-07', '2027-04-11', 2480, 2, 3, 2, 3, 4, 60),
  ('Two Bedroom Beach Villa with Pool', 'high', '2027-01-07', '2027-04-11', 4100, 4, 4, 2, 3, 5, 70),
  ('Two Bedroom Beach Villa Suite with Pool', 'high', '2027-01-07', '2027-04-11', 4450, 4, 4, 2, 3, 7, 80),
  ('Two Bedroom Water Villa with Pool', 'high', '2027-01-07', '2027-04-11', 6330, 4, 4, 2, 3, 1, 90),
  ('Three Bedroom Beach Villa Suite with Pool', 'high', '2027-01-07', '2027-04-11', 8020, 6, 6, 3, 3, 1, 100),
  ('Beach Retreat with Pool', 'high', '2027-01-07', '2027-04-11', 3725, 2, 3, 2, 3, 7, 110),
  ('Family Beach Retreat with Pool', 'high', '2027-01-07', '2027-04-11', 4080, 2, 3, 2, 3, 3, 120),
  ('Two Bedroom Beach Retreat with Pool', 'high', '2027-01-07', '2027-04-11', 7975, 4, 4, 2, 3, 1, 130),
  ('Three Bedroom Beach Reserve', 'high', '2027-01-07', '2027-04-11', 12225, 6, 6, 3, 3, 1, 140),

  -- Low 12.04.27–30.09.27
  ('Beach Villa', 'low', '2027-04-12', '2027-09-30', 1080, 2, 2, 0, 1, 6, 10),
  ('Beach Villa with Pool', 'low', '2027-04-12', '2027-09-30', 1210, 2, 3, 1, 3, 10, 20),
  ('Deluxe Beach Villa with Pool', 'low', '2027-04-12', '2027-09-30', 1440, 2, 3, 1, 3, 18, 30),
  ('Water Villa with Pool', 'low', '2027-04-12', '2027-09-30', 1550, 2, 3, 2, 3, 15, 40),
  ('Deluxe Beach Villa Suite with Pool', 'low', '2027-04-12', '2027-09-30', 1650, 2, 3, 2, 3, 6, 50),
  ('Family Water Villa with Pool', 'low', '2027-04-12', '2027-09-30', 1850, 2, 3, 2, 3, 4, 60),
  ('Two Bedroom Beach Villa with Pool', 'low', '2027-04-12', '2027-09-30', 2950, 4, 4, 2, 3, 5, 70),
  ('Two Bedroom Beach Villa Suite with Pool', 'low', '2027-04-12', '2027-09-30', 3375, 4, 4, 2, 3, 7, 80),
  ('Two Bedroom Water Villa with Pool', 'low', '2027-04-12', '2027-09-30', 4840, 4, 4, 2, 3, 1, 90),
  ('Three Bedroom Beach Villa Suite with Pool', 'low', '2027-04-12', '2027-09-30', 6265, 6, 6, 3, 3, 1, 100),
  ('Beach Retreat with Pool', 'low', '2027-04-12', '2027-09-30', 2885, 2, 3, 2, 3, 7, 110),
  ('Family Beach Retreat with Pool', 'low', '2027-04-12', '2027-09-30', 3240, 2, 3, 2, 3, 3, 120),
  ('Two Bedroom Beach Retreat with Pool', 'low', '2027-04-12', '2027-09-30', 6225, 4, 4, 2, 3, 1, 130),
  ('Three Bedroom Beach Reserve', 'low', '2027-04-12', '2027-09-30', 9570, 6, 6, 3, 3, 1, 140),

  -- Shoulder 01.10.27–21.12.27
  ('Beach Villa', 'shoulder', '2027-10-01', '2027-12-21', 1230, 2, 2, 0, 1, 6, 10),
  ('Beach Villa with Pool', 'shoulder', '2027-10-01', '2027-12-21', 1380, 2, 3, 1, 3, 10, 20),
  ('Deluxe Beach Villa with Pool', 'shoulder', '2027-10-01', '2027-12-21', 1650, 2, 3, 1, 3, 18, 30),
  ('Water Villa with Pool', 'shoulder', '2027-10-01', '2027-12-21', 1810, 2, 3, 2, 3, 15, 40),
  ('Deluxe Beach Villa Suite with Pool', 'shoulder', '2027-10-01', '2027-12-21', 1990, 2, 3, 2, 3, 6, 50),
  ('Family Water Villa with Pool', 'shoulder', '2027-10-01', '2027-12-21', 2135, 2, 3, 2, 3, 4, 60),
  ('Two Bedroom Beach Villa with Pool', 'shoulder', '2027-10-01', '2027-12-21', 3480, 4, 4, 2, 3, 5, 70),
  ('Two Bedroom Beach Villa Suite with Pool', 'shoulder', '2027-10-01', '2027-12-21', 4040, 4, 4, 2, 3, 7, 80),
  ('Two Bedroom Water Villa with Pool', 'shoulder', '2027-10-01', '2027-12-21', 5550, 4, 4, 2, 3, 1, 90),
  ('Three Bedroom Beach Villa Suite with Pool', 'shoulder', '2027-10-01', '2027-12-21', 7150, 6, 6, 3, 3, 1, 100),
  ('Beach Retreat with Pool', 'shoulder', '2027-10-01', '2027-12-21', 3205, 2, 3, 2, 3, 7, 110),
  ('Family Beach Retreat with Pool', 'shoulder', '2027-10-01', '2027-12-21', 3555, 2, 3, 2, 3, 3, 120),
  ('Two Bedroom Beach Retreat with Pool', 'shoulder', '2027-10-01', '2027-12-21', 7040, 4, 4, 2, 3, 1, 130),
  ('Three Bedroom Beach Reserve', 'shoulder', '2027-10-01', '2027-12-21', 10970, 6, 6, 3, 3, 1, 140)
) AS v(room, season, vf, vt, amount, base_a, max_a, max_c, min_n, units, sort)
WHERE lower(prop.name) = 'six senses kanuhura'
  AND c.source_document_name ILIKE '%Wholesale Rates Agreement 2026-2027%'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracted_rates r
    WHERE r.property_id = c.property_id
      AND r.contract_id = c.id
      AND r.room_category = v.room
      AND r.season_code = v.season
      AND r.rate_basis = 'nightly'
  );

-- =============================================================================
-- 4. India package rates — 3N + extra_night (4N/5N via cost math)
-- =============================================================================

INSERT INTO public.property_contracted_rates (
  property_id, contract_id, room_category, season_code, rate_basis,
  valid_from, valid_to, currency, cost_amount, cost_unit,
  package_nights, extra_night_amount,
  base_adults, base_children, max_adults, max_children,
  board, includes_breakfast, includes_lunch, includes_dinner,
  includes_transfer, includes_green_tax, min_nights,
  sort_order, inclusions, notes, active
)
SELECT
  c.property_id, c.id, v.room, v.season, 'package',
  v.vf::date, v.vt::date, 'USD', v.amt_3n, 'package',
  3, v.extra,
  v.base_a, 0, v.max_a, v.max_c,
  'HB', true, false, true,
  true, true, 3,
  v.sort,
  '["breakfast","dinner HB","shared return seaplane","green tax","10% SC","17% GST","kids 0-11 FB kids menu (upto 2)"]'::jsonb,
  'India package SSK26IN. Amount = 3N package for base occupancy. Extra night from PDF.',
  true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (
  VALUES
  -- Low 13 Apr – 30 Sep 2026
  ('Water Villa with Pool', 'low', '2026-04-13', '2026-09-30', 3710, 955, 2, 3, 2, 10),
  ('Family Water Villa with Pool', 'low', '2026-04-13', '2026-09-30', 4250, 1135, 2, 3, 2, 20),
  ('Beach Villa with Pool', 'low', '2026-04-13', '2026-09-30', 3045, 730, 2, 3, 1, 30),
  ('Deluxe Beach Villa with Pool', 'low', '2026-04-13', '2026-09-30', 3515, 890, 2, 3, 1, 40),
  ('Deluxe Beach Villa Suite with Pool', 'low', '2026-04-13', '2026-09-30', 3890, 1015, 2, 3, 2, 50),
  ('Beach Retreat with Pool', 'low', '2026-04-13', '2026-09-30', 6115, 1755, 2, 3, 2, 60),
  ('Two Bedroom Beach Villa with Pool', 'low', '2026-04-13', '2026-09-30', 7150, 1820, 4, 4, 2, 70),
  ('Two Bedroom Beach Villa Suite with Pool', 'low', '2026-04-13', '2026-09-30', 7915, 2075, 4, 4, 2, 80),
  ('Two Bedroom Water Villa with Pool', 'low', '2026-04-13', '2026-09-30', 10555, 2950, 4, 4, 2, 90),

  -- Shoulder 1 Oct – 21 Dec 2026
  ('Water Villa with Pool', 'shoulder', '2026-10-01', '2026-12-21', 4705, 1200, 2, 3, 2, 10),
  ('Family Water Villa with Pool', 'shoulder', '2026-10-01', '2026-12-21', 5350, 1415, 2, 3, 2, 20),
  ('Beach Villa with Pool', 'shoulder', '2026-10-01', '2026-12-21', 3790, 895, 2, 3, 1, 30),
  ('Deluxe Beach Villa with Pool', 'shoulder', '2026-10-01', '2026-12-21', 4365, 1085, 2, 3, 1, 40),
  ('Deluxe Beach Villa Suite with Pool', 'shoulder', '2026-10-01', '2026-12-21', 5030, 1305, 2, 3, 2, 50),
  ('Beach Retreat with Pool', 'shoulder', '2026-10-01', '2026-12-21', 7435, 2110, 2, 3, 2, 60),
  ('Two Bedroom Beach Villa with Pool', 'shoulder', '2026-10-01', '2026-12-21', 9040, 2275, 4, 4, 2, 70),
  ('Two Bedroom Beach Villa Suite with Pool', 'shoulder', '2026-10-01', '2026-12-21', 10140, 2640, 4, 4, 2, 80),
  ('Two Bedroom Water Villa with Pool', 'shoulder', '2026-10-01', '2026-12-21', 13185, 3655, 4, 4, 2, 90)
) AS v(room, season, vf, vt, amt_3n, extra, base_a, max_a, max_c, sort)
WHERE lower(prop.name) = 'six senses kanuhura'
  AND c.booking_code = 'SSK26IN'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracted_rates r
    WHERE r.property_id = c.property_id
      AND r.contract_id = c.id
      AND r.room_category = v.room
      AND r.season_code = v.season
      AND r.rate_basis = 'package'
      AND r.package_nights = 3
  );

-- Split-stay packages (fixed 4N)
INSERT INTO public.property_contracted_rates (
  property_id, contract_id, room_category, season_code, rate_basis,
  valid_from, valid_to, currency, cost_amount, cost_unit,
  package_nights, base_adults, max_adults, max_children,
  board, includes_breakfast, includes_dinner, includes_transfer, includes_green_tax,
  min_nights, sort_order, inclusions, notes, active
)
SELECT
  c.property_id, c.id, v.room, v.season, 'package',
  v.vf::date, v.vt::date, 'USD', v.amount, 'package',
  4, 2, 3, v.max_c,
  'HB', true, true, true, true,
  4, v.sort,
  '["split stay 2N+2N","breakfast","dinner HB","shared return seaplane","green tax"]'::jsonb,
  'India package split stay SSK26IN',
  true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (
  VALUES
  ('2N Beach Villa with Pool + 2N Water Villa with Pool', 'low', '2026-04-13', '2026-09-30', 4223, 1, 200),
  ('2N Deluxe Beach Villa with Pool + 2N Water Villa with Pool', 'low', '2026-04-13', '2026-09-30', 4533, 1, 210),
  ('2N Deluxe Beach Villa Suite with Pool + 2N Water Villa with Pool', 'low', '2026-04-13', '2026-09-30', 4786, 2, 220),
  ('2N Beach Retreat with Pool + 2N Water Villa with Pool', 'low', '2026-04-13', '2026-09-30', 6268, 2, 230),
  ('2N Beach Villa with Pool + 2N Water Villa with Pool', 'shoulder', '2026-10-01', '2026-12-21', 5293, 1, 200),
  ('2N Deluxe Beach Villa with Pool + 2N Water Villa with Pool', 'shoulder', '2026-10-01', '2026-12-21', 5678, 1, 210),
  ('2N Deluxe Beach Villa Suite with Pool + 2N Water Villa with Pool', 'shoulder', '2026-10-01', '2026-12-21', 6118, 2, 220),
  ('2N Beach Retreat with Pool + 2N Water Villa with Pool', 'shoulder', '2026-10-01', '2026-12-21', 7725, 2, 230)
) AS v(room, season, vf, vt, amount, max_c, sort)
WHERE lower(prop.name) = 'six senses kanuhura'
  AND c.booking_code = 'SSK26IN'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contracted_rates r
    WHERE r.property_id = c.property_id
      AND r.contract_id = c.id
      AND r.room_category = v.room
      AND r.season_code = v.season
  );

-- =============================================================================
-- 5. rate add-ons (wholesale + India extras)
-- =============================================================================

INSERT INTO public.property_rate_addons (
  property_id, contract_id, addon_type, name, amount, currency, unit,
  age_from, age_to, valid_from, valid_to, board_required, mandatory, notes, active
)
SELECT
  c.property_id, c.id, v.atype, v.name, v.amount, 'USD', v.unit,
  v.age_from, v.age_to, v.vf::date, v.vt::date, v.board_req, v.mandatory, v.notes, true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (
  VALUES
  ('green_tax'::text, 'Green Tax'::text, 12::numeric, 'per_person_per_night'::text, 2::int, NULL::int, '2026-12-22'::text, '2027-12-21'::text, NULL::text, true, 'Age 2+; not in villa rate'::text),
  ('transfer', 'Seaplane return — adult 12+', 720, 'per_person', 12, NULL::int, '2026-12-22', '2027-12-21', NULL::text, false, 'Shared seaplane return'),
  ('transfer', 'Seaplane return — child 2-11', 419, 'per_person', 2, 11, '2026-12-22', '2027-12-21', NULL::text, false, 'Shared seaplane return'),
  ('transfer', 'Seaplane return — infant under 2', 0, 'per_person', 0, 1, '2026-12-22', '2027-12-21', NULL::text, false, 'Complimentary'),
  ('meal', 'Half Board (Dinner)', 155, 'per_person_per_night', 12, NULL::int, '2026-12-22', '2027-12-21', NULL::text, false, 'Adult; child 6-11 = 77.50; under 5 free with parents order'),
  ('meal', 'Full Board (Lunch & Dinner)', 220, 'per_person_per_night', 12, NULL::int, '2026-12-22', '2027-12-21', NULL::text, false, 'Adult; child 6-11 = 110'),
  ('meal', 'Upgrade HB to FB', 65, 'per_person_per_night', 12, NULL::int, '2026-12-22', '2027-12-21', 'HB', false, 'Adult only'),
  ('beverage', 'Saint non-alcoholic package', 99, 'per_person_per_night', 12, NULL::int, '2027-01-07', '2027-12-21', 'HB', false, 'Not festive; child 2-11 = 49.50'),
  ('beverage', 'Sinner alcoholic package', 179, 'per_person_per_night', 12, NULL::int, '2027-01-07', '2027-12-21', 'HB', false, 'Not festive; adults only'),
  ('extra_adult', 'Extra adult BB', 285, 'per_person_per_night', 12, NULL::int, '2026-12-22', '2027-12-21', 'BB', false, 'Where villa allows; green tax extra'),
  ('festive', 'Christmas Eve supplement BB', 450, 'per_person', 12, NULL::int, '2026-12-24', '2026-12-24', 'BB', true, 'Child 6-11 50%; under 5 free'),
  ('festive', 'Christmas Eve supplement HB/FB', 350, 'per_person', 12, NULL::int, '2026-12-24', '2026-12-24', 'HB', true, 'Child 6-11 50%; under 5 free'),
  ('festive', 'New Year Eve supplement BB', 550, 'per_person', 12, NULL::int, '2026-12-31', '2026-12-31', 'BB', true, 'Child 6-11 50%; under 5 free'),
  ('festive', 'New Year Eve supplement HB/FB', 450, 'per_person', 12, NULL::int, '2026-12-31', '2026-12-31', 'HB', true, 'Child 6-11 50%; under 5 free')
) AS v(atype, name, amount, unit, age_from, age_to, vf, vt, board_req, mandatory, notes)
WHERE lower(prop.name) = 'six senses kanuhura'
  AND c.source_document_name ILIKE '%Wholesale Rates Agreement 2026-2027%'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_rate_addons a
    WHERE a.property_id = c.property_id
      AND a.contract_id = c.id
      AND a.name = v.name
  );

INSERT INTO public.property_rate_addons (
  property_id, contract_id, addon_type, name, amount, currency, unit,
  age_from, age_to, valid_from, valid_to, board_required, mandatory, notes, active
)
SELECT
  c.property_id, c.id, v.atype, v.name, v.amount, 'USD', v.unit,
  v.age_from, v.age_to, '2026-04-13'::date, '2026-12-21'::date, v.board_req, false, v.notes, true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (
  VALUES
  ('extra_adult'::text, 'Extra adult HB (India package)'::text, 285::numeric, 'per_person_per_night'::text, 12::int, NULL::int, 'HB'::text, 'PDF additional person'::text),
  ('meal', 'Full Board supplement (India package)', 65, 'per_person_per_night', 12, NULL::int, 'HB', 'Adult upgrade'),
  ('beverage', 'Sinner Alcoholic Beverage Supplement', 179, 'per_person_per_night', 12, NULL::int, NULL::text, 'Adult / night'),
  ('beverage', 'Saint Non-alcoholic Beverage Supplement', 99, 'per_person_per_night', 12, NULL::int, NULL::text, 'Adult / night'),
  ('green_tax', 'Green Tax (extra guest)', 12, 'per_person_per_night', 2, NULL::int, NULL::text, 'For additional guests 2+'),
  ('transfer', 'Extra adult seaplane return (India package)', 695, 'per_person', 12, NULL::int, NULL::text, 'Child 2-11 complimentary')
) AS v(atype, name, amount, unit, age_from, age_to, board_req, notes)
WHERE lower(prop.name) = 'six senses kanuhura'
  AND c.booking_code = 'SSK26IN'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_rate_addons a
    WHERE a.property_id = c.property_id
      AND a.contract_id = c.id
      AND a.name = v.name
  );

-- =============================================================================
-- 6. contracted offers (wholesale)
-- =============================================================================

INSERT INTO public.property_contract_offers (
  property_id, contract_id, name, offer_type,
  percent_off_villa, free_board, transfer_discount_percent,
  valid_from, valid_to, book_by, min_nights,
  blackout_dates, combinable_flags, notes, active
)
SELECT
  c.property_id, c.id, v.name, v.otype,
  v.pct, v.free_board, v.xfer_pct,
  v.vf::date, v.vt::date, v.book_by::date, v.min_n,
  v.blackouts::jsonb, v.flags::jsonb, v.notes, true
FROM public.property_contracts c
JOIN public.properties prop ON prop.id = c.property_id
CROSS JOIN (
  VALUES
  (
    'Peak 25% off villa'::text, 'percent_off_villa'::text, 25::numeric, NULL::text, NULL::numeric,
    '2026-12-22'::text, '2027-01-06'::text, '2026-10-31'::text, 5::int,
    '["2026-12-30","2026-12-31","2027-01-01"]'::text,
    '{"combinable_with_family":true}'::text,
    'Book by 31 Oct 2026. Peak min nights 5/7 by category.'::text
  ),
  (
    'High 25% off villa', 'percent_off_villa', 25, NULL::text, NULL::numeric,
    '2027-01-07', '2027-04-11', NULL::text, 3,
    '[]', '{"combinable_with_family":true}', 'Min 3N'
  ),
  (
    'High complimentary HB upgrade', 'free_board_upgrade', NULL::numeric, 'HB', NULL::numeric,
    '2027-01-07', '2027-04-11', '2026-10-31', 3,
    '[]', '{"combinable_with_family":true}', 'Book by 31 Oct 2026'
  ),
  (
    'Low 35% off villa + 25% seaplane + HB', 'percent_off_villa', 35, 'HB', 25,
    '2027-04-12', '2027-09-30', NULL::text, 3,
    '[]', '{"combinable_with_family":true}', 'Min 3N'
  ),
  (
    'Shoulder 30% off villa + 25% seaplane', 'percent_off_villa', 30, NULL::text, 25,
    '2027-10-01', '2027-12-21', NULL::text, 3,
    '[]', '{"combinable_with_family":true}', 'Min 3N'
  ),
  (
    'Shoulder complimentary HB upgrade', 'free_board_upgrade', NULL::numeric, 'HB', NULL::numeric,
    '2027-10-01', '2027-12-21', '2027-06-30', 3,
    '[]', '{"combinable_with_family":true}', 'Book by 30 Jun 2027'
  ),
  (
    'Family offer High — kids same meal plan', 'family', NULL::numeric, NULL::text, NULL::numeric,
    '2027-01-07', '2027-04-11', NULL::text, 3,
    '[]',
    '{"excludes_beach_villa":true,"excludes_beach_villa_with_pool":true}',
    'Up to 2 children 0-11 kids menu; excl Beach Villa & Beach Villa with Pool'
  ),
  (
    'Family offer Low — kids meal + free seaplane', 'family', NULL::numeric, NULL::text, NULL::numeric,
    '2027-04-12', '2027-09-30', NULL::text, 3,
    '[]',
    '{"excludes_beach_villa":true,"excludes_beach_villa_with_pool":true}',
    'Kids meal + complimentary return seaplane for up to 2 children 0-11'
  ),
  (
    'Family offer Shoulder — kids meal + 25% child seaplane', 'family', NULL::numeric, NULL::text, 25,
    '2027-10-01', '2027-12-21', NULL::text, 3,
    '[]',
    '{"excludes_beach_villa":true,"excludes_beach_villa_with_pool":true}',
    'Kids meal + 25% off child seaplane for up to 2 children 0-11'
  )
) AS v(name, otype, pct, free_board, xfer_pct, vf, vt, book_by, min_n, blackouts, flags, notes)
WHERE lower(prop.name) = 'six senses kanuhura'
  AND c.source_document_name ILIKE '%Wholesale Rates Agreement 2026-2027%'
  AND NOT EXISTS (
    SELECT 1 FROM public.property_contract_offers o
    WHERE o.property_id = c.property_id
      AND o.contract_id = c.id
      AND o.name = v.name
  );
