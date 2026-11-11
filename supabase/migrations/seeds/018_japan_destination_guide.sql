-- Japan Destination Guide → Atlas KB place seed.
-- NOT a migration — supabase db push ignores this folder.
--
-- Source: docs/founder docs/Japan-Destination-Guide.docx
--   Japan Destination Guide — PureLuxe Atlas KB
--   2026-11-03 · Keshav Arya
--
-- Seeds place facts + guide hotels + experience bank for Trip Builder Japan tests.
-- Hotels: insert missing / repair Unspecified city / luxury_band / consortia.
-- Experiences: activities + restaurants (kb_scraped, client_ready=false; no advisor_take).
--
-- Depends on:
--   migrations/016_atlas_kb.sql (+ wave columns used by hotel_details)
--   seeds/016_atlas_kb.sql (Japan country + base cities/hotels)
-- Regenerate entities section:
--   python supabase/migrations/seeds/_generate/generate_japan_destination_guide.py
--
-- Safe to re-run: WHERE NOT EXISTS / natural-key guards.
-- No advisor_take writes (DB trigger requires SET LOCAL kb.writer_kind = 'human').

-- =============================================================================
-- 0. Source
-- =============================================================================

INSERT INTO public.kb_sources (name, source_type, terms_notes, active)
SELECT
  'Japan Destination Guide — PureLuxe Atlas KB (2026-11-03)',
  'advisor_note',
  'Founder destination guide (Keshav Arya). Visa e-Visa notes from secondary sources.',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_sources s
  WHERE lower(s.name) = lower('Japan Destination Guide — PureLuxe Atlas KB (2026-11-03)')
);

-- =============================================================================
-- 1. Japan country facts (kb_country_facts) — visa lives in kb_country_visa_rules
-- =============================================================================

INSERT INTO public.kb_country_facts (
  country_id,
  currency_code,
  currency_notes,
  best_season,
  safety_notes,
  general_notes,
  kb_tier,
  provenance
)
SELECT
  c.id,
  'JPY',
  'Yen. Cards widely accepted in hotels and restaurants; cash still needed at small restaurants, shrines and rural ryokan.',
  'Best windows: late March to mid-April (cherry blossom) and late October to late November (autumn colour). Both book out early — lock Kyoto hotels 9 to 12 months ahead. Peak PureLuxe view: sakura end-March to early April; plum blossom Feb–Mar also sellable. Avoid Golden Week (29 Apr–5 May). Autumn colour Oct–Nov; ski Dec–Mar. Value windows: February, May and June. May balances good weather with far fewer crowds than sakura. Hokkaido sold mainly for skiing; summer suits outdoors clients.',
  'Japan is safe and punctual. Logistics mistakes are expensive — advisor value is sequencing, access and restaurant reservations. Year-end shutdown (~29 Dec–3 Jan) closes many restaurants and shops. Tattoos can be restricted at public onsen (private onsen baths avoid this); no tipping; shoes off at ryokan; quiet on trains.',
  $japan_general$
Japan rewards 10 to 14 nights for a first visit: Tokyo and Kyoto are the spine; one or two nature or onsen stops make it feel luxury rather than a city tour.

Getting there: open-jaw Tokyo + Osaka is best; direct flights to Tokyo when available. Prefer Haneda over Narita when there is a choice.

Getting around: Shinkansen links Tokyo, Kyoto/Osaka, Hiroshima and Kanazawa (Tokyo–Kyoto ~2h15). Luggage forwarding (takkyubin) between hotels is standard and cheap. Private drivers suit Hakone, Kyoto day trips and families.

Restaurants: top restaurants book 1 to 3 months out; many need a hotel concierge or member card. Omakase counters often cannot take dietary changes at short notice. PureLuxe has vegetarian / Jain restaurant suggestions.

Common pitfalls: trying to do too much; touristy FOMO instead of experiencing the place; not booking key pieces in advance.

Ideal length (first-time): 10 nights — Tokyo 5, Kyoto/Osaka 4, 1 ryokan night. Return-client length still to confirm.

Season snapshot (approx.): Spring Mar–May 8–22°C; early summer Jun–Jul humid/rainy on main islands; Aug 30–37°C in Tokyo/Kyoto/Osaka (Obon ~13–16 Aug); autumn Sep typhoon-prone then Oct–Nov 10–22°C; winter Dec–Feb 0–10°C in Tokyo/Kyoto, heavy snow in Hokkaido/Nagano.

Updated with Keshav's answers 3 Nov 2026; hand-authored advisor_take still to be written.
$japan_general$,
  'kb_verified',
  'kb'
FROM public.kb_countries c
WHERE c.country_code = 'JP'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_country_facts f WHERE f.country_id = c.id
  );

-- If a thin row already exists, fill empty columns from the guide (do not overwrite advisor_take).
UPDATE public.kb_country_facts f
SET
  currency_code = COALESCE(NULLIF(trim(f.currency_code), ''), 'JPY'),
  currency_notes = COALESCE(
    NULLIF(trim(f.currency_notes), ''),
    'Yen. Cards widely accepted in hotels and restaurants; cash still needed at small restaurants, shrines and rural ryokan.'
  ),
  best_season = COALESCE(
    NULLIF(trim(f.best_season), ''),
    'Best windows: late March to mid-April (cherry blossom) and late October to late November (autumn colour). Lock Kyoto hotels 9–12 months ahead. Avoid Golden Week. Value: Feb, May, June.'
  ),
  safety_notes = COALESCE(
    NULLIF(trim(f.safety_notes), ''),
    'Safe and punctual. Year-end shutdown ~29 Dec–3 Jan. Public onsen may restrict tattoos; no tipping; shoes off at ryokan; quiet on trains.'
  ),
  general_notes = COALESCE(
    NULLIF(trim(f.general_notes), ''),
    'First visit: 10–14 nights. Spine Tokyo + Kyoto plus nature/onsen. Open-jaw Tokyo/Osaka; prefer Haneda. Shinkansen + takkyubin. Top restaurants 1–3 months out.'
  ),
  kb_tier = CASE WHEN f.kb_tier = 'llm_general' THEN 'kb_verified' ELSE f.kb_tier END,
  updated_at = now()
FROM public.kb_countries c
WHERE f.country_id = c.id
  AND c.country_code = 'JP';

-- =============================================================================
-- 2. Visa — Indian passport → Japan (PureLuxe default = sticker / embassy)
-- =============================================================================

INSERT INTO public.kb_country_visa_rules (
  country_id,
  passport_country_code,
  summary,
  details,
  entry_type,
  official_url,
  kb_tier,
  provenance,
  last_reviewed_at,
  active
)
SELECT
  c.id,
  'IN',
  'Indian passport holders need a visa for Japan. PureLuxe default is the sticker (embassy) visa via VFS; allow about 2 weeks. A tourist e-Visa also exists (single entry, up to 90 days) but is not the PureLuxe default.',
  $japan_visa$
PureLuxe process (Nov 2026):
- Visa type: sticker visa (PureLuxe default). Tourist e-Visa (single entry, up to 90 days) also exists for Indian passport holders (reported since April 2024) — secondary sources; not PureLuxe default.
- Where to apply: VFS Global centres in India for the Embassy of Japan (New Delhi) and consulates (Mumbai, Chennai, Kolkata, Bengaluru).
- Fee: Rs 3,100 per person.
- Processing: about 2 weeks.
- Entry notes: PureLuxe can assist with filing. e-Visa route is for air arrivals only.
- Typical documents: passport valid >6 months; signed visa application form; covering letter (purpose of visit); company GST certificate copy (self-employed); hotel vouchers; day-to-day itinerary in Japan; personal income tax papers for 3 years; original personal bank statements (last 3 months, updated); 2 colour photos on white background, 2×2 inches, face covering 80%; confirmed return ticket.

Advisor tips: allow 2 weeks when promising dates; build hotel confirmations into the itinerary early (application asks for them). Further tips from Keshav still to add.

Sources (secondary, not official): Business Today Jan 2026, BankBazaar, GoDigit, Visa Fee Calculator. Re-check official Embassy / VFS guidance before confirming to clients.
$japan_visa$,
  'embassy',
  NULL,
  'kb_verified',
  'kb',
  timestamptz '2026-11-03',
  true
FROM public.kb_countries c
WHERE c.country_code = 'JP'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_country_visa_rules v
    WHERE v.country_id = c.id
      AND v.passport_country_code = 'IN'
  );

-- =============================================================================
-- 3. Cities from the guide that may be missing in 016
-- =============================================================================

INSERT INTO public.kb_cities (country_id, name, destination_profile_id, active)
SELECT co.id, v.city, NULL, true
FROM (VALUES
  ('Nara'),
  ('Niseko'),
  ('Sapporo'),
  ('Furano'),
  ('Kanazawa'),
  ('Takayama'),
  ('Hiroshima'),
  ('Miyajima'),
  ('Naoshima'),
  ('Nikko')
) AS v(city)
JOIN public.kb_countries co ON co.country_code = 'JP'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.kb_cities ci
  WHERE ci.country_id = co.id
    AND lower(ci.name) = lower(v.city)
);

-- =============================================================================
-- 4. Destination facts (locations within Japan)
-- =============================================================================

INSERT INTO public.kb_destination_facts (
  city_id,
  best_time_to_visit,
  ideal_length_of_stay,
  vibe,
  staff_notes,
  kb_tier,
  provenance
)
SELECT
  ci.id,
  v.best_time,
  v.length,
  v.vibe,
  v.staff,
  v.tier,
  'kb'
FROM (VALUES
  (
    'Tokyo',
    'Mar to May, Oct to Nov',
    '4 to 7 nights (first-time anchor often 5)',
    'Dense, modern, food and design capital; neighbourhoods differ sharply (Marunouchi/Ginza polished, Roppongi/Azabu international, Shinjuku/Shibuya energetic).',
    'Neighbourhood (PureLuxe): Ginza most popular with Indian clients for shopping; Otemachi and Nihonbashi also in demand; Akasaka good value; Roppongi for food and nightlife.',
    'kb_verified'
  ),
  (
    'Kyoto',
    'Late Mar to Apr, mid to late Nov',
    '3 to 4 nights',
    'Temples, gardens, geisha districts, traditional ryokan; Higashiyama and Gion historic, Kyoto Station/Karasuma central.',
    'Neighbourhood (PureLuxe): area around the river is best; Ritz-Carlton has the best luxury location; Park Hyatt also well placed. Book 9–12 months ahead for sakura.',
    'kb_verified'
  ),
  (
    'Osaka',
    'Year-round',
    '1 to 2 nights (often combined with Nara / Kyoto)',
    'Street food and nightlife; Nara deer park and temples as a day trip.',
    'Stay around Umeda or Osaka Station. Good for food lovers and families (Universal Studios Japan).',
    'kb_scraped'
  ),
  (
    'Nara',
    'Year-round',
    'Day trip from Osaka/Kyoto (or 1 night)',
    'Deer park, Todai-ji and Kasuga Taisha — classic day trip from Osaka/Kyoto.',
    'Usually sold as Osaka/Nara pairing rather than a standalone multi-night stay.',
    'kb_scraped'
  ),
  (
    'Hakone',
    'Oct to Mar for clear Fuji views',
    '1 to 2 nights',
    'Onsen ryokan with Fuji views; easy ~1.5h from Tokyo.',
    'Couples, slow luxury, short trips. Strong honeymoon / ryokan night.',
    'kb_scraped'
  ),
  (
    'Niseko',
    'Jan to Feb (ski); Jul to Aug (summer)',
    '3 to 5 nights',
    'Powder ski in winter; lavender and cool air in summer (wider Hokkaido).',
    'Hokkaido sold mainly for skiing. Pair with Tokyo/Kyoto on ski+cities trips.',
    'kb_scraped'
  ),
  (
    'Sapporo',
    'Jan to Feb (Snow Festival); Jul to Aug',
    '2 to 3 nights within a 3–5 night Hokkaido block',
    'Hokkaido city hub; winter festival and summer base for Furano/outdoors.',
    'Summer alternative when replacing Osaka/Hiroshima for cooler weather.',
    'kb_scraped'
  ),
  (
    'Furano',
    'Jul to Aug (lavender); winter ski nearby',
    '2 to 3 nights within a Hokkaido block',
    'Lavender fields and cool summer air; ski region access in winter.',
    'Summer Hokkaido outdoor escape.',
    'kb_scraped'
  ),
  (
    'Kanazawa',
    'Apr to Nov',
    '2 nights',
    'Preserved Edo streets, gardens, craft; gateway toward Japan Alps / Takayama.',
    'Return visitors and culture-led itineraries.',
    'kb_scraped'
  ),
  (
    'Takayama',
    'Apr to Nov',
    '1 to 2 nights (often with Kanazawa)',
    'Preserved streets and Japan Alps character.',
    'Guide notes Takayama has no past PureLuxe itinerary experience-bank entries yet.',
    'kb_scraped'
  ),
  (
    'Hiroshima',
    'Mar to May, Oct to Nov',
    '1 to 2 nights (or day trip from Osaka)',
    'Peace memorial, Seto Inland Sea access; slower history-led pace.',
    'Often appears as Osaka day trip; also used on Grand Japan with Miyajima.',
    'kb_scraped'
  ),
  (
    'Miyajima',
    'Mar to May, Oct to Nov',
    '1 night or day trip with Hiroshima',
    'Shrine island (Itsukushima) on the Seto Inland Sea.',
    'Pair with Hiroshima on extended itineraries.',
    'kb_scraped'
  ),
  (
    'Naoshima',
    'Mar to Nov',
    '2 nights',
    'Contemporary art islands and design hotels (Setouchi).',
    'Art lovers / return visitors. Optional add-on on Grand Japan. No past itinerary experience-bank entries yet.',
    'kb_scraped'
  ),
  (
    'Setouchi',
    'Mar to Nov',
    '2 nights',
    'Contemporary art islands and design hotels spanning the Seto Inland Sea.',
    'Use with Naoshima / art-led clients.',
    'kb_scraped'
  ),
  (
    'Okinawa',
    'Apr to Jun, Sep to Oct',
    '3 to 4 nights',
    'Subtropical beaches, Ryukyu culture; ties into Maldives-style beach clients.',
    'Beach add-on / honeymoon finish. Families also fit.',
    'kb_scraped'
  ),
  (
    'Miyako Island',
    'Apr to Jun, Sep to Oct',
    '3 to 4 nights (within Okinawa/Miyako beach finish)',
    'Beach island finish for Okinawa / Miyako stays.',
    'Rosewood Miyakojima sits here in hotel lists.',
    'kb_scraped'
  ),
  (
    'Nikko',
    'Apr to Nov (outdoor); year-round for shrine',
    '1 to 2 nights',
    'UNESCO Toshogu shrine; Lake Chuzenji outdoors (kayak, cycle, waterfalls).',
    'Extra location PureLuxe can add. Ritz-Carlton Nikko on Lake Chuzenji.',
    'kb_scraped'
  ),
  (
    'Okayama',
    'Apr to Nov',
    '1 to 2 nights (Kurashiki ryokan)',
    'Kurashiki canal town / ryokan stop on some culture routes.',
    'Ryokan Kurashiki listed under Okayama in hotel scoring.',
    'kb_scraped'
  )
) AS v(city, best_time, length, vibe, staff, tier)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_cities ci
  ON ci.country_id = co.id
 AND lower(ci.name) = lower(v.city)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_destination_facts f WHERE f.city_id = ci.id
);

-- =============================================================================
-- 5. Audience notes (trip_style constrained)
-- =============================================================================

INSERT INTO public.kb_destination_audience_notes (
  city_id, trip_style, note, kb_tier, provenance, active
)
SELECT ci.id, v.style, v.note, v.tier, 'kb', true
FROM (VALUES
  ('Tokyo', 'family', 'Strong for first-timers and families: food, shopping, DisneySea/Disneyland, neighbourhood variety. Keep hotel changes low on family trips.', 'kb_verified'),
  ('Tokyo', 'honeymoon', 'Food and design capital — pair polished neighbourhoods (Ginza/Otemachi/Nihonbashi) with a quieter ryokan or Hakone night.', 'kb_verified'),
  ('Kyoto', 'honeymoon', 'Culture, couples and honeymoon staple: temples, gardens, geisha districts, traditional ryokan. River-area hotels preferred.', 'kb_verified'),
  ('Kyoto', 'family', 'Works for culture-led families; plan early starts at crowdy sights (Fushimi, Arashiyama) and book key restaurants well ahead.', 'kb_scraped'),
  ('Osaka', 'family', 'Food lovers and families — Universal Studios Japan; Nara deer park as an easy day trip.', 'kb_scraped'),
  ('Hakone', 'honeymoon', 'Onsen ryokan with Fuji views; classic slow-luxury / honeymoon night ~1.5h from Tokyo.', 'kb_scraped'),
  ('Niseko', 'family', 'Ski powder Jan–Feb for families; summer escape Jul–Aug. Often 4–5 nights on ski+cities trips.', 'kb_scraped'),
  ('Okinawa', 'honeymoon', 'Beach finish after cities/onsen — Maldives-style beach clients. Apr–Jun and Sep–Oct preferred.', 'kb_scraped'),
  ('Okinawa', 'family', 'Beach add-on for families; 3–4 nights typical.', 'kb_scraped'),
  ('Naoshima', 'honeymoon', 'Art-island slow luxury for return visitors / design-led couples (Mar–Nov).', 'kb_scraped')
) AS v(city, style, note, tier)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_cities ci
  ON ci.country_id = co.id
 AND lower(ci.name) = lower(v.city)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_destination_audience_notes n
  WHERE n.city_id = ci.id
    AND n.trip_style = v.style
);

-- =============================================================================
-- 6. Suggested itinerary templates (kb_itineraries + items)
--    Night counts still draft per guide; lengthen later.
-- =============================================================================

INSERT INTO public.kb_itineraries (
  title, destination_summary, country_id, kb_tier, provenance, client_ready, active
)
SELECT
  v.title,
  v.summary,
  c.id,
  'kb_scraped',
  'kb',
  false,
  true
FROM (VALUES
  (
    'Classic Japan',
    '7 nights — Tokyo 3, Kyoto 3, Osaka 1 (fly out of Kansai). Suits first-timers on a tight schedule. First-time PureLuxe anchor prefers longer: Tokyo 5 + Kyoto/Osaka 4 + 1 ryokan.'
  ),
  (
    'Japan with onsen',
    '9 nights — Tokyo 3, Hakone 1, Kyoto 3, Osaka/Nara 2. Suits couples and slow luxury.'
  ),
  (
    'Culture and food',
    '12 nights — Tokyo 4, Kanazawa 2, Kyoto 4, Osaka 2. Food-led and culture-led clients.'
  ),
  (
    'Grand Japan',
    '14 nights — Tokyo 4, Hakone 1, Kyoto 4, Hiroshima/Miyajima 2, Osaka 2, plus Naoshima 1 optional. Return visitors / extended trips.'
  ),
  (
    'Japan ski and cities',
    '10 nights — Niseko 4 to 5, Tokyo 3, Kyoto 2 to 3 (Dec to Mar). Families, ski and festive travel.'
  )
) AS v(title, summary)
JOIN public.kb_countries c ON c.country_code = 'JP'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_itineraries i
  WHERE i.country_id = c.id
    AND lower(i.title) = lower(v.title)
);

-- Classic Japan
INSERT INTO public.kb_itinerary_items (itinerary_id, day_number, sort_order, entity_id, note)
SELECT i.id, v.day_number, v.sort_order, NULL, v.note
FROM public.kb_itineraries i
JOIN public.kb_countries c ON c.id = i.country_id AND c.country_code = 'JP'
CROSS JOIN (VALUES
  (1, 10, 'Tokyo — arrive; neighbourhood orientation (Ginza / Marunouchi area).'),
  (2, 10, 'Tokyo — city experiences (Asakusa, Meiji/Harajuku, or food evening).'),
  (3, 10, 'Tokyo — last city day; evening Shinkansen or overnight before Kyoto.'),
  (4, 10, 'Kyoto — temples / Higashiyama or Arashiyama (go early).'),
  (5, 10, 'Kyoto — Gion evening walk; tea ceremony or brewery if booked.'),
  (6, 10, 'Kyoto — final Kyoto day; transfer toward Osaka.'),
  (7, 10, 'Osaka — street food / Dotonbori; fly out of Kansai.')
) AS v(day_number, sort_order, note)
WHERE lower(i.title) = 'classic japan'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_itinerary_items x WHERE x.itinerary_id = i.id
  );

-- Japan with onsen
INSERT INTO public.kb_itinerary_items (itinerary_id, day_number, sort_order, entity_id, note)
SELECT i.id, v.day_number, v.sort_order, NULL, v.note
FROM public.kb_itineraries i
JOIN public.kb_countries c ON c.id = i.country_id AND c.country_code = 'JP'
CROSS JOIN (VALUES
  (1, 10, 'Tokyo — arrive.'),
  (2, 10, 'Tokyo — city day.'),
  (3, 10, 'Tokyo — city day; next day transfer to Hakone.'),
  (4, 10, 'Hakone — onsen ryokan / Fuji views (1 night).'),
  (5, 10, 'Kyoto — transfer; temples and gardens.'),
  (6, 10, 'Kyoto — culture day.'),
  (7, 10, 'Kyoto — final Kyoto day.'),
  (8, 10, 'Osaka/Nara — food and/or Nara day trip.'),
  (9, 10, 'Osaka/Nara — depart.')
) AS v(day_number, sort_order, note)
WHERE lower(i.title) = 'japan with onsen'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_itinerary_items x WHERE x.itinerary_id = i.id
  );

-- Culture and food
INSERT INTO public.kb_itinerary_items (itinerary_id, day_number, sort_order, entity_id, note)
SELECT i.id, v.day_number, v.sort_order, NULL, v.note
FROM public.kb_itineraries i
JOIN public.kb_countries c ON c.id = i.country_id AND c.country_code = 'JP'
CROSS JOIN (VALUES
  (1, 10, 'Tokyo — arrive.'),
  (2, 10, 'Tokyo — food and neighbourhoods.'),
  (3, 10, 'Tokyo — food and neighbourhoods.'),
  (4, 10, 'Tokyo — final Tokyo day.'),
  (5, 10, 'Kanazawa — Edo streets, gardens, craft.'),
  (6, 10, 'Kanazawa — second night / Alps gateway.'),
  (7, 10, 'Kyoto — transfer; temples.'),
  (8, 10, 'Kyoto — culture and dining.'),
  (9, 10, 'Kyoto — culture and dining.'),
  (10, 10, 'Kyoto — final Kyoto day.'),
  (11, 10, 'Osaka — food-led city time.'),
  (12, 10, 'Osaka — depart.')
) AS v(day_number, sort_order, note)
WHERE lower(i.title) = 'culture and food'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_itinerary_items x WHERE x.itinerary_id = i.id
  );

-- Grand Japan
INSERT INTO public.kb_itinerary_items (itinerary_id, day_number, sort_order, entity_id, note)
SELECT i.id, v.day_number, v.sort_order, NULL, v.note
FROM public.kb_itineraries i
JOIN public.kb_countries c ON c.id = i.country_id AND c.country_code = 'JP'
CROSS JOIN (VALUES
  (1, 10, 'Tokyo — arrive.'),
  (2, 10, 'Tokyo — city.'),
  (3, 10, 'Tokyo — city.'),
  (4, 10, 'Tokyo — final Tokyo day.'),
  (5, 10, 'Hakone — onsen night.'),
  (6, 10, 'Kyoto — transfer.'),
  (7, 10, 'Kyoto — temples / gardens.'),
  (8, 10, 'Kyoto — culture.'),
  (9, 10, 'Kyoto — final Kyoto day.'),
  (10, 10, 'Hiroshima / Miyajima — peace memorial and shrine island.'),
  (11, 10, 'Hiroshima / Miyajima — second day or onward.'),
  (12, 10, 'Osaka — city / food.'),
  (13, 10, 'Osaka — city / food.'),
  (14, 10, 'Optional Naoshima art night, else Osaka depart.')
) AS v(day_number, sort_order, note)
WHERE lower(i.title) = 'grand japan'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_itinerary_items x WHERE x.itinerary_id = i.id
  );

-- Japan ski and cities
INSERT INTO public.kb_itinerary_items (itinerary_id, day_number, sort_order, entity_id, note)
SELECT i.id, v.day_number, v.sort_order, NULL, v.note
FROM public.kb_itineraries i
JOIN public.kb_countries c ON c.id = i.country_id AND c.country_code = 'JP'
CROSS JOIN (VALUES
  (1, 10, 'Niseko — arrive; ski / settle.'),
  (2, 10, 'Niseko — ski day + private onsen/spa.'),
  (3, 10, 'Niseko — ski day.'),
  (4, 10, 'Niseko — ski day (stretch to 5th night if needed).'),
  (5, 10, 'Niseko — final ski morning; fly/transfer to Tokyo.'),
  (6, 10, 'Tokyo — city.'),
  (7, 10, 'Tokyo — city.'),
  (8, 10, 'Tokyo — final Tokyo day; Shinkansen to Kyoto.'),
  (9, 10, 'Kyoto — temples / winter city.'),
  (10, 10, 'Kyoto — final day; depart.')
) AS v(day_number, sort_order, note)
WHERE lower(i.title) = 'japan ski and cities'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_itinerary_items x WHERE x.itinerary_id = i.id
  );


-- >>> BEGIN GENERATED JAPAN GUIDE ENTITIES (re-run seeds/_generate/generate_japan_destination_guide.py)
-- =============================================================================
-- 7. Guide hotels (Japan Destination Guide) + city repairs
-- =============================================================================
-- Inserts missing hotels; re-points Japan Unspecified rows to the guide city;
-- upgrades description / luxury_band / consortia from the guide.
-- Safe to re-run.

-- 7a. Re-point known Unspecified Japan hotels to the correct city
UPDATE public.kb_entities e
SET
  city_id = ci.id,
  country_id = co.id,
  region_id = co.region_id,
  updated_at = now()
FROM (VALUES
  ('six-senses-kyoto', 'Kyoto'),
  ('ana-intercontinental-tokyo', 'Tokyo'),
  ('kimpton-shinjuku-tokyo', 'Tokyo'),
  ('hotel-indigo-tokyo-shibuya', 'Tokyo'),
  ('hotel-indigo-hakone-gora', 'Hakone'),
  ('intercontinental-osaka', 'Osaka'),
  ('intercontinental-sapporo', 'Sapporo'),
  ('intercontinental-the-strings-tokyo', 'Tokyo'),
  ('vignette-collection-rihga-royal-hotel-osaka', 'Osaka')
) AS v(external_key, city)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_cities ci
  ON ci.country_id = co.id
 AND lower(ci.name) = lower(v.city)
WHERE e.external_key = v.external_key
  AND e.entity_type = 'hotel'
  AND e.active = true;


-- 7b. Ensure every guide hotel exists (match by external_key OR lower(name) in city)
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
  'Japan Destination Guide — PureLuxe Atlas KB (2026-11-03)',
  co.region_id,
  co.id,
  ci.id,
  v.contract_status,
  v.client_ready::boolean,
  v.placeholder::boolean,
  false,
  v.external_key,
  COALESCE(string_to_array(NULLIF(v.aliases, ''), '|'), '{}'::text[]),
  jsonb_build_object(
    'japan_guide', true,
    'guide_area', v.area,
    'guide_proposed_tier', v.tier,
    'guide_partner', v.partner,
    'guide_score', v.score
  ),
  v.legacy_notes,
  true
FROM (VALUES

  ('Aman Tokyo', 'Tokyo', 'Aman', 'Otemachi', 'Tier 1', 'Not yet contracted; placeholder only', '3.7', 'jp-guide-aman-tokyo', 'Aman Tokyo', 'not_yet_contracted', 'true', 'true', 'Otemachi. Guide proposed Tier 1; partner: Not yet contracted; placeholder only. Internal score 3.7 (clients never see scores).', 'Japan guide area=Otemachi; tier=Tier 1; partner=Not yet contracted; placeholder only; score=3.7'),
  ('Four Seasons Tokyo at Otemachi', 'Tokyo', 'Four Seasons', 'Otemachi', 'Tier 1', 'Four Seasons Preferred Partner; quoted to clients', '4.1', 'jp-guide-four-seasons-tokyo-at-otemachi', 'Four Seasons — Tokyo at Otemachi|Four Seasons Tokyo Otemachi', 'unknown', 'true', 'false', 'Otemachi. Guide proposed Tier 1; partner: Four Seasons Preferred Partner; quoted to clients. Internal score 4.1 (clients never see scores).', 'Japan guide area=Otemachi; tier=Tier 1; partner=Four Seasons Preferred Partner; quoted to clients; score=4.1'),
  ('Mandarin Oriental Tokyo', 'Tokyo', 'Mandarin Oriental', 'Nihonbashi', 'Tier 1', 'Mandarin Oriental Fan Club; quoted to clients', '4.3', 'jp-guide-mandarin-oriental-tokyo', 'Mandarin Oriental, Tokyo|Mandarin Oriental Tokyo', 'unknown', 'true', 'false', 'Nihonbashi. Guide proposed Tier 1; partner: Mandarin Oriental Fan Club; quoted to clients. Internal score 4.3 (clients never see scores).', 'Japan guide area=Nihonbashi; tier=Tier 1; partner=Mandarin Oriental Fan Club; quoted to clients; score=4.3'),
  ('Palace Hotel Tokyo', 'Tokyo', '', 'Marunouchi', 'Tier 1', 'Leaders Club; quoted to clients', '3.9', 'jp-guide-palace-hotel-tokyo', 'Palace Hotel Tokyo', 'unknown', 'true', 'false', 'Marunouchi. Guide proposed Tier 1; partner: Leaders Club; quoted to clients. Internal score 3.9 (clients never see scores).', 'Japan guide area=Marunouchi; tier=Tier 1; partner=Leaders Club; quoted to clients; score=3.9'),
  ('The Peninsula Tokyo', 'Tokyo', 'Peninsula', 'Yurakucho', 'Tier 1', 'Peninsula', '4.2', 'jp-guide-the-peninsula-tokyo', 'Peninsula Tokyo', 'unknown', 'true', 'false', 'Yurakucho. Guide proposed Tier 1; partner: Peninsula. Internal score 4.2 (clients never see scores).', 'Japan guide area=Yurakucho; tier=Tier 1; partner=Peninsula; score=4.2'),
  ('The Okura Tokyo', 'Tokyo', '', 'Toranomon', 'Tier 1', 'LHW Vita; confirm', '3.4', 'jp-guide-the-okura-tokyo', 'The Okura Tokyo', 'unknown', 'true', 'false', 'Toranomon. Guide proposed Tier 1; partner: LHW Vita; confirm. Internal score 3.4 (clients never see scores).', 'Japan guide area=Toranomon; tier=Tier 1; partner=LHW Vita; confirm; score=3.4'),
  ('Janu Tokyo', 'Tokyo', 'Janu', 'Azabudai Hills', 'Tier 1', 'Serandipians', '3.6', 'jp-guide-janu-tokyo', 'Janu Tokyo', 'unknown', 'true', 'false', 'Azabudai Hills. Guide proposed Tier 1; partner: Serandipians. Internal score 3.6 (clients never see scores).', 'Japan guide area=Azabudai Hills; tier=Tier 1; partner=Serandipians; score=3.6'),
  ('The Ritz-Carlton, Tokyo', 'Tokyo', 'Ritz-Carlton', 'Roppongi (Tokyo Midtown)', 'Tier 1', 'Marriott Stars; confirm', '3.6', 'jp-guide-the-ritz-carlton-tokyo', 'The Ritz-Carlton Tokyo|Ritz-Carlton Tokyo', 'unknown', 'true', 'false', 'Roppongi (Tokyo Midtown). Guide proposed Tier 1; partner: Marriott Stars; confirm. Internal score 3.6 (clients never see scores).', 'Japan guide area=Roppongi (Tokyo Midtown); tier=Tier 1; partner=Marriott Stars; confirm; score=3.6'),
  ('Four Seasons Tokyo at Marunouchi', 'Tokyo', 'Four Seasons', 'Marunouchi', 'Tier 2', 'Four Seasons Preferred Partner; confirm', '3.6', 'jp-guide-four-seasons-tokyo-at-marunouchi', 'Four Seasons — Tokyo at Marunouchi', 'unknown', 'true', 'false', 'Marunouchi. Guide proposed Tier 2; partner: Four Seasons Preferred Partner; confirm. Internal score 3.6 (clients never see scores).', 'Japan guide area=Marunouchi; tier=Tier 2; partner=Four Seasons Preferred Partner; confirm; score=3.6'),
  ('Park Hyatt Tokyo', 'Tokyo', 'Park Hyatt', 'Shinjuku', 'Tier 2', 'Hyatt Prive; not yet contracted in KB, confirm', '3.6', 'jp-guide-park-hyatt-tokyo', 'Park Hyatt Tokyo', 'not_yet_contracted', 'true', 'false', 'Shinjuku. Guide proposed Tier 2; partner: Hyatt Prive; not yet contracted in KB, confirm. Internal score 3.6 (clients never see scores).', 'Japan guide area=Shinjuku; tier=Tier 2; partner=Hyatt Prive; not yet contracted in KB, confirm; score=3.6'),
  ('Imperial Hotel Tokyo', 'Tokyo', '', 'Hibiya', 'Tier 2', 'LHW Vita; confirm', '3.4', 'jp-guide-imperial-hotel-tokyo', 'Imperial Hotel, Tokyo', 'unknown', 'true', 'false', 'Hibiya. Guide proposed Tier 2; partner: LHW Vita; confirm. Internal score 3.4 (clients never see scores).', 'Japan guide area=Hibiya; tier=Tier 2; partner=LHW Vita; confirm; score=3.4'),
  ('Shangri-La Tokyo', 'Tokyo', 'Shangri-La', 'Marunouchi', 'Tier 2', 'Shangri-La', '3.9', 'jp-guide-shangri-la-tokyo', 'Shangri-La Tokyo', 'unknown', 'true', 'false', 'Marunouchi. Guide proposed Tier 2; partner: Shangri-La. Internal score 3.9 (clients never see scores).', 'Japan guide area=Marunouchi; tier=Tier 2; partner=Shangri-La; score=3.9'),
  ('Grand Hyatt Tokyo', 'Tokyo', 'Grand Hyatt', 'Roppongi', 'Tier 2', 'Hyatt Prive; confirm', '3.6', 'jp-guide-grand-hyatt-tokyo', 'Grand Hyatt Tokyo', 'unknown', 'true', 'false', 'Roppongi. Guide proposed Tier 2; partner: Hyatt Prive; confirm. Internal score 3.6 (clients never see scores).', 'Japan guide area=Roppongi; tier=Tier 2; partner=Hyatt Prive; confirm; score=3.6'),
  ('ANA InterContinental Tokyo', 'Tokyo', 'ANA InterContinental', 'Akasaka', 'Tier 2', 'IHG', '3.4', 'jp-guide-ana-intercontinental-tokyo', 'ANA InterContinental Tokyo', 'unknown', 'true', 'false', 'Akasaka. Guide proposed Tier 2; partner: IHG. Internal score 3.4 (clients never see scores).', 'Japan guide area=Akasaka; tier=Tier 2; partner=IHG; score=3.4'),
  ('Fairmont Tokyo', 'Tokyo', 'Fairmont', 'Shibaura', 'Tier 2', 'Accor; confirm', '3.4', 'jp-guide-fairmont-tokyo', 'Fairmont Tokyo', 'unknown', 'true', 'false', 'Shibaura. Guide proposed Tier 2; partner: Accor; confirm. Internal score 3.4 (clients never see scores).', 'Japan guide area=Shibaura; tier=Tier 2; partner=Accor; confirm; score=3.4'),
  ('1 Hotel Tokyo', 'Tokyo', '', 'Akasaka', 'Tier 2', 'Confirm', '3.0', 'jp-guide-1-hotel-tokyo', '1 Hotel Tokyo', 'unknown', 'true', 'false', 'Akasaka. Guide proposed Tier 2; partner: Confirm. Internal score 3.0 (clients never see scores).', 'Japan guide area=Akasaka; tier=Tier 2; partner=Confirm; score=3.0'),
  ('The New Otani Executive House Zen', 'Tokyo', '', 'Akasaka', 'Tier 2', 'Confirm', '3.6', 'jp-guide-the-new-otani-executive-house-zen', 'The New Otani Executive House Zen', 'unknown', 'true', 'false', 'Akasaka. Guide proposed Tier 2; partner: Confirm. Internal score 3.6 (clients never see scores).', 'Japan guide area=Akasaka; tier=Tier 2; partner=Confirm; score=3.6'),
  ('Capitol Hotel Tokyu', 'Tokyo', '', 'Akasaka', 'Tier 3', 'Preferred Hotels; in KB, confirm', '3.4', 'jp-guide-capitol-hotel-tokyu', 'Capitol Hotel Tokyu', 'unknown', 'true', 'false', 'Akasaka. Guide proposed Tier 3; partner: Preferred Hotels; in KB, confirm. Internal score 3.4 (clients never see scores).', 'Japan guide area=Akasaka; tier=Tier 3; partner=Preferred Hotels; in KB, confirm; score=3.4'),
  ('Kimpton Shinjuku Tokyo', 'Tokyo', 'Kimpton', 'Shinjuku', 'Tier 3', 'IHG', '3.0 (Support pending)', 'jp-guide-kimpton-shinjuku-tokyo', 'Kimpton Shinjuku Tokyo', 'unknown', 'true', 'false', 'Shinjuku. Guide proposed Tier 3; partner: IHG. Internal score 3.0 (Support pending) (clients never see scores).', 'Japan guide area=Shinjuku; tier=Tier 3; partner=IHG; score=3.0 (Support pending)'),
  ('Hotel Indigo Tokyo Shibuya', 'Tokyo', 'Hotel Indigo', 'Shibuya', 'Tier 3', 'IHG', '3.0 (Support pending)', 'jp-guide-hotel-indigo-tokyo-shibuya', 'Hotel Indigo Tokyo Shibuya', 'unknown', 'true', 'false', 'Shibuya. Guide proposed Tier 3; partner: IHG. Internal score 3.0 (Support pending) (clients never see scores).', 'Japan guide area=Shibuya; tier=Tier 3; partner=IHG; score=3.0 (Support pending)'),
  ('BELLUSTAR TOKYO, A Pan Pacific Hotel', 'Tokyo', '', 'Kabukicho, Shinjuku', 'Tier 3', 'Confirm', '3.3', 'jp-guide-bellustar-tokyo-a-pan-pacific-hotel', 'BELLUSTAR TOKYO, A Pan Pacific Hotel', 'unknown', 'true', 'false', 'Kabukicho, Shinjuku. Guide proposed Tier 3; partner: Confirm. Internal score 3.3 (clients never see scores).', 'Japan guide area=Kabukicho, Shinjuku; tier=Tier 3; partner=Confirm; score=3.3'),
  ('Aman Kyoto', 'Kyoto', 'Aman', 'Northern Kyoto, forest setting', 'Tier 1', 'Confirm', '3.2', 'jp-guide-aman-kyoto', 'Aman Kyoto', 'unknown', 'true', 'false', 'Northern Kyoto, forest setting. Guide proposed Tier 1; partner: Confirm. Internal score 3.2 (clients never see scores).', 'Japan guide area=Northern Kyoto, forest setting; tier=Tier 1; partner=Confirm; score=3.2'),
  ('Four Seasons Kyoto', 'Kyoto', 'Four Seasons', 'Higashiyama', 'Tier 1', 'Four Seasons Preferred Partner; confirm', '3.9', 'jp-guide-four-seasons-kyoto', 'Four Seasons — Kyoto', 'unknown', 'true', 'false', 'Higashiyama. Guide proposed Tier 1; partner: Four Seasons Preferred Partner; confirm. Internal score 3.9 (clients never see scores).', 'Japan guide area=Higashiyama; tier=Tier 1; partner=Four Seasons Preferred Partner; confirm; score=3.9'),
  ('The Ritz-Carlton Kyoto', 'Kyoto', 'Ritz-Carlton', 'Kamogawa riverside', 'Tier 1', 'Marriott Stars', '3.9', 'jp-guide-the-ritz-carlton-kyoto', 'The Ritz-Carlton, Kyoto|Ritz-Carlton Kyoto', 'unknown', 'true', 'false', 'Kamogawa riverside. Guide proposed Tier 1; partner: Marriott Stars. Internal score 3.9 (clients never see scores).', 'Japan guide area=Kamogawa riverside; tier=Tier 1; partner=Marriott Stars; score=3.9'),
  ('Capella Kyoto', 'Kyoto', 'Capella', 'Higashiyama', 'Tier 1', 'LHW Vita, Serandipains', '3.9', 'jp-guide-capella-kyoto', 'Capella Kyoto', 'unknown', 'true', 'false', 'Higashiyama. Guide proposed Tier 1; partner: LHW Vita, Serandipains. Internal score 3.9 (clients never see scores).', 'Japan guide area=Higashiyama; tier=Tier 1; partner=LHW Vita, Serandipains; score=3.9'),
  ('Hotel The Mitsui Kyoto', 'Kyoto', '', 'Nijo', 'Tier 1', 'Marriott Stars', '3.7', 'jp-guide-hotel-the-mitsui-kyoto', 'Hotel The Mitsui Kyoto', 'unknown', 'true', 'false', 'Nijo. Guide proposed Tier 1; partner: Marriott Stars. Internal score 3.7 (clients never see scores).', 'Japan guide area=Nijo; tier=Tier 1; partner=Marriott Stars; score=3.7'),
  ('Six Senses Kyoto', 'Kyoto', 'Six Senses', 'Higashiyama', 'Tier 1', 'IHG Destined', '3.6', 'jp-guide-six-senses-kyoto', 'Six Senses Kyoto', 'unknown', 'true', 'false', 'Higashiyama. Guide proposed Tier 1; partner: IHG Destined. Internal score 3.6 (clients never see scores).', 'Japan guide area=Higashiyama; tier=Tier 1; partner=IHG Destined; score=3.6'),
  ('Park Hyatt Kyoto', 'Kyoto', 'Park Hyatt', 'Higashiyama', 'Tier 2', 'Hyatt Prive', '4.1', 'jp-guide-park-hyatt-kyoto', 'Park Hyatt Kyoto', 'unknown', 'true', 'false', 'Higashiyama. Guide proposed Tier 2; partner: Hyatt Prive. Internal score 4.1 (clients never see scores).', 'Japan guide area=Higashiyama; tier=Tier 2; partner=Hyatt Prive; score=4.1'),
  ('ROKU Kyoto, LXR Hotels', 'Kyoto', '', 'Kitayama', 'Tier 2', 'Hilton for Luxury', '3.1', 'jp-guide-roku-kyoto-lxr-hotels', 'ROKU Kyoto, LXR Hotels & Resorts', 'unknown', 'true', 'false', 'Kitayama. Guide proposed Tier 2; partner: Hilton for Luxury. Internal score 3.1 (clients never see scores).', 'Japan guide area=Kitayama; tier=Tier 2; partner=Hilton for Luxury; score=3.1'),
  ('Hotel Seiryu Kyoto Kiyomizu', 'Kyoto', '', 'Kiyomizu', 'Tier 2', 'LHW Vita', '3.6', 'jp-guide-hotel-seiryu-kyoto-kiyomizu', 'The Hotel Seiryu Kyoto Kiyomizu|The Hotel Seiryu Kyoto Kiyomizu', 'unknown', 'true', 'false', 'Kiyomizu. Guide proposed Tier 2; partner: LHW Vita. Internal score 3.6 (clients never see scores).', 'Japan guide area=Kiyomizu; tier=Tier 2; partner=LHW Vita; score=3.6'),
  ('Imperial Hotel Kyoto', 'Kyoto', '', 'Gion', 'Tier 2', 'LHW Vita', '3.5 (Support pending)', 'jp-guide-imperial-hotel-kyoto', 'Imperial Hotel, Kyoto', 'unknown', 'true', 'false', 'Gion. Guide proposed Tier 2; partner: LHW Vita. Internal score 3.5 (Support pending) (clients never see scores).', 'Japan guide area=Gion; tier=Tier 2; partner=LHW Vita; score=3.5 (Support pending)'),
  ('Dusit Thani Kyoto', 'Kyoto', 'Dusit Thani', 'Karasuma', 'Tier 3', 'Serandipians', '3.4', 'jp-guide-dusit-thani-kyoto', 'Dusit Thani Kyoto', 'unknown', 'true', 'false', 'Karasuma. Guide proposed Tier 3; partner: Serandipians. Internal score 3.4 (clients never see scores).', 'Japan guide area=Karasuma; tier=Tier 3; partner=Serandipians; score=3.4'),
  ('FAUCHON L''Hotel Kyoto', 'Kyoto', '', 'Gion', 'Tier 3', 'SLH Within', '3.5', 'jp-guide-fauchon-l-hotel-kyoto', 'FAUCHON L''Hotel Kyoto', 'unknown', 'true', 'false', 'Gion. Guide proposed Tier 3; partner: SLH Within. Internal score 3.5 (clients never see scores).', 'Japan guide area=Gion; tier=Tier 3; partner=SLH Within; score=3.5'),
  ('Four Seasons Osaka', 'Osaka', 'Four Seasons', 'Umeda/Kita', 'Tier 1', 'Four Seasons Preferred Partner', '4.2', 'jp-guide-four-seasons-osaka', 'Four Seasons — Osaka', 'unknown', 'true', 'false', 'Umeda/Kita. Guide proposed Tier 1; partner: Four Seasons Preferred Partner. Internal score 4.2 (clients never see scores).', 'Japan guide area=Umeda/Kita; tier=Tier 1; partner=Four Seasons Preferred Partner; score=4.2'),
  ('The St. Regis Osaka', 'Osaka', 'St. Regis', 'Honmachi', 'Tier 1', 'Marriott Stars', '3.9', 'jp-guide-the-st-regis-osaka', '', 'unknown', 'true', 'false', 'Honmachi. Guide proposed Tier 1; partner: Marriott Stars. Internal score 3.9 (clients never see scores).', 'Japan guide area=Honmachi; tier=Tier 1; partner=Marriott Stars; score=3.9'),
  ('Waldorf Astoria Osaka', 'Osaka', 'Waldorf Astoria', 'Umeda', 'Tier 1', 'Hilton for Luxury', '4.4', 'jp-guide-waldorf-astoria-osaka', 'Waldorf Astoria Osaka', 'unknown', 'true', 'false', 'Umeda. Guide proposed Tier 1; partner: Hilton for Luxury. Internal score 4.4 (clients never see scores).', 'Japan guide area=Umeda; tier=Tier 1; partner=Hilton for Luxury; score=4.4'),
  ('Conrad Osaka', 'Osaka', 'Conrad', 'Nakanoshima', 'Tier 2', 'Hilton for Luxury', '3.8', 'jp-guide-conrad-osaka', 'Conrad Osaka', 'unknown', 'true', 'false', 'Nakanoshima. Guide proposed Tier 2; partner: Hilton for Luxury. Internal score 3.8 (clients never see scores).', 'Japan guide area=Nakanoshima; tier=Tier 2; partner=Hilton for Luxury; score=3.8'),
  ('Patina Osaka', 'Osaka', 'Patina', 'Nakanoshima', 'Tier 2', 'Serandipians', '3.9', 'jp-guide-patina-osaka', 'Patina Osaka', 'unknown', 'true', 'false', 'Nakanoshima. Guide proposed Tier 2; partner: Serandipians. Internal score 3.9 (clients never see scores).', 'Japan guide area=Nakanoshima; tier=Tier 2; partner=Serandipians; score=3.9'),
  ('Gora Kadan', 'Hakone', '', 'Gora, Hakone', 'Tier 1', 'Relais and Chateaux', '3.5', 'jp-guide-gora-kadan', '', 'unknown', 'true', 'false', 'Gora, Hakone. Guide proposed Tier 1; partner: Relais and Chateaux. Internal score 3.5 (clients never see scores).', 'Japan guide area=Gora, Hakone; tier=Tier 1; partner=Relais and Chateaux; score=3.5'),
  ('ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu', 'Hakone', '', 'Sengokuhara, Hakone', 'Tier 1', 'LHW Vita', '4.2', 'jp-guide-espacio-the-hakone-geihinkan-rin-poh-ki-ryu', 'ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu', 'unknown', 'true', 'false', 'Sengokuhara, Hakone. Guide proposed Tier 1; partner: LHW Vita. Internal score 4.2 (clients never see scores).', 'Japan guide area=Sengokuhara, Hakone; tier=Tier 1; partner=LHW Vita; score=4.2'),
  ('Park Hyatt Niseko Hanazono', 'Niseko', 'Park Hyatt', 'Hanazono', 'Tier 1', 'Hyatt Prive', '3.9', 'jp-guide-park-hyatt-niseko-hanazono', '', 'unknown', 'true', 'false', 'Hanazono. Guide proposed Tier 1; partner: Hyatt Prive. Internal score 3.9 (clients never see scores).', 'Japan guide area=Hanazono; tier=Tier 1; partner=Hyatt Prive; score=3.9'),
  ('Higashiyama Niseko Village, a Ritz-Carlton Reserve', 'Niseko', 'Ritz-Carlton', 'Niseko Village', 'Tier 1', 'Marriott Stars; confirm', '3.1', 'jp-guide-higashiyama-niseko-village-a-ritz-carlton-reserve', '', 'unknown', 'true', 'false', 'Niseko Village. Guide proposed Tier 1; partner: Marriott Stars; confirm. Internal score 3.1 (clients never see scores).', 'Japan guide area=Niseko Village; tier=Tier 1; partner=Marriott Stars; confirm; score=3.1'),
  ('Hinode Hills Niseko', 'Niseko', '', 'Niseko Village', 'Tier 3', 'Hilton for Luxury', 'Not scored', 'jp-guide-hinode-hills-niseko', '', 'unknown', 'true', 'false', 'Niseko Village. Guide proposed Tier 3; partner: Hilton for Luxury. Internal score Not scored (clients never see scores).', 'Japan guide area=Niseko Village; tier=Tier 3; partner=Hilton for Luxury; score=Not scored'),
  ('The Ritz-Carlton, Nikko', 'Nikko', 'Ritz-Carlton', 'Lake Chuzenji', 'Tier 1', 'Marriott Stars', '4.1', 'jp-guide-the-ritz-carlton-nikko', '', 'unknown', 'true', 'false', 'Lake Chuzenji. Guide proposed Tier 1; partner: Marriott Stars. Internal score 4.1 (clients never see scores).', 'Japan guide area=Lake Chuzenji; tier=Tier 1; partner=Marriott Stars; score=4.1'),
  ('Rosewood Miyakojima', 'Miyako Island', 'Rosewood', 'Miyako Island', 'Tier 1', 'Rosewood Elite', '4.0', 'jp-guide-rosewood-miyakojima', 'Rosewood Miyakojima', 'unknown', 'true', 'false', 'Miyako Island. Guide proposed Tier 1; partner: Rosewood Elite. Internal score 4.0 (clients never see scores).', 'Japan guide area=Miyako Island; tier=Tier 1; partner=Rosewood Elite; score=4.0'),
  ('Halekulani Okinawa', 'Okinawa', 'Halekulani', 'Onna, Okinawa', 'Tier 2', 'LHW Vita', '3.7', 'jp-guide-halekulani-okinawa', 'Halekulani Okinawa', 'unknown', 'true', 'false', 'Onna, Okinawa. Guide proposed Tier 2; partner: LHW Vita. Internal score 3.7 (clients never see scores).', 'Japan guide area=Onna, Okinawa; tier=Tier 2; partner=LHW Vita; score=3.7'),
  ('Ryokan Kurashiki', 'Okayama', '', 'Kurashiki', 'Tier 2', 'Confirm', '3.4', 'jp-guide-ryokan-kurashiki', 'Ryokan Kurashiki', 'unknown', 'true', 'false', 'Kurashiki. Guide proposed Tier 2; partner: Confirm. Internal score 3.4 (clients never see scores).', 'Japan guide area=Kurashiki; tier=Tier 2; partner=Confirm; score=3.4')

) AS v(name, city, brand, area, tier, partner, score, external_key, aliases, contract_status, client_ready, placeholder, description, legacy_notes)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_cities ci ON ci.country_id = co.id AND lower(ci.name) = lower(v.city)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_entities e
  WHERE e.entity_type = 'hotel'
    AND e.active = true
    AND (
      e.external_key = v.external_key
      OR (e.city_id = ci.id AND lower(e.name) = lower(v.name))
      OR (e.country_id = co.id AND lower(e.name) = lower(v.name))
      OR (e.country_id = co.id AND v.aliases <> '' AND e.name = ANY (string_to_array(v.aliases, '|')))
      OR (e.country_id = co.id AND exists (
            SELECT 1 FROM unnest(coalesce(e.aliases, '{}'::text[])) a
            WHERE lower(a) = lower(v.name)
          ))
    )
);


-- 7c. Enrich existing hotels that match the guide (by name / alias / external_key)
UPDATE public.kb_entities e
SET
  description = COALESCE(NULLIF(trim(e.description), ''), v.description),
  aliases = (
    SELECT ARRAY(
      SELECT DISTINCT x
      FROM unnest(
        coalesce(e.aliases, '{}'::text[])
        || CASE WHEN v.aliases = '' THEN '{}'::text[] ELSE string_to_array(v.aliases, '|') END
        || ARRAY[v.name]
      ) AS x
      WHERE length(trim(x)) > 0
    )
  ),
  external_ids = coalesce(e.external_ids, '{}'::jsonb) || jsonb_build_object(
    'japan_guide', true,
    'guide_area', v.area,
    'guide_proposed_tier', v.tier,
    'guide_partner', v.partner,
    'guide_score', v.score
  ),
  legacy_notes = COALESCE(NULLIF(trim(e.legacy_notes), ''), v.legacy_notes),
  city_id = COALESCE(e.city_id, ci.id),
  country_id = COALESCE(e.country_id, co.id),
  region_id = COALESCE(e.region_id, co.region_id),
  placeholder = CASE WHEN v.placeholder = 'true' THEN true ELSE e.placeholder END,
  contract_status = CASE
    WHEN v.contract_status = 'not_yet_contracted' AND e.contract_status = 'unknown'
      THEN 'not_yet_contracted'
    ELSE e.contract_status
  END,
  updated_at = now()
FROM (VALUES

  ('Aman Tokyo', 'Tokyo', 'Aman', 'Otemachi', 'Tier 1', 'Not yet contracted; placeholder only', '3.7', 'jp-guide-aman-tokyo', 'Aman Tokyo', 'not_yet_contracted', 'true', 'true', 'Otemachi. Guide proposed Tier 1; partner: Not yet contracted; placeholder only. Internal score 3.7 (clients never see scores).', 'Japan guide area=Otemachi; tier=Tier 1; partner=Not yet contracted; placeholder only; score=3.7'),
  ('Four Seasons Tokyo at Otemachi', 'Tokyo', 'Four Seasons', 'Otemachi', 'Tier 1', 'Four Seasons Preferred Partner; quoted to clients', '4.1', 'jp-guide-four-seasons-tokyo-at-otemachi', 'Four Seasons — Tokyo at Otemachi|Four Seasons Tokyo Otemachi', 'unknown', 'true', 'false', 'Otemachi. Guide proposed Tier 1; partner: Four Seasons Preferred Partner; quoted to clients. Internal score 4.1 (clients never see scores).', 'Japan guide area=Otemachi; tier=Tier 1; partner=Four Seasons Preferred Partner; quoted to clients; score=4.1'),
  ('Mandarin Oriental Tokyo', 'Tokyo', 'Mandarin Oriental', 'Nihonbashi', 'Tier 1', 'Mandarin Oriental Fan Club; quoted to clients', '4.3', 'jp-guide-mandarin-oriental-tokyo', 'Mandarin Oriental, Tokyo|Mandarin Oriental Tokyo', 'unknown', 'true', 'false', 'Nihonbashi. Guide proposed Tier 1; partner: Mandarin Oriental Fan Club; quoted to clients. Internal score 4.3 (clients never see scores).', 'Japan guide area=Nihonbashi; tier=Tier 1; partner=Mandarin Oriental Fan Club; quoted to clients; score=4.3'),
  ('Palace Hotel Tokyo', 'Tokyo', '', 'Marunouchi', 'Tier 1', 'Leaders Club; quoted to clients', '3.9', 'jp-guide-palace-hotel-tokyo', 'Palace Hotel Tokyo', 'unknown', 'true', 'false', 'Marunouchi. Guide proposed Tier 1; partner: Leaders Club; quoted to clients. Internal score 3.9 (clients never see scores).', 'Japan guide area=Marunouchi; tier=Tier 1; partner=Leaders Club; quoted to clients; score=3.9'),
  ('The Peninsula Tokyo', 'Tokyo', 'Peninsula', 'Yurakucho', 'Tier 1', 'Peninsula', '4.2', 'jp-guide-the-peninsula-tokyo', 'Peninsula Tokyo', 'unknown', 'true', 'false', 'Yurakucho. Guide proposed Tier 1; partner: Peninsula. Internal score 4.2 (clients never see scores).', 'Japan guide area=Yurakucho; tier=Tier 1; partner=Peninsula; score=4.2'),
  ('The Okura Tokyo', 'Tokyo', '', 'Toranomon', 'Tier 1', 'LHW Vita; confirm', '3.4', 'jp-guide-the-okura-tokyo', 'The Okura Tokyo', 'unknown', 'true', 'false', 'Toranomon. Guide proposed Tier 1; partner: LHW Vita; confirm. Internal score 3.4 (clients never see scores).', 'Japan guide area=Toranomon; tier=Tier 1; partner=LHW Vita; confirm; score=3.4'),
  ('Janu Tokyo', 'Tokyo', 'Janu', 'Azabudai Hills', 'Tier 1', 'Serandipians', '3.6', 'jp-guide-janu-tokyo', 'Janu Tokyo', 'unknown', 'true', 'false', 'Azabudai Hills. Guide proposed Tier 1; partner: Serandipians. Internal score 3.6 (clients never see scores).', 'Japan guide area=Azabudai Hills; tier=Tier 1; partner=Serandipians; score=3.6'),
  ('The Ritz-Carlton, Tokyo', 'Tokyo', 'Ritz-Carlton', 'Roppongi (Tokyo Midtown)', 'Tier 1', 'Marriott Stars; confirm', '3.6', 'jp-guide-the-ritz-carlton-tokyo', 'The Ritz-Carlton Tokyo|Ritz-Carlton Tokyo', 'unknown', 'true', 'false', 'Roppongi (Tokyo Midtown). Guide proposed Tier 1; partner: Marriott Stars; confirm. Internal score 3.6 (clients never see scores).', 'Japan guide area=Roppongi (Tokyo Midtown); tier=Tier 1; partner=Marriott Stars; confirm; score=3.6'),
  ('Four Seasons Tokyo at Marunouchi', 'Tokyo', 'Four Seasons', 'Marunouchi', 'Tier 2', 'Four Seasons Preferred Partner; confirm', '3.6', 'jp-guide-four-seasons-tokyo-at-marunouchi', 'Four Seasons — Tokyo at Marunouchi', 'unknown', 'true', 'false', 'Marunouchi. Guide proposed Tier 2; partner: Four Seasons Preferred Partner; confirm. Internal score 3.6 (clients never see scores).', 'Japan guide area=Marunouchi; tier=Tier 2; partner=Four Seasons Preferred Partner; confirm; score=3.6'),
  ('Park Hyatt Tokyo', 'Tokyo', 'Park Hyatt', 'Shinjuku', 'Tier 2', 'Hyatt Prive; not yet contracted in KB, confirm', '3.6', 'jp-guide-park-hyatt-tokyo', 'Park Hyatt Tokyo', 'not_yet_contracted', 'true', 'false', 'Shinjuku. Guide proposed Tier 2; partner: Hyatt Prive; not yet contracted in KB, confirm. Internal score 3.6 (clients never see scores).', 'Japan guide area=Shinjuku; tier=Tier 2; partner=Hyatt Prive; not yet contracted in KB, confirm; score=3.6'),
  ('Imperial Hotel Tokyo', 'Tokyo', '', 'Hibiya', 'Tier 2', 'LHW Vita; confirm', '3.4', 'jp-guide-imperial-hotel-tokyo', 'Imperial Hotel, Tokyo', 'unknown', 'true', 'false', 'Hibiya. Guide proposed Tier 2; partner: LHW Vita; confirm. Internal score 3.4 (clients never see scores).', 'Japan guide area=Hibiya; tier=Tier 2; partner=LHW Vita; confirm; score=3.4'),
  ('Shangri-La Tokyo', 'Tokyo', 'Shangri-La', 'Marunouchi', 'Tier 2', 'Shangri-La', '3.9', 'jp-guide-shangri-la-tokyo', 'Shangri-La Tokyo', 'unknown', 'true', 'false', 'Marunouchi. Guide proposed Tier 2; partner: Shangri-La. Internal score 3.9 (clients never see scores).', 'Japan guide area=Marunouchi; tier=Tier 2; partner=Shangri-La; score=3.9'),
  ('Grand Hyatt Tokyo', 'Tokyo', 'Grand Hyatt', 'Roppongi', 'Tier 2', 'Hyatt Prive; confirm', '3.6', 'jp-guide-grand-hyatt-tokyo', 'Grand Hyatt Tokyo', 'unknown', 'true', 'false', 'Roppongi. Guide proposed Tier 2; partner: Hyatt Prive; confirm. Internal score 3.6 (clients never see scores).', 'Japan guide area=Roppongi; tier=Tier 2; partner=Hyatt Prive; confirm; score=3.6'),
  ('ANA InterContinental Tokyo', 'Tokyo', 'ANA InterContinental', 'Akasaka', 'Tier 2', 'IHG', '3.4', 'jp-guide-ana-intercontinental-tokyo', 'ANA InterContinental Tokyo', 'unknown', 'true', 'false', 'Akasaka. Guide proposed Tier 2; partner: IHG. Internal score 3.4 (clients never see scores).', 'Japan guide area=Akasaka; tier=Tier 2; partner=IHG; score=3.4'),
  ('Fairmont Tokyo', 'Tokyo', 'Fairmont', 'Shibaura', 'Tier 2', 'Accor; confirm', '3.4', 'jp-guide-fairmont-tokyo', 'Fairmont Tokyo', 'unknown', 'true', 'false', 'Shibaura. Guide proposed Tier 2; partner: Accor; confirm. Internal score 3.4 (clients never see scores).', 'Japan guide area=Shibaura; tier=Tier 2; partner=Accor; confirm; score=3.4'),
  ('1 Hotel Tokyo', 'Tokyo', '', 'Akasaka', 'Tier 2', 'Confirm', '3.0', 'jp-guide-1-hotel-tokyo', '1 Hotel Tokyo', 'unknown', 'true', 'false', 'Akasaka. Guide proposed Tier 2; partner: Confirm. Internal score 3.0 (clients never see scores).', 'Japan guide area=Akasaka; tier=Tier 2; partner=Confirm; score=3.0'),
  ('The New Otani Executive House Zen', 'Tokyo', '', 'Akasaka', 'Tier 2', 'Confirm', '3.6', 'jp-guide-the-new-otani-executive-house-zen', 'The New Otani Executive House Zen', 'unknown', 'true', 'false', 'Akasaka. Guide proposed Tier 2; partner: Confirm. Internal score 3.6 (clients never see scores).', 'Japan guide area=Akasaka; tier=Tier 2; partner=Confirm; score=3.6'),
  ('Capitol Hotel Tokyu', 'Tokyo', '', 'Akasaka', 'Tier 3', 'Preferred Hotels; in KB, confirm', '3.4', 'jp-guide-capitol-hotel-tokyu', 'Capitol Hotel Tokyu', 'unknown', 'true', 'false', 'Akasaka. Guide proposed Tier 3; partner: Preferred Hotels; in KB, confirm. Internal score 3.4 (clients never see scores).', 'Japan guide area=Akasaka; tier=Tier 3; partner=Preferred Hotels; in KB, confirm; score=3.4'),
  ('Kimpton Shinjuku Tokyo', 'Tokyo', 'Kimpton', 'Shinjuku', 'Tier 3', 'IHG', '3.0 (Support pending)', 'jp-guide-kimpton-shinjuku-tokyo', 'Kimpton Shinjuku Tokyo', 'unknown', 'true', 'false', 'Shinjuku. Guide proposed Tier 3; partner: IHG. Internal score 3.0 (Support pending) (clients never see scores).', 'Japan guide area=Shinjuku; tier=Tier 3; partner=IHG; score=3.0 (Support pending)'),
  ('Hotel Indigo Tokyo Shibuya', 'Tokyo', 'Hotel Indigo', 'Shibuya', 'Tier 3', 'IHG', '3.0 (Support pending)', 'jp-guide-hotel-indigo-tokyo-shibuya', 'Hotel Indigo Tokyo Shibuya', 'unknown', 'true', 'false', 'Shibuya. Guide proposed Tier 3; partner: IHG. Internal score 3.0 (Support pending) (clients never see scores).', 'Japan guide area=Shibuya; tier=Tier 3; partner=IHG; score=3.0 (Support pending)'),
  ('BELLUSTAR TOKYO, A Pan Pacific Hotel', 'Tokyo', '', 'Kabukicho, Shinjuku', 'Tier 3', 'Confirm', '3.3', 'jp-guide-bellustar-tokyo-a-pan-pacific-hotel', 'BELLUSTAR TOKYO, A Pan Pacific Hotel', 'unknown', 'true', 'false', 'Kabukicho, Shinjuku. Guide proposed Tier 3; partner: Confirm. Internal score 3.3 (clients never see scores).', 'Japan guide area=Kabukicho, Shinjuku; tier=Tier 3; partner=Confirm; score=3.3'),
  ('Aman Kyoto', 'Kyoto', 'Aman', 'Northern Kyoto, forest setting', 'Tier 1', 'Confirm', '3.2', 'jp-guide-aman-kyoto', 'Aman Kyoto', 'unknown', 'true', 'false', 'Northern Kyoto, forest setting. Guide proposed Tier 1; partner: Confirm. Internal score 3.2 (clients never see scores).', 'Japan guide area=Northern Kyoto, forest setting; tier=Tier 1; partner=Confirm; score=3.2'),
  ('Four Seasons Kyoto', 'Kyoto', 'Four Seasons', 'Higashiyama', 'Tier 1', 'Four Seasons Preferred Partner; confirm', '3.9', 'jp-guide-four-seasons-kyoto', 'Four Seasons — Kyoto', 'unknown', 'true', 'false', 'Higashiyama. Guide proposed Tier 1; partner: Four Seasons Preferred Partner; confirm. Internal score 3.9 (clients never see scores).', 'Japan guide area=Higashiyama; tier=Tier 1; partner=Four Seasons Preferred Partner; confirm; score=3.9'),
  ('The Ritz-Carlton Kyoto', 'Kyoto', 'Ritz-Carlton', 'Kamogawa riverside', 'Tier 1', 'Marriott Stars', '3.9', 'jp-guide-the-ritz-carlton-kyoto', 'The Ritz-Carlton, Kyoto|Ritz-Carlton Kyoto', 'unknown', 'true', 'false', 'Kamogawa riverside. Guide proposed Tier 1; partner: Marriott Stars. Internal score 3.9 (clients never see scores).', 'Japan guide area=Kamogawa riverside; tier=Tier 1; partner=Marriott Stars; score=3.9'),
  ('Capella Kyoto', 'Kyoto', 'Capella', 'Higashiyama', 'Tier 1', 'LHW Vita, Serandipains', '3.9', 'jp-guide-capella-kyoto', 'Capella Kyoto', 'unknown', 'true', 'false', 'Higashiyama. Guide proposed Tier 1; partner: LHW Vita, Serandipains. Internal score 3.9 (clients never see scores).', 'Japan guide area=Higashiyama; tier=Tier 1; partner=LHW Vita, Serandipains; score=3.9'),
  ('Hotel The Mitsui Kyoto', 'Kyoto', '', 'Nijo', 'Tier 1', 'Marriott Stars', '3.7', 'jp-guide-hotel-the-mitsui-kyoto', 'Hotel The Mitsui Kyoto', 'unknown', 'true', 'false', 'Nijo. Guide proposed Tier 1; partner: Marriott Stars. Internal score 3.7 (clients never see scores).', 'Japan guide area=Nijo; tier=Tier 1; partner=Marriott Stars; score=3.7'),
  ('Six Senses Kyoto', 'Kyoto', 'Six Senses', 'Higashiyama', 'Tier 1', 'IHG Destined', '3.6', 'jp-guide-six-senses-kyoto', 'Six Senses Kyoto', 'unknown', 'true', 'false', 'Higashiyama. Guide proposed Tier 1; partner: IHG Destined. Internal score 3.6 (clients never see scores).', 'Japan guide area=Higashiyama; tier=Tier 1; partner=IHG Destined; score=3.6'),
  ('Park Hyatt Kyoto', 'Kyoto', 'Park Hyatt', 'Higashiyama', 'Tier 2', 'Hyatt Prive', '4.1', 'jp-guide-park-hyatt-kyoto', 'Park Hyatt Kyoto', 'unknown', 'true', 'false', 'Higashiyama. Guide proposed Tier 2; partner: Hyatt Prive. Internal score 4.1 (clients never see scores).', 'Japan guide area=Higashiyama; tier=Tier 2; partner=Hyatt Prive; score=4.1'),
  ('ROKU Kyoto, LXR Hotels', 'Kyoto', '', 'Kitayama', 'Tier 2', 'Hilton for Luxury', '3.1', 'jp-guide-roku-kyoto-lxr-hotels', 'ROKU Kyoto, LXR Hotels & Resorts', 'unknown', 'true', 'false', 'Kitayama. Guide proposed Tier 2; partner: Hilton for Luxury. Internal score 3.1 (clients never see scores).', 'Japan guide area=Kitayama; tier=Tier 2; partner=Hilton for Luxury; score=3.1'),
  ('Hotel Seiryu Kyoto Kiyomizu', 'Kyoto', '', 'Kiyomizu', 'Tier 2', 'LHW Vita', '3.6', 'jp-guide-hotel-seiryu-kyoto-kiyomizu', 'The Hotel Seiryu Kyoto Kiyomizu|The Hotel Seiryu Kyoto Kiyomizu', 'unknown', 'true', 'false', 'Kiyomizu. Guide proposed Tier 2; partner: LHW Vita. Internal score 3.6 (clients never see scores).', 'Japan guide area=Kiyomizu; tier=Tier 2; partner=LHW Vita; score=3.6'),
  ('Imperial Hotel Kyoto', 'Kyoto', '', 'Gion', 'Tier 2', 'LHW Vita', '3.5 (Support pending)', 'jp-guide-imperial-hotel-kyoto', 'Imperial Hotel, Kyoto', 'unknown', 'true', 'false', 'Gion. Guide proposed Tier 2; partner: LHW Vita. Internal score 3.5 (Support pending) (clients never see scores).', 'Japan guide area=Gion; tier=Tier 2; partner=LHW Vita; score=3.5 (Support pending)'),
  ('Dusit Thani Kyoto', 'Kyoto', 'Dusit Thani', 'Karasuma', 'Tier 3', 'Serandipians', '3.4', 'jp-guide-dusit-thani-kyoto', 'Dusit Thani Kyoto', 'unknown', 'true', 'false', 'Karasuma. Guide proposed Tier 3; partner: Serandipians. Internal score 3.4 (clients never see scores).', 'Japan guide area=Karasuma; tier=Tier 3; partner=Serandipians; score=3.4'),
  ('FAUCHON L''Hotel Kyoto', 'Kyoto', '', 'Gion', 'Tier 3', 'SLH Within', '3.5', 'jp-guide-fauchon-l-hotel-kyoto', 'FAUCHON L''Hotel Kyoto', 'unknown', 'true', 'false', 'Gion. Guide proposed Tier 3; partner: SLH Within. Internal score 3.5 (clients never see scores).', 'Japan guide area=Gion; tier=Tier 3; partner=SLH Within; score=3.5'),
  ('Four Seasons Osaka', 'Osaka', 'Four Seasons', 'Umeda/Kita', 'Tier 1', 'Four Seasons Preferred Partner', '4.2', 'jp-guide-four-seasons-osaka', 'Four Seasons — Osaka', 'unknown', 'true', 'false', 'Umeda/Kita. Guide proposed Tier 1; partner: Four Seasons Preferred Partner. Internal score 4.2 (clients never see scores).', 'Japan guide area=Umeda/Kita; tier=Tier 1; partner=Four Seasons Preferred Partner; score=4.2'),
  ('The St. Regis Osaka', 'Osaka', 'St. Regis', 'Honmachi', 'Tier 1', 'Marriott Stars', '3.9', 'jp-guide-the-st-regis-osaka', '', 'unknown', 'true', 'false', 'Honmachi. Guide proposed Tier 1; partner: Marriott Stars. Internal score 3.9 (clients never see scores).', 'Japan guide area=Honmachi; tier=Tier 1; partner=Marriott Stars; score=3.9'),
  ('Waldorf Astoria Osaka', 'Osaka', 'Waldorf Astoria', 'Umeda', 'Tier 1', 'Hilton for Luxury', '4.4', 'jp-guide-waldorf-astoria-osaka', 'Waldorf Astoria Osaka', 'unknown', 'true', 'false', 'Umeda. Guide proposed Tier 1; partner: Hilton for Luxury. Internal score 4.4 (clients never see scores).', 'Japan guide area=Umeda; tier=Tier 1; partner=Hilton for Luxury; score=4.4'),
  ('Conrad Osaka', 'Osaka', 'Conrad', 'Nakanoshima', 'Tier 2', 'Hilton for Luxury', '3.8', 'jp-guide-conrad-osaka', 'Conrad Osaka', 'unknown', 'true', 'false', 'Nakanoshima. Guide proposed Tier 2; partner: Hilton for Luxury. Internal score 3.8 (clients never see scores).', 'Japan guide area=Nakanoshima; tier=Tier 2; partner=Hilton for Luxury; score=3.8'),
  ('Patina Osaka', 'Osaka', 'Patina', 'Nakanoshima', 'Tier 2', 'Serandipians', '3.9', 'jp-guide-patina-osaka', 'Patina Osaka', 'unknown', 'true', 'false', 'Nakanoshima. Guide proposed Tier 2; partner: Serandipians. Internal score 3.9 (clients never see scores).', 'Japan guide area=Nakanoshima; tier=Tier 2; partner=Serandipians; score=3.9'),
  ('Gora Kadan', 'Hakone', '', 'Gora, Hakone', 'Tier 1', 'Relais and Chateaux', '3.5', 'jp-guide-gora-kadan', '', 'unknown', 'true', 'false', 'Gora, Hakone. Guide proposed Tier 1; partner: Relais and Chateaux. Internal score 3.5 (clients never see scores).', 'Japan guide area=Gora, Hakone; tier=Tier 1; partner=Relais and Chateaux; score=3.5'),
  ('ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu', 'Hakone', '', 'Sengokuhara, Hakone', 'Tier 1', 'LHW Vita', '4.2', 'jp-guide-espacio-the-hakone-geihinkan-rin-poh-ki-ryu', 'ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu', 'unknown', 'true', 'false', 'Sengokuhara, Hakone. Guide proposed Tier 1; partner: LHW Vita. Internal score 4.2 (clients never see scores).', 'Japan guide area=Sengokuhara, Hakone; tier=Tier 1; partner=LHW Vita; score=4.2'),
  ('Park Hyatt Niseko Hanazono', 'Niseko', 'Park Hyatt', 'Hanazono', 'Tier 1', 'Hyatt Prive', '3.9', 'jp-guide-park-hyatt-niseko-hanazono', '', 'unknown', 'true', 'false', 'Hanazono. Guide proposed Tier 1; partner: Hyatt Prive. Internal score 3.9 (clients never see scores).', 'Japan guide area=Hanazono; tier=Tier 1; partner=Hyatt Prive; score=3.9'),
  ('Higashiyama Niseko Village, a Ritz-Carlton Reserve', 'Niseko', 'Ritz-Carlton', 'Niseko Village', 'Tier 1', 'Marriott Stars; confirm', '3.1', 'jp-guide-higashiyama-niseko-village-a-ritz-carlton-reserve', '', 'unknown', 'true', 'false', 'Niseko Village. Guide proposed Tier 1; partner: Marriott Stars; confirm. Internal score 3.1 (clients never see scores).', 'Japan guide area=Niseko Village; tier=Tier 1; partner=Marriott Stars; confirm; score=3.1'),
  ('Hinode Hills Niseko', 'Niseko', '', 'Niseko Village', 'Tier 3', 'Hilton for Luxury', 'Not scored', 'jp-guide-hinode-hills-niseko', '', 'unknown', 'true', 'false', 'Niseko Village. Guide proposed Tier 3; partner: Hilton for Luxury. Internal score Not scored (clients never see scores).', 'Japan guide area=Niseko Village; tier=Tier 3; partner=Hilton for Luxury; score=Not scored'),
  ('The Ritz-Carlton, Nikko', 'Nikko', 'Ritz-Carlton', 'Lake Chuzenji', 'Tier 1', 'Marriott Stars', '4.1', 'jp-guide-the-ritz-carlton-nikko', '', 'unknown', 'true', 'false', 'Lake Chuzenji. Guide proposed Tier 1; partner: Marriott Stars. Internal score 4.1 (clients never see scores).', 'Japan guide area=Lake Chuzenji; tier=Tier 1; partner=Marriott Stars; score=4.1'),
  ('Rosewood Miyakojima', 'Miyako Island', 'Rosewood', 'Miyako Island', 'Tier 1', 'Rosewood Elite', '4.0', 'jp-guide-rosewood-miyakojima', 'Rosewood Miyakojima', 'unknown', 'true', 'false', 'Miyako Island. Guide proposed Tier 1; partner: Rosewood Elite. Internal score 4.0 (clients never see scores).', 'Japan guide area=Miyako Island; tier=Tier 1; partner=Rosewood Elite; score=4.0'),
  ('Halekulani Okinawa', 'Okinawa', 'Halekulani', 'Onna, Okinawa', 'Tier 2', 'LHW Vita', '3.7', 'jp-guide-halekulani-okinawa', 'Halekulani Okinawa', 'unknown', 'true', 'false', 'Onna, Okinawa. Guide proposed Tier 2; partner: LHW Vita. Internal score 3.7 (clients never see scores).', 'Japan guide area=Onna, Okinawa; tier=Tier 2; partner=LHW Vita; score=3.7'),
  ('Ryokan Kurashiki', 'Okayama', '', 'Kurashiki', 'Tier 2', 'Confirm', '3.4', 'jp-guide-ryokan-kurashiki', 'Ryokan Kurashiki', 'unknown', 'true', 'false', 'Kurashiki. Guide proposed Tier 2; partner: Confirm. Internal score 3.4 (clients never see scores).', 'Japan guide area=Kurashiki; tier=Tier 2; partner=Confirm; score=3.4')

) AS v(name, city, brand, area, tier, partner, score, external_key, aliases, contract_status, client_ready, placeholder, description, legacy_notes)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_cities ci ON ci.country_id = co.id AND lower(ci.name) = lower(v.city)
WHERE e.entity_type = 'hotel'
  AND e.active = true
  AND e.country_id = co.id
  AND (
    e.external_key = v.external_key
    OR lower(e.name) = lower(v.name)
    OR (v.aliases <> '' AND e.name = ANY (string_to_array(v.aliases, '|')))
    OR exists (
      SELECT 1 FROM unnest(coalesce(e.aliases, '{}'::text[])) a
      WHERE lower(a) = lower(v.name)
    )
  );


-- 7d. Hotel details — luxury_band from proposed tier
INSERT INTO public.kb_hotel_details (entity_id, amenities, style_tags, luxury_band, best_for)
SELECT
  e.id,
  '{}'::text[],
  ARRAY[lower(replace(v.tier, ' ', '_'))],
  v.luxury_band,
  '{}'::text[]
FROM (VALUES

  ('Aman Tokyo', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-aman-tokyo', 'Aman Tokyo'),
  ('Four Seasons Tokyo at Otemachi', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-four-seasons-tokyo-at-otemachi', 'Four Seasons — Tokyo at Otemachi|Four Seasons Tokyo Otemachi'),
  ('Mandarin Oriental Tokyo', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-mandarin-oriental-tokyo', 'Mandarin Oriental, Tokyo|Mandarin Oriental Tokyo'),
  ('Palace Hotel Tokyo', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-palace-hotel-tokyo', 'Palace Hotel Tokyo'),
  ('The Peninsula Tokyo', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-the-peninsula-tokyo', 'Peninsula Tokyo'),
  ('The Okura Tokyo', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-the-okura-tokyo', 'The Okura Tokyo'),
  ('Janu Tokyo', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-janu-tokyo', 'Janu Tokyo'),
  ('The Ritz-Carlton, Tokyo', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-the-ritz-carlton-tokyo', 'The Ritz-Carlton Tokyo|Ritz-Carlton Tokyo'),
  ('Four Seasons Tokyo at Marunouchi', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-four-seasons-tokyo-at-marunouchi', 'Four Seasons — Tokyo at Marunouchi'),
  ('Park Hyatt Tokyo', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-park-hyatt-tokyo', 'Park Hyatt Tokyo'),
  ('Imperial Hotel Tokyo', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-imperial-hotel-tokyo', 'Imperial Hotel, Tokyo'),
  ('Shangri-La Tokyo', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-shangri-la-tokyo', 'Shangri-La Tokyo'),
  ('Grand Hyatt Tokyo', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-grand-hyatt-tokyo', 'Grand Hyatt Tokyo'),
  ('ANA InterContinental Tokyo', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-ana-intercontinental-tokyo', 'ANA InterContinental Tokyo'),
  ('Fairmont Tokyo', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-fairmont-tokyo', 'Fairmont Tokyo'),
  ('1 Hotel Tokyo', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-1-hotel-tokyo', '1 Hotel Tokyo'),
  ('The New Otani Executive House Zen', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-the-new-otani-executive-house-zen', 'The New Otani Executive House Zen'),
  ('Capitol Hotel Tokyu', 'Tokyo', 'Tier 3', 'premium', 'jp-guide-capitol-hotel-tokyu', 'Capitol Hotel Tokyu'),
  ('Kimpton Shinjuku Tokyo', 'Tokyo', 'Tier 3', 'premium', 'jp-guide-kimpton-shinjuku-tokyo', 'Kimpton Shinjuku Tokyo'),
  ('Hotel Indigo Tokyo Shibuya', 'Tokyo', 'Tier 3', 'premium', 'jp-guide-hotel-indigo-tokyo-shibuya', 'Hotel Indigo Tokyo Shibuya'),
  ('BELLUSTAR TOKYO, A Pan Pacific Hotel', 'Tokyo', 'Tier 3', 'premium', 'jp-guide-bellustar-tokyo-a-pan-pacific-hotel', 'BELLUSTAR TOKYO, A Pan Pacific Hotel'),
  ('Aman Kyoto', 'Kyoto', 'Tier 1', 'ultra_luxury', 'jp-guide-aman-kyoto', 'Aman Kyoto'),
  ('Four Seasons Kyoto', 'Kyoto', 'Tier 1', 'ultra_luxury', 'jp-guide-four-seasons-kyoto', 'Four Seasons — Kyoto'),
  ('The Ritz-Carlton Kyoto', 'Kyoto', 'Tier 1', 'ultra_luxury', 'jp-guide-the-ritz-carlton-kyoto', 'The Ritz-Carlton, Kyoto|Ritz-Carlton Kyoto'),
  ('Capella Kyoto', 'Kyoto', 'Tier 1', 'ultra_luxury', 'jp-guide-capella-kyoto', 'Capella Kyoto'),
  ('Hotel The Mitsui Kyoto', 'Kyoto', 'Tier 1', 'ultra_luxury', 'jp-guide-hotel-the-mitsui-kyoto', 'Hotel The Mitsui Kyoto'),
  ('Six Senses Kyoto', 'Kyoto', 'Tier 1', 'ultra_luxury', 'jp-guide-six-senses-kyoto', 'Six Senses Kyoto'),
  ('Park Hyatt Kyoto', 'Kyoto', 'Tier 2', 'luxury', 'jp-guide-park-hyatt-kyoto', 'Park Hyatt Kyoto'),
  ('ROKU Kyoto, LXR Hotels', 'Kyoto', 'Tier 2', 'luxury', 'jp-guide-roku-kyoto-lxr-hotels', 'ROKU Kyoto, LXR Hotels & Resorts'),
  ('Hotel Seiryu Kyoto Kiyomizu', 'Kyoto', 'Tier 2', 'luxury', 'jp-guide-hotel-seiryu-kyoto-kiyomizu', 'The Hotel Seiryu Kyoto Kiyomizu|The Hotel Seiryu Kyoto Kiyomizu'),
  ('Imperial Hotel Kyoto', 'Kyoto', 'Tier 2', 'luxury', 'jp-guide-imperial-hotel-kyoto', 'Imperial Hotel, Kyoto'),
  ('Dusit Thani Kyoto', 'Kyoto', 'Tier 3', 'premium', 'jp-guide-dusit-thani-kyoto', 'Dusit Thani Kyoto'),
  ('FAUCHON L''Hotel Kyoto', 'Kyoto', 'Tier 3', 'premium', 'jp-guide-fauchon-l-hotel-kyoto', 'FAUCHON L''Hotel Kyoto'),
  ('Four Seasons Osaka', 'Osaka', 'Tier 1', 'ultra_luxury', 'jp-guide-four-seasons-osaka', 'Four Seasons — Osaka'),
  ('The St. Regis Osaka', 'Osaka', 'Tier 1', 'ultra_luxury', 'jp-guide-the-st-regis-osaka', ''),
  ('Waldorf Astoria Osaka', 'Osaka', 'Tier 1', 'ultra_luxury', 'jp-guide-waldorf-astoria-osaka', 'Waldorf Astoria Osaka'),
  ('Conrad Osaka', 'Osaka', 'Tier 2', 'luxury', 'jp-guide-conrad-osaka', 'Conrad Osaka'),
  ('Patina Osaka', 'Osaka', 'Tier 2', 'luxury', 'jp-guide-patina-osaka', 'Patina Osaka'),
  ('Gora Kadan', 'Hakone', 'Tier 1', 'ultra_luxury', 'jp-guide-gora-kadan', ''),
  ('ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu', 'Hakone', 'Tier 1', 'ultra_luxury', 'jp-guide-espacio-the-hakone-geihinkan-rin-poh-ki-ryu', 'ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu'),
  ('Park Hyatt Niseko Hanazono', 'Niseko', 'Tier 1', 'ultra_luxury', 'jp-guide-park-hyatt-niseko-hanazono', ''),
  ('Higashiyama Niseko Village, a Ritz-Carlton Reserve', 'Niseko', 'Tier 1', 'ultra_luxury', 'jp-guide-higashiyama-niseko-village-a-ritz-carlton-reserve', ''),
  ('Hinode Hills Niseko', 'Niseko', 'Tier 3', 'premium', 'jp-guide-hinode-hills-niseko', ''),
  ('The Ritz-Carlton, Nikko', 'Nikko', 'Tier 1', 'ultra_luxury', 'jp-guide-the-ritz-carlton-nikko', ''),
  ('Rosewood Miyakojima', 'Miyako Island', 'Tier 1', 'ultra_luxury', 'jp-guide-rosewood-miyakojima', 'Rosewood Miyakojima'),
  ('Halekulani Okinawa', 'Okinawa', 'Tier 2', 'luxury', 'jp-guide-halekulani-okinawa', 'Halekulani Okinawa'),
  ('Ryokan Kurashiki', 'Okayama', 'Tier 2', 'luxury', 'jp-guide-ryokan-kurashiki', 'Ryokan Kurashiki')

) AS v(name, city, tier, luxury_band, external_key, aliases)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_cities ci ON ci.country_id = co.id AND lower(ci.name) = lower(v.city)
JOIN public.kb_entities e ON e.entity_type = 'hotel' AND e.active = true AND e.country_id = co.id
  AND (
    e.external_key = v.external_key
    OR lower(e.name) = lower(v.name)
    OR (v.aliases <> '' AND e.name = ANY (string_to_array(v.aliases, '|')))
    OR exists (
      SELECT 1 FROM unnest(coalesce(e.aliases, '{}'::text[])) a
      WHERE lower(a) = lower(v.name)
    )
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_hotel_details d WHERE d.entity_id = e.id
);

UPDATE public.kb_hotel_details d
SET
  luxury_band = COALESCE(d.luxury_band, v.luxury_band),
  style_tags = CASE
    WHEN d.style_tags = '{}'::text[] THEN ARRAY[lower(replace(v.tier, ' ', '_'))]
    ELSE d.style_tags
  END,
  updated_at = now()
FROM (VALUES

  ('Aman Tokyo', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-aman-tokyo', 'Aman Tokyo'),
  ('Four Seasons Tokyo at Otemachi', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-four-seasons-tokyo-at-otemachi', 'Four Seasons — Tokyo at Otemachi|Four Seasons Tokyo Otemachi'),
  ('Mandarin Oriental Tokyo', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-mandarin-oriental-tokyo', 'Mandarin Oriental, Tokyo|Mandarin Oriental Tokyo'),
  ('Palace Hotel Tokyo', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-palace-hotel-tokyo', 'Palace Hotel Tokyo'),
  ('The Peninsula Tokyo', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-the-peninsula-tokyo', 'Peninsula Tokyo'),
  ('The Okura Tokyo', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-the-okura-tokyo', 'The Okura Tokyo'),
  ('Janu Tokyo', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-janu-tokyo', 'Janu Tokyo'),
  ('The Ritz-Carlton, Tokyo', 'Tokyo', 'Tier 1', 'ultra_luxury', 'jp-guide-the-ritz-carlton-tokyo', 'The Ritz-Carlton Tokyo|Ritz-Carlton Tokyo'),
  ('Four Seasons Tokyo at Marunouchi', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-four-seasons-tokyo-at-marunouchi', 'Four Seasons — Tokyo at Marunouchi'),
  ('Park Hyatt Tokyo', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-park-hyatt-tokyo', 'Park Hyatt Tokyo'),
  ('Imperial Hotel Tokyo', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-imperial-hotel-tokyo', 'Imperial Hotel, Tokyo'),
  ('Shangri-La Tokyo', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-shangri-la-tokyo', 'Shangri-La Tokyo'),
  ('Grand Hyatt Tokyo', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-grand-hyatt-tokyo', 'Grand Hyatt Tokyo'),
  ('ANA InterContinental Tokyo', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-ana-intercontinental-tokyo', 'ANA InterContinental Tokyo'),
  ('Fairmont Tokyo', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-fairmont-tokyo', 'Fairmont Tokyo'),
  ('1 Hotel Tokyo', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-1-hotel-tokyo', '1 Hotel Tokyo'),
  ('The New Otani Executive House Zen', 'Tokyo', 'Tier 2', 'luxury', 'jp-guide-the-new-otani-executive-house-zen', 'The New Otani Executive House Zen'),
  ('Capitol Hotel Tokyu', 'Tokyo', 'Tier 3', 'premium', 'jp-guide-capitol-hotel-tokyu', 'Capitol Hotel Tokyu'),
  ('Kimpton Shinjuku Tokyo', 'Tokyo', 'Tier 3', 'premium', 'jp-guide-kimpton-shinjuku-tokyo', 'Kimpton Shinjuku Tokyo'),
  ('Hotel Indigo Tokyo Shibuya', 'Tokyo', 'Tier 3', 'premium', 'jp-guide-hotel-indigo-tokyo-shibuya', 'Hotel Indigo Tokyo Shibuya'),
  ('BELLUSTAR TOKYO, A Pan Pacific Hotel', 'Tokyo', 'Tier 3', 'premium', 'jp-guide-bellustar-tokyo-a-pan-pacific-hotel', 'BELLUSTAR TOKYO, A Pan Pacific Hotel'),
  ('Aman Kyoto', 'Kyoto', 'Tier 1', 'ultra_luxury', 'jp-guide-aman-kyoto', 'Aman Kyoto'),
  ('Four Seasons Kyoto', 'Kyoto', 'Tier 1', 'ultra_luxury', 'jp-guide-four-seasons-kyoto', 'Four Seasons — Kyoto'),
  ('The Ritz-Carlton Kyoto', 'Kyoto', 'Tier 1', 'ultra_luxury', 'jp-guide-the-ritz-carlton-kyoto', 'The Ritz-Carlton, Kyoto|Ritz-Carlton Kyoto'),
  ('Capella Kyoto', 'Kyoto', 'Tier 1', 'ultra_luxury', 'jp-guide-capella-kyoto', 'Capella Kyoto'),
  ('Hotel The Mitsui Kyoto', 'Kyoto', 'Tier 1', 'ultra_luxury', 'jp-guide-hotel-the-mitsui-kyoto', 'Hotel The Mitsui Kyoto'),
  ('Six Senses Kyoto', 'Kyoto', 'Tier 1', 'ultra_luxury', 'jp-guide-six-senses-kyoto', 'Six Senses Kyoto'),
  ('Park Hyatt Kyoto', 'Kyoto', 'Tier 2', 'luxury', 'jp-guide-park-hyatt-kyoto', 'Park Hyatt Kyoto'),
  ('ROKU Kyoto, LXR Hotels', 'Kyoto', 'Tier 2', 'luxury', 'jp-guide-roku-kyoto-lxr-hotels', 'ROKU Kyoto, LXR Hotels & Resorts'),
  ('Hotel Seiryu Kyoto Kiyomizu', 'Kyoto', 'Tier 2', 'luxury', 'jp-guide-hotel-seiryu-kyoto-kiyomizu', 'The Hotel Seiryu Kyoto Kiyomizu|The Hotel Seiryu Kyoto Kiyomizu'),
  ('Imperial Hotel Kyoto', 'Kyoto', 'Tier 2', 'luxury', 'jp-guide-imperial-hotel-kyoto', 'Imperial Hotel, Kyoto'),
  ('Dusit Thani Kyoto', 'Kyoto', 'Tier 3', 'premium', 'jp-guide-dusit-thani-kyoto', 'Dusit Thani Kyoto'),
  ('FAUCHON L''Hotel Kyoto', 'Kyoto', 'Tier 3', 'premium', 'jp-guide-fauchon-l-hotel-kyoto', 'FAUCHON L''Hotel Kyoto'),
  ('Four Seasons Osaka', 'Osaka', 'Tier 1', 'ultra_luxury', 'jp-guide-four-seasons-osaka', 'Four Seasons — Osaka'),
  ('The St. Regis Osaka', 'Osaka', 'Tier 1', 'ultra_luxury', 'jp-guide-the-st-regis-osaka', ''),
  ('Waldorf Astoria Osaka', 'Osaka', 'Tier 1', 'ultra_luxury', 'jp-guide-waldorf-astoria-osaka', 'Waldorf Astoria Osaka'),
  ('Conrad Osaka', 'Osaka', 'Tier 2', 'luxury', 'jp-guide-conrad-osaka', 'Conrad Osaka'),
  ('Patina Osaka', 'Osaka', 'Tier 2', 'luxury', 'jp-guide-patina-osaka', 'Patina Osaka'),
  ('Gora Kadan', 'Hakone', 'Tier 1', 'ultra_luxury', 'jp-guide-gora-kadan', ''),
  ('ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu', 'Hakone', 'Tier 1', 'ultra_luxury', 'jp-guide-espacio-the-hakone-geihinkan-rin-poh-ki-ryu', 'ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu'),
  ('Park Hyatt Niseko Hanazono', 'Niseko', 'Tier 1', 'ultra_luxury', 'jp-guide-park-hyatt-niseko-hanazono', ''),
  ('Higashiyama Niseko Village, a Ritz-Carlton Reserve', 'Niseko', 'Tier 1', 'ultra_luxury', 'jp-guide-higashiyama-niseko-village-a-ritz-carlton-reserve', ''),
  ('Hinode Hills Niseko', 'Niseko', 'Tier 3', 'premium', 'jp-guide-hinode-hills-niseko', ''),
  ('The Ritz-Carlton, Nikko', 'Nikko', 'Tier 1', 'ultra_luxury', 'jp-guide-the-ritz-carlton-nikko', ''),
  ('Rosewood Miyakojima', 'Miyako Island', 'Tier 1', 'ultra_luxury', 'jp-guide-rosewood-miyakojima', 'Rosewood Miyakojima'),
  ('Halekulani Okinawa', 'Okinawa', 'Tier 2', 'luxury', 'jp-guide-halekulani-okinawa', 'Halekulani Okinawa'),
  ('Ryokan Kurashiki', 'Okayama', 'Tier 2', 'luxury', 'jp-guide-ryokan-kurashiki', 'Ryokan Kurashiki')

) AS v(name, city, tier, luxury_band, external_key, aliases)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_entities e ON e.entity_type = 'hotel' AND e.active = true AND e.country_id = co.id
  AND (
    e.external_key = v.external_key
    OR lower(e.name) = lower(v.name)
    OR (v.aliases <> '' AND e.name = ANY (string_to_array(v.aliases, '|')))
    OR exists (
      SELECT 1 FROM unnest(coalesce(e.aliases, '{}'::text[])) a
      WHERE lower(a) = lower(v.name)
    )
  )
WHERE d.entity_id = e.id;


-- 7e. Consortia / partner clubs from guide partner column
INSERT INTO public.kb_hotel_consortia (entity_id, club_key, club_name)
SELECT e.id, v.club_key, v.club_name
FROM (VALUES

  ('Four Seasons Tokyo at Otemachi', 'Tokyo', 'jp-guide-four-seasons-tokyo-at-otemachi', 'Four Seasons — Tokyo at Otemachi|Four Seasons Tokyo Otemachi', 'fs_preferred', 'Four Seasons Preferred Partner'),
  ('Mandarin Oriental Tokyo', 'Tokyo', 'jp-guide-mandarin-oriental-tokyo', 'Mandarin Oriental, Tokyo|Mandarin Oriental Tokyo', 'mo_fan_club', 'Mandarin Oriental Fan Club'),
  ('Palace Hotel Tokyo', 'Tokyo', 'jp-guide-palace-hotel-tokyo', 'Palace Hotel Tokyo', 'palace_leaders_club', 'Leaders Club'),
  ('The Peninsula Tokyo', 'Tokyo', 'jp-guide-the-peninsula-tokyo', 'Peninsula Tokyo', 'peninsula', 'Peninsula'),
  ('The Okura Tokyo', 'Tokyo', 'jp-guide-the-okura-tokyo', 'The Okura Tokyo', 'lhw_vita', 'LHW Vita'),
  ('Janu Tokyo', 'Tokyo', 'jp-guide-janu-tokyo', 'Janu Tokyo', 'serandipians', 'Serandipians'),
  ('The Ritz-Carlton, Tokyo', 'Tokyo', 'jp-guide-the-ritz-carlton-tokyo', 'The Ritz-Carlton Tokyo|Ritz-Carlton Tokyo', 'marriott_stars', 'Marriott Stars'),
  ('Four Seasons Tokyo at Marunouchi', 'Tokyo', 'jp-guide-four-seasons-tokyo-at-marunouchi', 'Four Seasons — Tokyo at Marunouchi', 'fs_preferred', 'Four Seasons Preferred Partner'),
  ('Park Hyatt Tokyo', 'Tokyo', 'jp-guide-park-hyatt-tokyo', 'Park Hyatt Tokyo', 'hyatt_prive', 'Hyatt Prive'),
  ('Imperial Hotel Tokyo', 'Tokyo', 'jp-guide-imperial-hotel-tokyo', 'Imperial Hotel, Tokyo', 'lhw_vita', 'LHW Vita'),
  ('Shangri-La Tokyo', 'Tokyo', 'jp-guide-shangri-la-tokyo', 'Shangri-La Tokyo', 'shangri_la', 'Shangri-La'),
  ('Grand Hyatt Tokyo', 'Tokyo', 'jp-guide-grand-hyatt-tokyo', 'Grand Hyatt Tokyo', 'hyatt_prive', 'Hyatt Prive'),
  ('ANA InterContinental Tokyo', 'Tokyo', 'jp-guide-ana-intercontinental-tokyo', 'ANA InterContinental Tokyo', 'ihg', 'IHG'),
  ('Fairmont Tokyo', 'Tokyo', 'jp-guide-fairmont-tokyo', 'Fairmont Tokyo', 'accor', 'Accor'),
  ('Capitol Hotel Tokyu', 'Tokyo', 'jp-guide-capitol-hotel-tokyu', 'Capitol Hotel Tokyu', 'preferred_hotels', 'Preferred Hotels'),
  ('Kimpton Shinjuku Tokyo', 'Tokyo', 'jp-guide-kimpton-shinjuku-tokyo', 'Kimpton Shinjuku Tokyo', 'ihg', 'IHG'),
  ('Hotel Indigo Tokyo Shibuya', 'Tokyo', 'jp-guide-hotel-indigo-tokyo-shibuya', 'Hotel Indigo Tokyo Shibuya', 'ihg', 'IHG'),
  ('Four Seasons Kyoto', 'Kyoto', 'jp-guide-four-seasons-kyoto', 'Four Seasons — Kyoto', 'fs_preferred', 'Four Seasons Preferred Partner'),
  ('The Ritz-Carlton Kyoto', 'Kyoto', 'jp-guide-the-ritz-carlton-kyoto', 'The Ritz-Carlton, Kyoto|Ritz-Carlton Kyoto', 'marriott_stars', 'Marriott Stars'),
  ('Capella Kyoto', 'Kyoto', 'jp-guide-capella-kyoto', 'Capella Kyoto', 'lhw_vita', 'LHW Vita'),
  ('Capella Kyoto', 'Kyoto', 'jp-guide-capella-kyoto', 'Capella Kyoto', 'serandipians', 'Serandipians'),
  ('Hotel The Mitsui Kyoto', 'Kyoto', 'jp-guide-hotel-the-mitsui-kyoto', 'Hotel The Mitsui Kyoto', 'marriott_stars', 'Marriott Stars'),
  ('Six Senses Kyoto', 'Kyoto', 'jp-guide-six-senses-kyoto', 'Six Senses Kyoto', 'ihg_destined', 'IHG Destined'),
  ('Six Senses Kyoto', 'Kyoto', 'jp-guide-six-senses-kyoto', 'Six Senses Kyoto', 'ihg', 'IHG'),
  ('Park Hyatt Kyoto', 'Kyoto', 'jp-guide-park-hyatt-kyoto', 'Park Hyatt Kyoto', 'hyatt_prive', 'Hyatt Prive'),
  ('ROKU Kyoto, LXR Hotels', 'Kyoto', 'jp-guide-roku-kyoto-lxr-hotels', 'ROKU Kyoto, LXR Hotels & Resorts', 'hilton_for_luxury', 'Hilton for Luxury'),
  ('Hotel Seiryu Kyoto Kiyomizu', 'Kyoto', 'jp-guide-hotel-seiryu-kyoto-kiyomizu', 'The Hotel Seiryu Kyoto Kiyomizu|The Hotel Seiryu Kyoto Kiyomizu', 'lhw_vita', 'LHW Vita'),
  ('Imperial Hotel Kyoto', 'Kyoto', 'jp-guide-imperial-hotel-kyoto', 'Imperial Hotel, Kyoto', 'lhw_vita', 'LHW Vita'),
  ('Dusit Thani Kyoto', 'Kyoto', 'jp-guide-dusit-thani-kyoto', 'Dusit Thani Kyoto', 'serandipians', 'Serandipians'),
  ('FAUCHON L''Hotel Kyoto', 'Kyoto', 'jp-guide-fauchon-l-hotel-kyoto', 'FAUCHON L''Hotel Kyoto', 'slh_within', 'SLH Within'),
  ('Four Seasons Osaka', 'Osaka', 'jp-guide-four-seasons-osaka', 'Four Seasons — Osaka', 'fs_preferred', 'Four Seasons Preferred Partner'),
  ('The St. Regis Osaka', 'Osaka', 'jp-guide-the-st-regis-osaka', '', 'marriott_stars', 'Marriott Stars'),
  ('Waldorf Astoria Osaka', 'Osaka', 'jp-guide-waldorf-astoria-osaka', 'Waldorf Astoria Osaka', 'hilton_for_luxury', 'Hilton for Luxury'),
  ('Conrad Osaka', 'Osaka', 'jp-guide-conrad-osaka', 'Conrad Osaka', 'hilton_for_luxury', 'Hilton for Luxury'),
  ('Patina Osaka', 'Osaka', 'jp-guide-patina-osaka', 'Patina Osaka', 'serandipians', 'Serandipians'),
  ('Gora Kadan', 'Hakone', 'jp-guide-gora-kadan', '', 'relais_chateaux', 'Relais & Châteaux'),
  ('ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu', 'Hakone', 'jp-guide-espacio-the-hakone-geihinkan-rin-poh-ki-ryu', 'ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu', 'lhw_vita', 'LHW Vita'),
  ('Park Hyatt Niseko Hanazono', 'Niseko', 'jp-guide-park-hyatt-niseko-hanazono', '', 'hyatt_prive', 'Hyatt Prive'),
  ('Higashiyama Niseko Village, a Ritz-Carlton Reserve', 'Niseko', 'jp-guide-higashiyama-niseko-village-a-ritz-carlton-reserve', '', 'marriott_stars', 'Marriott Stars'),
  ('Hinode Hills Niseko', 'Niseko', 'jp-guide-hinode-hills-niseko', '', 'hilton_for_luxury', 'Hilton for Luxury'),
  ('The Ritz-Carlton, Nikko', 'Nikko', 'jp-guide-the-ritz-carlton-nikko', '', 'marriott_stars', 'Marriott Stars'),
  ('Rosewood Miyakojima', 'Miyako Island', 'jp-guide-rosewood-miyakojima', 'Rosewood Miyakojima', 'rosewood_elite', 'Rosewood Elite'),
  ('Halekulani Okinawa', 'Okinawa', 'jp-guide-halekulani-okinawa', 'Halekulani Okinawa', 'lhw_vita', 'LHW Vita')

) AS v(name, city, external_key, aliases, club_key, club_name)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_entities e ON e.entity_type = 'hotel' AND e.active = true AND e.country_id = co.id
  AND (
    e.external_key = v.external_key
    OR lower(e.name) = lower(v.name)
    OR (v.aliases <> '' AND e.name = ANY (string_to_array(v.aliases, '|')))
    OR exists (
      SELECT 1 FROM unnest(coalesce(e.aliases, '{}'::text[])) a
      WHERE lower(a) = lower(v.name)
    )
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_hotel_consortia c
  WHERE c.entity_id = e.id AND c.club_key = v.club_key
);


-- =============================================================================
-- 8. Experience bank (activities + restaurants) — unverified per guide
-- =============================================================================
-- Guide: nothing verified yet; advisor_take blank. client_ready = false.
-- Experience → activity entity_type. Restaurant/Bar → restaurant.

INSERT INTO public.kb_entities (
  entity_type, name, description, kb_tier, provenance, source_name,
  region_id, country_id, city_id,
  contract_status, client_ready, placeholder, not_yet_open,
  external_key, external_ids, legacy_notes, active
)
SELECT
  v.entity_type,
  v.name,
  v.description,
  'kb_scraped',
  'kb',
  'Japan Destination Guide — PureLuxe Atlas KB (2026-11-03)',
  co.region_id,
  co.id,
  ci.id,
  'unknown',
  false,
  false,
  false,
  v.external_key,
  jsonb_build_object(
    'japan_guide', true,
    'guide_type', v.guide_type,
    'who_it_suits', v.who_it_suits,
    'lead_time', v.lead_time,
    'veg_jain', v.veg_jain
  ),
  v.legacy_notes,
  true
FROM (VALUES

  ('activity', 'Senso-ji and Nakamise, Asakusa', 'Tokyo', 'Activity', 'All', 'None (walk-in)', 'n/a', 'jp-guide-senso-ji-and-nakamise-asakusa', 'Tokyo''s oldest temple, entered through the Kaminarimon gate and the Nakamise lane of snack and souvenir stalls. Quietest early morning or after dark. Suits: All. Booking lead time: None (walk-in). Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=None (walk-in); veg/jain=n/a'),
  ('activity', 'Meiji Shrine, Yoyogi Park, Harajuku', 'Tokyo', 'Activity', 'All, families', 'None', 'n/a', 'jp-guide-meiji-shrine-yoyogi-park-harajuku', 'A forested Shinto shrine beside Yoyogi Park, a short walk from Harajuku''s fashion streets and Omotesando. Suits: All, families. Booking lead time: None. Vegetarian/Jain: n/a.', 'type=Activity; who=All, families; lead=None; veg/jain=n/a'),
  ('activity', 'Imperial Palace gardens', 'Tokyo', 'Activity', 'All', 'Confirm if booking needed', 'n/a', 'jp-guide-imperial-palace-gardens', 'The public East Gardens of the palace, with moats, stone walls and lawns beside Tokyo Station. Free entry; closed Mondays and Fridays. Suits: All. Booking lead time: Confirm if booking needed. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=Confirm if booking needed; veg/jain=n/a'),
  ('activity', 'Shibuya Crossing (evening)', 'Tokyo', 'Activity', 'All', 'None', 'n/a', 'jp-guide-shibuya-crossing-evening', 'The busiest pedestrian crossing in the world. Best at dusk, watched from a cafe above or crossed on foot. Suits: All. Booking lead time: None. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=None; veg/jain=n/a'),
  ('activity', 'Shibuya Sky at sunset', 'Tokyo', 'Experience', 'Couples, adults', 'Tickets open about 2 weeks ahead; sunset slots sell out first (evening slots were sold out in Nov 2025)', 'n/a', 'jp-guide-shibuya-sky-at-sunset', 'Open-air rooftop deck on top of Shibuya Scramble Square with a view over the crossing and, on clear days, Mt Fuji. Suits: Couples, adults. Booking lead time: Tickets open about 2 weeks ahead; sunset slots sell out first (evening slots were sold out in Nov 2025). Vegetarian/Jain: n/a.', 'type=Experience; who=Couples, adults; lead=Tickets open about 2 weeks ahead; sunset slots sell out first (evening slots were sold out in Nov 2025); veg/jain=n/a'),
  ('activity', 'Omotesando and Ginza shopping', 'Tokyo', 'Activity', 'Adults', 'None', 'n/a', 'jp-guide-omotesando-and-ginza-shopping', 'Omotesando for architect-designed flagship stores on a tree-lined avenue; Ginza for department stores and luxury brands. Suits: Adults. Booking lead time: None. Vegetarian/Jain: n/a.', 'type=Activity; who=Adults; lead=None; veg/jain=n/a'),
  ('activity', 'teamLab museum', 'Tokyo', 'Experience', 'Families, all', 'Confirm', 'n/a', 'jp-guide-teamlab-museum', 'Two museums: Borderless at Azabudai Hills and Planets in Toyosu, where you walk barefoot through water. Immersive digital art installations; entry is by timed ticket. Suits: Families, all. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Experience; who=Families, all; lead=Confirm; veg/jain=n/a'),
  ('activity', 'Behind-the-scenes sumo access', 'Tokyo', 'Experience', 'All, families', 'Confirm; subject to availability', 'n/a', 'jp-guide-behind-the-scenes-sumo-access', 'Access to the world of sumo beyond the tournament, usually a stable visit or morning practice arranged through a local guide. Suits: All, families. Booking lead time: Confirm; subject to availability. Vegetarian/Jain: n/a.', 'type=Experience; who=All, families; lead=Confirm; subject to availability; veg/jain=n/a'),
  ('activity', 'Food and nightlife tours', 'Tokyo', 'Experience', 'Adults', 'Confirm', 'Not checked', 'jp-guide-food-and-nightlife-tours', 'Guided evenings through Tokyo''s eating and drinking districts, with tastings at small local venues. Suits: Adults. Booking lead time: Confirm. Vegetarian/Jain: Not checked.', 'type=Experience; who=Adults; lead=Confirm; veg/jain=Not checked'),
  ('activity', 'Sumida River cruise', 'Tokyo', 'Experience', 'All', 'Confirm', 'n/a', 'jp-guide-sumida-river-cruise', 'A boat ride along the Sumida River from Asakusa toward the bay, passing Skytree and the bridges. Suits: All. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Experience; who=All; lead=Confirm; veg/jain=n/a'),
  ('activity', 'Shinjuku Gyoen hanami picnic', 'Tokyo', 'Experience', 'All', 'Seasonal (cherry blossom)', 'n/a', 'jp-guide-shinjuku-gyoen-hanami-picnic', 'A spring picnic under cherry blossom in a large landscaped garden. Only possible in blossom season, around late March to early April. Suits: All. Booking lead time: Seasonal (cherry blossom). Vegetarian/Jain: n/a.', 'type=Experience; who=All; lead=Seasonal (cherry blossom); veg/jain=n/a'),
  ('activity', 'Chidori-ga-fuchi blossom viewing', 'Tokyo', 'Activity', 'All', 'Seasonal; weather permitting', 'n/a', 'jp-guide-chidori-ga-fuchi-blossom-viewing', 'The moat beside the Imperial Palace, lined with cherry trees. Blossom season only. Suits: All. Booking lead time: Seasonal; weather permitting. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=Seasonal; weather permitting; veg/jain=n/a'),
  ('activity', 'Driving tour of Mt Fuji from Tokyo', 'Tokyo', 'Experience', 'All', 'Confirm', 'n/a', 'jp-guide-driving-tour-of-mt-fuji-from-tokyo', 'A private day by car from Tokyo to Mt Fuji''s viewpoints. The view depends on clear weather. Suits: All. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Experience; who=All; lead=Confirm; veg/jain=n/a'),
  ('activity', 'Tokyo art scene with a local expert; Mori Art and Nezu museums', 'Tokyo', 'Experience', 'Adults', 'Confirm', 'n/a', 'jp-guide-tokyo-art-scene-with-a-local-expert-mori-art-and-nezu-museums', 'Guided visits to galleries and museums, such as the Mori Art Museum in Roppongi Hills and the Nezu Museum and its garden in Aoyama. Suits: Adults. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Experience; who=Adults; lead=Confirm; veg/jain=n/a'),
  ('activity', 'Tokyo Skytree, Akihabara', 'Tokyo', 'Activity', 'Families, all', 'Confirm', 'n/a', 'jp-guide-tokyo-skytree-akihabara', 'Skytree is a 634 m tower with two observation decks; Akihabara is the electronics, anime and game district. Suits: Families, all. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Activity; who=Families, all; lead=Confirm; veg/jain=n/a'),
  ('activity', 'Monkey karting', 'Tokyo', 'Activity', 'Younger adults, families', 'Confirm licence requirements', 'n/a', 'jp-guide-monkey-karting', 'Guided go-karting through Tokyo''s streets, usually in costume. Suits: Younger adults, families. Booking lead time: Confirm licence requirements. Vegetarian/Jain: n/a.', 'type=Activity; who=Younger adults, families; lead=Confirm licence requirements; veg/jain=n/a'),
  ('activity', 'Tokyo Disneyland and DisneySea', 'Tokyo', 'Activity', 'Families', 'Confirm', 'n/a', 'jp-guide-tokyo-disneyland-and-disneysea', 'Two separate parks at Maihama. Each is a full day. Suits: Families. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Activity; who=Families; lead=Confirm; veg/jain=n/a'),
  ('activity', 'Golden Gai drinks; rooftop and speakeasy bars', 'Tokyo', 'Activity', 'Adults', 'Confirm', 'n/a', 'jp-guide-golden-gai-drinks-rooftop-and-speakeasy-bars', 'Golden Gai is a Shinjuku alley of tiny bars that seat a handful each. Rooftop and hidden bars suit a calmer night. Suits: Adults. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Activity; who=Adults; lead=Confirm; veg/jain=n/a'),
  ('activity', 'Tsukiji outer market sushi breakfast; sushi-making class at the Peninsula', 'Tokyo', 'Experience', 'Adults', 'None for the market stalls', 'Not for vegetarians', 'jp-guide-tsukiji-outer-market-sushi-breakfast-sushi-making-class-at-the-peninsula', 'Street stalls and small sushi counters in the outer market. The tuna auction moved to Toyosu in 2018, so the old Tokyo Guide notes on Tsukiji auctions are out of date. Suits: Adults. Booking lead time: None for the market stalls. Vegetarian/Jain: Not for vegetarians.', 'type=Experience; who=Adults; lead=None for the market stalls; veg/jain=Not for vegetarians'),
  ('activity', 'Mt Takao day trip', 'Tokyo', 'Activity', 'Nature lovers', 'None', 'n/a', 'jp-guide-mt-takao-day-trip', 'A hiking mountain about an hour from central Tokyo, with a temple, trails and a cable car. Cherry blossom there comes about 2 weeks after the city. Suits: Nature lovers. Booking lead time: None. Vegetarian/Jain: n/a.', 'type=Activity; who=Nature lovers; lead=None; veg/jain=n/a'),
  ('restaurant', 'Narisawa', 'Tokyo', 'Restaurant (2 Michelin stars)', 'Adults, special occasion', 'Book through omakase.in or by phone; confirm lead time', 'Fixed menu, not suited to non-eaters', 'jp-guide-narisawa', '2025 Suits: Adults, special occasion. Booking lead time: Book through omakase.in or by phone; confirm lead time. Vegetarian/Jain: Fixed menu, not suited to non-eaters.', 'type=Restaurant (2 Michelin stars); who=Adults, special occasion; lead=Book through omakase.in or by phone; confirm lead time; veg/jain=Fixed menu, not suited to non-eaters'),
  ('restaurant', 'Den', 'Tokyo', 'Restaurant (2 Michelin stars)', 'Adults', 'Bookings open 2 months ahead; the phone line is hard to reach', 'Menu changes daily; ask', 'jp-guide-den', 'to-do list Suits: Adults. Booking lead time: Bookings open 2 months ahead; the phone line is hard to reach. Vegetarian/Jain: Menu changes daily; ask.', 'type=Restaurant (2 Michelin stars); who=Adults; lead=Bookings open 2 months ahead; the phone line is hard to reach; veg/jain=Menu changes daily; ask'),
  ('restaurant', 'Maz Tokyo', 'Tokyo', 'Restaurant (2 Michelin stars, Peruvian with Japanese ingredients)', 'Adults', 'Book through omakase.in; closed Tuesdays', 'Not checked', 'jp-guide-maz-tokyo', 'to-do list Suits: Adults. Booking lead time: Book through omakase.in; closed Tuesdays. Vegetarian/Jain: Not checked.', 'type=Restaurant (2 Michelin stars, Peruvian with Japanese ingredients); who=Adults; lead=Book through omakase.in; closed Tuesdays; veg/jain=Not checked'),
  ('restaurant', 'Daigo', 'Tokyo', 'Restaurant (shojin kaiseki, 1 Michelin star)', 'Vegetarian guests who accept fish stock', 'Confirm', 'Shojin, but Michelin notes dried bonito in the broth, so not fully vegetarian, not vegan and not Jain; confirm', 'jp-guide-daigo', 'to-do list, 2025 (alternative) Suits: Vegetarian guests who accept fish stock. Booking lead time: Confirm. Vegetarian/Jain: Shojin, but Michelin notes dried bonito in the broth, so not fully vegetarian, not vegan and not Jain; confirm.', 'type=Restaurant (shojin kaiseki, 1 Michelin star); who=Vegetarian guests who accept fish stock; lead=Confirm; veg/jain=Shojin, but Michelin notes dried bonito in the broth, so not fully vegetarian, not vegan and not Jain; confirm'),
  ('restaurant', 'Tofuya Ukai (Shiba, below Tokyo Tower)', 'Tokyo', 'Restaurant (tofu multi-course, garden)', 'All', 'Often fully booked; confirm early (cancellation fees apply)', 'Tofu-led, but courses can include seasonal seafood; confirm a vegetarian course', 'jp-guide-tofuya-ukai-shiba-below-tokyo-tower', '2019, to-do list Suits: All. Booking lead time: Often fully booked; confirm early (cancellation fees apply). Vegetarian/Jain: Tofu-led, but courses can include seasonal seafood; confirm a vegetarian course.', 'type=Restaurant (tofu multi-course, garden); who=All; lead=Often fully booked; confirm early (cancellation fees apply); veg/jain=Tofu-led, but courses can include seasonal seafood; confirm a vegetarian course'),
  ('restaurant', 'Ten-ichi Tempura (The Peninsula Tokyo; the 2019 note said Imperial Hotel)', 'Tokyo', 'Restaurant', 'Adults', 'Confirm', 'Seafood and vegetable tempura; no vegetarian option stated, confirm. Closed Wednesdays', 'jp-guide-ten-ichi-tempura-the-peninsula-tokyo-the-2019-note-said-imperial-hotel', '2019 Suits: Adults. Booking lead time: Confirm. Vegetarian/Jain: Seafood and vegetable tempura; no vegetarian option stated, confirm. Closed Wednesdays.', 'type=Restaurant; who=Adults; lead=Confirm; veg/jain=Seafood and vegetable tempura; no vegetarian option stated, confirm. Closed Wednesdays'),
  ('restaurant', 'Robayata Roppongi', 'Tokyo', 'Restaurant', 'Groups, adults', 'Confirm', 'Not checked', 'jp-guide-robayata-roppongi', 'to-do list (not found in this check) Suits: Groups, adults. Booking lead time: Confirm. Vegetarian/Jain: Not checked.', 'type=Restaurant; who=Groups, adults; lead=Confirm; veg/jain=Not checked'),
  ('restaurant', 'Gonpachi Nishi-Azabu', 'Tokyo', 'Restaurant', 'Groups, first-timers', 'Booked via hotel concierge', 'Not checked', 'jp-guide-gonpachi-nishi-azabu', '2019 (twice), to-do list Suits: Groups, first-timers. Booking lead time: Booked via hotel concierge. Vegetarian/Jain: Not checked.', 'type=Restaurant; who=Groups, first-timers; lead=Booked via hotel concierge; veg/jain=Not checked'),
  ('restaurant', 'The Pizza Bar on 38th (Mandarin Oriental Tokyo)', 'Tokyo', 'Restaurant', 'Mixed groups, vegetarians', 'About 3 months'' wait reported', 'Pizza; vegetarian toppings likely, confirm', 'jp-guide-the-pizza-bar-on-38th-mandarin-oriental-tokyo', '2025, to-do list Suits: Mixed groups, vegetarians. Booking lead time: About 3 months'' wait reported. Vegetarian/Jain: Pizza; vegetarian toppings likely, confirm.', 'type=Restaurant; who=Mixed groups, vegetarians; lead=About 3 months'' wait reported; veg/jain=Pizza; vegetarian toppings likely, confirm'),
  ('restaurant', 'Pizza Studio Tamaki', 'Tokyo', 'Restaurant', 'Mixed groups', 'Confirm', 'Pizza', 'jp-guide-pizza-studio-tamaki', 'Apr 2026 draft, to-do list Suits: Mixed groups. Booking lead time: Confirm. Vegetarian/Jain: Pizza.', 'type=Restaurant; who=Mixed groups; lead=Confirm; veg/jain=Pizza'),
  ('restaurant', 'Pigneto (Four Seasons Otemachi)', 'Tokyo', 'Restaurant', 'Mixed groups', 'Confirm', 'Italian, vegetarian likely', 'jp-guide-pigneto-four-seasons-otemachi', 'Apr 2026 draft Suits: Mixed groups. Booking lead time: Confirm. Vegetarian/Jain: Italian, vegetarian likely.', 'type=Restaurant; who=Mixed groups; lead=Confirm; veg/jain=Italian, vegetarian likely'),
  ('restaurant', 'Enoteca Pinchiori', 'Tokyo', 'Restaurant', 'Adults', 'Unconfirmed: only the Nagoya branch was found', 'Not checked', 'jp-guide-enoteca-pinchiori', 'to-do list Suits: Adults. Booking lead time: Unconfirmed: only the Nagoya branch was found. Vegetarian/Jain: Not checked.', 'type=Restaurant; who=Adults; lead=Unconfirmed: only the Nagoya branch was found; veg/jain=Not checked'),
  ('restaurant', 'Tokyo Confidential', 'Tokyo', 'Bar (World''s 50 Best Bars)', 'Adults', 'Confirm', 'n/a', 'jp-guide-tokyo-confidential', 'to-do list Suits: Adults. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Bar (World''s 50 Best Bars); who=Adults; lead=Confirm; veg/jain=n/a'),
  ('restaurant', 'Kozue (Park Hyatt)', 'Tokyo', 'Restaurant', 'Adults', 'Booked via concierge; dietary needs subject to confirmation', 'Subject to confirmation', 'jp-guide-kozue-park-hyatt', '2019 Suits: Adults. Booking lead time: Booked via concierge; dietary needs subject to confirmation. Vegetarian/Jain: Subject to confirmation.', 'type=Restaurant; who=Adults; lead=Booked via concierge; dietary needs subject to confirmation; veg/jain=Subject to confirmation'),
  ('restaurant', 'Arva (Aman Tokyo, Otemachi Tower; open to non-residents)', 'Tokyo', 'Restaurant (Italian)', 'Groups, adults', 'Booked via hotel concierge', 'Not checked', 'jp-guide-arva-aman-tokyo-otemachi-tower-open-to-non-residents', '2019 Suits: Groups, adults. Booking lead time: Booked via hotel concierge. Vegetarian/Jain: Not checked.', 'type=Restaurant (Italian); who=Groups, adults; lead=Booked via hotel concierge; veg/jain=Not checked'),
  ('restaurant', 'L''Effervescence', 'Tokyo', 'Restaurant (3 Michelin stars, French)', 'Adults', 'Confirm', 'Not checked', 'jp-guide-l-effervescence', '2019 Suits: Adults. Booking lead time: Confirm. Vegetarian/Jain: Not checked.', 'type=Restaurant (3 Michelin stars, French); who=Adults; lead=Confirm; veg/jain=Not checked'),
  ('restaurant', 'High-end sushi: Yoshitake, Sushi Sho Masa, Sukiyabashi Jiro Roppongi', 'Tokyo', 'Restaurant', 'Non-vegetarian adults', 'Reserve in the month before travel; Yoshitake books through TableAll', 'Not for vegetarians', 'jp-guide-high-end-sushi-yoshitake-sushi-sho-masa-sukiyabashi-jiro-roppongi', 'Tokyo Guide. Yoshitake and Jiro Roppongi show as open on public sites; Sushi Sho Masa not confirmed Suits: Non-vegetarian adults. Booking lead time: Reserve in the month before travel; Yoshitake books through TableAll. Vegetarian/Jain: Not for vegetarians.', 'type=Restaurant; who=Non-vegetarian adults; lead=Reserve in the month before travel; Yoshitake books through TableAll; veg/jain=Not for vegetarians'),
  ('restaurant', 'Mon Cher Ton Ton (teppanyaki, Peninsula Tokyo and Roppongi); Sushi Ginza Seamon', 'Tokyo', 'Restaurant', 'Non-vegetarian adults', 'Confirm', 'Non-veg', 'jp-guide-mon-cher-ton-ton-teppanyaki-peninsula-tokyo-and-roppongi-sushi-ginza-seamon', '2019 (both found open; Seamon bookings are provisional until approved) Suits: Non-vegetarian adults. Booking lead time: Confirm. Vegetarian/Jain: Non-veg.', 'type=Restaurant; who=Non-vegetarian adults; lead=Confirm; veg/jain=Non-veg'),
  ('restaurant', 'Afuri Ramen, Icheran Ramen Asakusa', 'Tokyo', 'Restaurant', 'All, casual', 'None (walk-in)', 'Afuri has vegan ramen', 'jp-guide-afuri-ramen-icheran-ramen-asakusa', '2019, Apr 2026 draft Suits: All, casual. Booking lead time: None (walk-in). Vegetarian/Jain: Afuri has vegan ramen.', 'type=Restaurant; who=All, casual; lead=None (walk-in); veg/jain=Afuri has vegan ramen'),
  ('restaurant', 'Indian: Nandhini, Bombay Sizzlers, Downtown B''s Indian Kitchen', 'Tokyo', 'Restaurant', 'Indian clients, vegetarians', 'Confirm', 'Vegetarian-friendly; Jain unchecked', 'jp-guide-indian-nandhini-bombay-sizzlers-downtown-b-s-indian-kitchen', 'Apr 2026 draft, to-do list Suits: Indian clients, vegetarians. Booking lead time: Confirm. Vegetarian/Jain: Vegetarian-friendly; Jain unchecked.', 'type=Restaurant; who=Indian clients, vegetarians; lead=Confirm; veg/jain=Vegetarian-friendly; Jain unchecked'),
  ('restaurant', 'Trattoria Mari e Monti', 'Tokyo', 'Restaurant (Italian)', 'Mixed groups', 'Confirm', 'Not checked', 'jp-guide-trattoria-mari-e-monti', 'to-do list Suits: Mixed groups. Booking lead time: Confirm. Vegetarian/Jain: Not checked.', 'type=Restaurant (Italian); who=Mixed groups; lead=Confirm; veg/jain=Not checked'),
  ('activity', 'Arashiyama bamboo grove, Tenryu-ji, Togetsukyo Bridge', 'Kyoto', 'Activity', 'All', 'None; go early to beat crowds', 'n/a', 'jp-guide-arashiyama-bamboo-grove-tenryu-ji-togetsukyo-bridge', 'A bamboo path, a Zen temple with a garden and a long wooden bridge over the Katsura River, all in western Kyoto. Suits: All. Booking lead time: None; go early to beat crowds. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=None; go early to beat crowds; veg/jain=n/a'),
  ('activity', 'Fushimi Inari', 'Kyoto', 'Activity', 'All', 'None; go in the morning, avoid midday crowds', 'n/a', 'jp-guide-fushimi-inari', 'A hillside shrine with thousands of vermilion torii gates along trails up Mt Inari. Suits: All. Booking lead time: None; go in the morning, avoid midday crowds. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=None; go in the morning, avoid midday crowds; veg/jain=n/a'),
  ('activity', 'Kinkaku-ji (Golden Pavilion)', 'Kyoto', 'Activity', 'All', 'Confirm if booking needed', 'n/a', 'jp-guide-kinkaku-ji-golden-pavilion', 'A Zen temple whose top two floors are covered in gold leaf, reflected in a pond. Suits: All. Booking lead time: Confirm if booking needed. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=Confirm if booking needed; veg/jain=n/a'),
  ('activity', 'Kiyomizu-dera', 'Kyoto', 'Activity', 'All', 'None', 'n/a', 'jp-guide-kiyomizu-dera', 'A hillside temple with a wooden terrace over the city, reached through the old streets of Higashiyama. Suits: All. Booking lead time: None. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=None; veg/jain=n/a'),
  ('activity', 'Nijo Castle', 'Kyoto', 'Activity', 'All', 'None', 'n/a', 'jp-guide-nijo-castle', 'The Tokugawa shogun''s Kyoto residence, with painted palace rooms, "nightingale" floors and gardens. Suits: All. Booking lead time: None. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=None; veg/jain=n/a'),
  ('activity', 'Sanjusangendo; Pontocho alley walk', 'Kyoto', 'Activity', 'All', 'None', 'n/a', 'jp-guide-sanjusangendo-pontocho-alley-walk', 'A long temple hall holding 1,001 gilded statues of the goddess Kannon, and a narrow lantern-lit lane of restaurants beside the Kamo River. Suits: All. Booking lead time: None. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=None; veg/jain=n/a'),
  ('activity', 'Gion and Shinbashi evening walk', 'Kyoto', 'Activity', 'All', 'None; no photographing or approaching geisha', 'n/a', 'jp-guide-gion-and-shinbashi-evening-walk', 'Evening walk through Kyoto''s geisha districts, with wooden teahouses and a canal in Shinbashi. Suits: All. Booking lead time: None; no photographing or approaching geisha. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=None; no photographing or approaching geisha; veg/jain=n/a'),
  ('activity', 'Tea ceremony with a geisha or maiko', 'Kyoto', 'Experience', 'All, first-timers', 'Confirm; subject to availability', 'n/a', 'jp-guide-tea-ceremony-with-a-geisha-or-maiko', 'A traditional tea ceremony hosted in a teahouse, with a geisha or maiko. Dress-up kimono rental can be added for photos. Suits: All, first-timers. Booking lead time: Confirm; subject to availability. Vegetarian/Jain: n/a.', 'type=Experience; who=All, first-timers; lead=Confirm; subject to availability; veg/jain=n/a'),
  ('activity', 'Sake brewery tour with tasting', 'Kyoto', 'Experience', 'Adults', 'Confirm', 'Sake tasting fine; meal needs checking', 'jp-guide-sake-brewery-tour-with-tasting', 'A visit behind the scenes of a Kyoto sake brewery with a tasting. Fushimi is Kyoto''s sake district. Suits: Adults. Booking lead time: Confirm. Vegetarian/Jain: Sake tasting fine; meal needs checking.', 'type=Experience; who=Adults; lead=Confirm; veg/jain=Sake tasting fine; meal needs checking'),
  ('activity', 'Samurai and ninja lessons', 'Kyoto', 'Experience', 'Families', 'Confirm', 'n/a', 'jp-guide-samurai-and-ninja-lessons', 'A hands-on session on samurai and ninja skills, such as sword handling or stealth, led by an instructor. Suits: Families. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Experience; who=Families; lead=Confirm; veg/jain=n/a'),
  ('activity', 'Whisky distillery visits; gin tasting', 'Kyoto', 'Experience', 'Adults', 'Confirm', 'n/a', 'jp-guide-whisky-distillery-visits-gin-tasting', 'Tasting visits to distilleries near Kyoto and a gin tasting in the city. Suits: Adults. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Experience; who=Adults; lead=Confirm; veg/jain=n/a'),
  ('activity', 'E-bike tour', 'Kyoto', 'Experience', 'Active guests', 'Confirm', 'n/a', 'jp-guide-e-bike-tour', 'A guided electric-bike ride through Kyoto''s backstreets and riverside paths, with stops at temples. Suits: Active guests. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Experience; who=Active guests; lead=Confirm; veg/jain=n/a'),
  ('activity', 'Kawai Kanjiro House (ceramics)', 'Kyoto', 'Activity', 'Design lovers', 'None', 'n/a', 'jp-guide-kawai-kanjiro-house-ceramics', 'The home and studio of the potter Kanjiro Kawai, kept as a small museum of ceramics and furniture. Suits: Design lovers. Booking lead time: None. Vegetarian/Jain: n/a.', 'type=Activity; who=Design lovers; lead=None; veg/jain=n/a'),
  ('activity', 'Nishiki Market', 'Kyoto', 'Activity', 'Adults', 'None', 'Not all vegetarian', 'jp-guide-nishiki-market', 'A covered market street of pickles, tofu, sweets and street food, known as Kyoto''s kitchen. Suits: Adults. Booking lead time: None. Vegetarian/Jain: Not all vegetarian.', 'type=Activity; who=Adults; lead=None; veg/jain=Not all vegetarian'),
  ('activity', 'Kamogawa noryo yuka (riverside dining)', 'Kyoto', 'Experience', 'Couples', 'Confirm', 'Not checked', 'jp-guide-kamogawa-noryo-yuka-riverside-dining', 'Dining on wooden platforms built over the Kamo River. Open only from 1 May to 15 October. There is no boat cruise on the Kamo River. Suits: Couples. Booking lead time: Confirm. Vegetarian/Jain: Not checked.', 'type=Experience; who=Couples; lead=Confirm; veg/jain=Not checked'),
  ('restaurant', 'Shigetsu (Tenryu-ji, Arashiyama)', 'Kyoto', 'Restaurant (shojin, temple grounds)', 'Vegetarians, all', 'Reserve at least 2 to 3 days ahead; closed Thursdays', 'Zen vegetarian (shojin); vegan not stated, confirm', 'jp-guide-shigetsu-tenryu-ji-arashiyama', 'Added by Keshav Suits: Vegetarians, all. Booking lead time: Reserve at least 2 to 3 days ahead; closed Thursdays. Vegetarian/Jain: Zen vegetarian (shojin); vegan not stated, confirm.', 'type=Restaurant (shojin, temple grounds); who=Vegetarians, all; lead=Reserve at least 2 to 3 days ahead; closed Thursdays; veg/jain=Zen vegetarian (shojin); vegan not stated, confirm'),
  ('restaurant', 'Kanga-An', 'Kyoto', 'Restaurant (temple setting)', 'Vegetarians, all', 'Reported to book weeks ahead', 'Buddhist vegetarian, no animal proteins or oils; vegan not stated', 'jp-guide-kanga-an', '2025 Suits: Vegetarians, all. Booking lead time: Reported to book weeks ahead. Vegetarian/Jain: Buddhist vegetarian, no animal proteins or oils; vegan not stated.', 'type=Restaurant (temple setting); who=Vegetarians, all; lead=Reported to book weeks ahead; veg/jain=Buddhist vegetarian, no animal proteins or oils; vegan not stated'),
  ('restaurant', 'Kerala (South Indian)', 'Kyoto', 'Restaurant', 'Indian clients, vegetarians', 'Confirm; closes irregularly, last public check Apr 2025', 'Public sources describe mostly north Indian food; the South Indian vegetarian note comes from the Apr 2026 draft', 'jp-guide-kerala-south-indian', 'Apr 2026 draft, to-do list Suits: Indian clients, vegetarians. Booking lead time: Confirm; closes irregularly, last public check Apr 2025. Vegetarian/Jain: Public sources describe mostly north Indian food; the South Indian vegetarian note comes from the Apr 2026 draft.', 'type=Restaurant; who=Indian clients, vegetarians; lead=Confirm; closes irregularly, last public check Apr 2025; veg/jain=Public sources describe mostly north Indian food; the South Indian vegetarian note comes from the Apr 2026 draft'),
  ('restaurant', 'Monk', 'Kyoto', 'Restaurant (vegetable omakase, wood-fired oven, 14 seats)', 'Adults, vegetarians', 'Reservations open 2 months ahead at 12:00 JST through TableCheck; closed Saturday, Sunday and Monday', 'Vegetarian possible; not vegan', 'jp-guide-monk', 'to-do list Suits: Adults, vegetarians. Booking lead time: Reservations open 2 months ahead at 12:00 JST through TableCheck; closed Saturday, Sunday and Monday. Vegetarian/Jain: Vegetarian possible; not vegan.', 'type=Restaurant (vegetable omakase, wood-fired oven, 14 seats); who=Adults, vegetarians; lead=Reservations open 2 months ahead at 12:00 JST through TableCheck; closed Saturday, Sunday and Monday; veg/jain=Vegetarian possible; not vegan'),
  ('restaurant', 'Osteria Il Canto del Maggio', 'Kyoto', 'Restaurant (Italian, Michelin Guide listed)', 'Mixed groups', 'Book by phone; closed Wednesday and Thursday', 'Florentine steak is the signature; confirm a vegetarian option', 'jp-guide-osteria-il-canto-del-maggio', 'to-do list Suits: Mixed groups. Booking lead time: Book by phone; closed Wednesday and Thursday. Vegetarian/Jain: Florentine steak is the signature; confirm a vegetarian option.', 'type=Restaurant (Italian, Michelin Guide listed); who=Mixed groups; lead=Book by phone; closed Wednesday and Thursday; veg/jain=Florentine steak is the signature; confirm a vegetarian option'),
  ('restaurant', 'Tempura Endo Yasaka (Higashiyama)', 'Kyoto', 'Restaurant (tempura)', 'Adults', 'Reservation required, prepaid online', 'Seafood-led; listing says vegetarian options exist, confirm', 'jp-guide-tempura-endo-yasaka-higashiyama', '2025 Suits: Adults. Booking lead time: Reservation required, prepaid online. Vegetarian/Jain: Seafood-led; listing says vegetarian options exist, confirm.', 'type=Restaurant (tempura); who=Adults; lead=Reservation required, prepaid online; veg/jain=Seafood-led; listing says vegetarian options exist, confirm'),
  ('restaurant', 'Gion lunch spots: Gyoza Chao Chao, Gion Tanto, Censi, Kakyo', 'Kyoto', 'Restaurant', 'All', 'Walk-in, no reservations (per the 2025 notes)', 'Not checked', 'jp-guide-gion-lunch-spots-gyoza-chao-chao-gion-tanto-censi-kakyo', '2025 (not checked) Suits: All. Booking lead time: Walk-in, no reservations (per the 2025 notes). Vegetarian/Jain: Not checked.', 'type=Restaurant; who=All; lead=Walk-in, no reservations (per the 2025 notes); veg/jain=Not checked'),
  ('restaurant', 'Engine Ramen; Ramen Touhichi (Michelin Bib Gourmand)', 'Kyoto', 'Restaurant', 'Casual', 'Walk-in', 'Not checked', 'jp-guide-engine-ramen-ramen-touhichi-michelin-bib-gourmand', '2025, to-do list Suits: Casual. Booking lead time: Walk-in. Vegetarian/Jain: Not checked.', 'type=Restaurant; who=Casual; lead=Walk-in; veg/jain=Not checked'),
  ('restaurant', 'Uzu Ramen', 'Kyoto', 'Restaurant (vegan ramen, Michelin Green Star and Bib Gourmand)', 'Casual, vegetarians', 'Book through TableCheck; children aged 6 and under not admitted', 'Fully vegan per its site', 'jp-guide-uzu-ramen', 'Added by Keshav Suits: Casual, vegetarians. Booking lead time: Book through TableCheck; children aged 6 and under not admitted. Vegetarian/Jain: Fully vegan per its site.', 'type=Restaurant (vegan ramen, Michelin Green Star and Bib Gourmand); who=Casual, vegetarians; lead=Book through TableCheck; children aged 6 and under not admitted; veg/jain=Fully vegan per its site'),
  ('activity', 'Dotonbori and street food', 'Osaka', 'Activity', 'All', 'None', 'Not all vegetarian', 'jp-guide-dotonbori-and-street-food', 'Osaka''s neon canal district, known for takoyaki, okonomiyaki and the Glico sign. Suits: All. Booking lead time: None. Vegetarian/Jain: Not all vegetarian.', 'type=Activity; who=All; lead=None; veg/jain=Not all vegetarian'),
  ('activity', 'Osaka Castle', 'Osaka', 'Activity', 'All', 'None', 'n/a', 'jp-guide-osaka-castle', 'A reconstructed castle keep with a museum inside and a large park and moat around it. Suits: All. Booking lead time: None. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=None; veg/jain=n/a'),
  ('activity', 'Nara day trip: Todai-ji, deer park, Kasuga Taisha', 'Nara', 'Activity', 'Families, all', 'Private car, none', 'n/a', 'jp-guide-nara-day-trip-todai-ji-deer-park-kasuga-taisha', 'Todai-ji houses a giant bronze Buddha, Nara Park has free-roaming deer, and Kasuga Taisha is a shrine with hundreds of stone lanterns. Suits: Families, all. Booking lead time: Private car, none. Vegetarian/Jain: n/a.', 'type=Activity; who=Families, all; lead=Private car, none; veg/jain=n/a'),
  ('activity', 'Universal Studios Japan', 'Osaka', 'Activity', 'Families', 'Confirm', 'n/a', 'jp-guide-universal-studios-japan', 'A large theme park in Osaka, including a Super Nintendo World area. Suits: Families. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Activity; who=Families; lead=Confirm; veg/jain=n/a'),
  ('activity', 'Hiroshima day trip (Peace Memorial)', 'Osaka', 'Experience', 'All', 'Confirm', 'n/a', 'jp-guide-hiroshima-day-trip-peace-memorial', 'A long day from Osaka by bullet train to the Peace Memorial Park and museum, often with Miyajima. Suits: All. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Experience; who=All; lead=Confirm; veg/jain=n/a'),
  ('activity', 'Sakuranomiya Park, Osaka Mint Bureau', 'Osaka', 'Activity', 'Seasonal (cherry blossom)', 'Seasonal', 'n/a', 'jp-guide-sakuranomiya-park-osaka-mint-bureau', 'Two cherry blossom spots in spring; the Mint Bureau''s tree-lined path is open for a short viewing week. Suits: Seasonal (cherry blossom). Booking lead time: Seasonal. Vegetarian/Jain: n/a.', 'type=Activity; who=Seasonal (cherry blossom); lead=Seasonal; veg/jain=n/a'),
  ('restaurant', 'Teppanyaki Mizuki (The Osaka Station Hotel, Autograph Collection)', 'Osaka', 'Restaurant', 'Adults', 'Confirm', 'Not stated; ask the restaurant', 'jp-guide-teppanyaki-mizuki-the-osaka-station-hotel-autograph-collection', 'French kappo-style teppanyaki on the 29th floor, 28 seats, dinner only. It is not at Four Seasons Osaka, whose restaurants are Jiang Nan Chun, Sushi Rabys, Bar Bota and Jardin. Suits: Adults. Booking lead time: Confirm. Vegetarian/Jain: Not stated; ask the restaurant.', 'type=Restaurant; who=Adults; lead=Confirm; veg/jain=Not stated; ask the restaurant'),
  ('restaurant', 'Ajinoya (okonomiyaki, Michelin Bib Gourmand)', 'Osaka', 'Restaurant', 'All, casual groups', 'Confirm', 'Toppings vary; ask', 'jp-guide-ajinoya-okonomiyaki-michelin-bib-gourmand', 'A long-established Namba okonomiyaki restaurant where staff cook on a hotplate. Bookings are by phone only on weekdays and need a Japanese speaker; closed Mondays. Suits: All, casual groups. Booking lead time: Confirm. Vegetarian/Jain: Toppings vary; ask.', 'type=Restaurant; who=All, casual groups; lead=Confirm; veg/jain=Toppings vary; ask'),
  ('restaurant', 'Pizzeria Icaro, Nara', 'Nara', 'Restaurant (lunch)', 'Mixed groups', 'Confirm', 'Pizza', 'jp-guide-pizzeria-icaro-nara', 'A wood-fired pizzeria in Nara listed by the Michelin Guide, with a vegetable-heavy pizza and a gluten-free crust option. Suits: Mixed groups. Booking lead time: Confirm. Vegetarian/Jain: Pizza.', 'type=Restaurant (lunch); who=Mixed groups; lead=Confirm; veg/jain=Pizza'),
  ('restaurant', 'Splendido (Ritz-Carlton Osaka)', 'Osaka', 'Restaurant (Italian)', 'Groups', 'Confirm', 'Not checked', 'jp-guide-splendido-ritz-carlton-osaka', 'All-day Italian restaurant on the ground floor of the Ritz-Carlton Osaka; bookings through TableCheck. Suits: Groups. Booking lead time: Confirm. Vegetarian/Jain: Not checked.', 'type=Restaurant (Italian); who=Groups; lead=Confirm; veg/jain=Not checked'),
  ('activity', 'Hakone Open Air Museum', 'Hakone', 'Activity', 'All, art lovers', 'None', 'n/a', 'jp-guide-hakone-open-air-museum', 'A sculpture park in the mountains with a Picasso pavilion. Suits: All, art lovers. Booking lead time: None. Vegetarian/Jain: n/a.', 'type=Activity; who=All, art lovers; lead=None; veg/jain=n/a'),
  ('activity', 'Owakudani ropeway', 'Hakone', 'Activity', 'All', 'None; weather-dependent', 'n/a', 'jp-guide-owakudani-ropeway', 'A ropeway over a volcanic valley with sulphur vents. It can close in bad weather or gas alerts, and sections close for winter maintenance (Dec 2025 to Feb 2026 had replacement buses), so check before booking. Suits: All. Booking lead time: None; weather-dependent. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=None; weather-dependent; veg/jain=n/a'),
  ('restaurant', 'Lake Ashi lunch (Prince Hotel)', 'Hakone', 'Restaurant', 'Groups', 'Confirm', 'Not checked', 'jp-guide-lake-ashi-lunch-prince-hotel', 'A lakeside French lunch at a hotel on Lake Ashi. Suits: Groups. Booking lead time: Confirm. Vegetarian/Jain: Not checked.', 'type=Restaurant; who=Groups; lead=Confirm; veg/jain=Not checked'),
  ('activity', 'Hotel onsen; stay in a ryokan', 'Hakone', 'Experience', 'Couples, all', 'Confirm', 'Dietary needs go to the ryokan', 'jp-guide-hotel-onsen-stay-in-a-ryokan', 'Soaking in a hot-spring bath, often with a multi-course dinner at a traditional inn. Suits: Couples, all. Booking lead time: Confirm. Vegetarian/Jain: Dietary needs go to the ryokan.', 'type=Experience; who=Couples, all; lead=Confirm; veg/jain=Dietary needs go to the ryokan'),
  ('activity', 'Enoura Observatory', 'Hakone', 'Experience', 'Design lovers', 'Confirm', 'n/a', 'jp-guide-enoura-observatory', 'A hillside art complex by the artist Hiroshi Sugimoto on the Sagami Bay coast, with a long tunnel and sea views. Advance reservation required, at least 2 days before; closed Tuesdays and Wednesdays. Suits: Design lovers. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Experience; who=Design lovers; lead=Confirm; veg/jain=n/a'),
  ('activity', 'Mt Fuji 5th Station', 'Hakone', 'Activity', 'All', 'None; weather-dependent', 'n/a', 'jp-guide-mt-fuji-5th-station', 'The road-accessible starting point of the climbing trails at about 2,300 m. Sightseeing outside the gate is free; the 2026 Yoshida Trail climbing season was 1 July to 10 September, with a ¥4,000 fee. Suits: All. Booking lead time: None; weather-dependent. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=None; weather-dependent; veg/jain=n/a'),
  ('activity', 'Mt Fuji Panoramic (Kachi Kachi) ropeway', 'Hakone', 'Activity', 'All', 'None; ticket queue possible', 'n/a', 'jp-guide-mt-fuji-panoramic-kachi-kachi-ropeway', 'A short ropeway above Lake Kawaguchiko to a viewpoint facing Mt Fuji. Suits: All. Booking lead time: None; ticket queue possible. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=None; ticket queue possible; veg/jain=n/a'),
  ('activity', 'Lake Kawaguchiko and Oishi Park; Oshino Hakkai', 'Hakone', 'Activity', 'All', 'None', 'n/a', 'jp-guide-lake-kawaguchiko-and-oishi-park-oshino-hakkai', 'A lake with views of Mt Fuji, a lakeside park with flower fields, and a village of spring-fed ponds. Suits: All. Booking lead time: None. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=None; veg/jain=n/a'),
  ('restaurant', 'Hoshinoya Fuji dining', 'Hakone', 'Restaurant', 'Hotel guests', 'Hotel set menu', 'Vegetarians order a la carte', 'jp-guide-hoshinoya-fuji-dining', 'Dinner at the glamping resort''s restaurant, using local ingredients. Suits: Hotel guests. Booking lead time: Hotel set menu. Vegetarian/Jain: Vegetarians order a la carte.', 'type=Restaurant; who=Hotel guests; lead=Hotel set menu; veg/jain=Vegetarians order a la carte'),
  ('restaurant', 'Kaiseki at Gora Kadan, requested through Hoshinoya', 'Hakone', 'Restaurant', 'Adults', 'Ask the hotel to call and request', 'Confirm', 'jp-guide-kaiseki-at-gora-kadan-requested-through-hoshinoya', 'A kaiseki dinner at the Fuji Gora Kadan ryokan, arranged by the hotel concierge. Suits: Adults. Booking lead time: Ask the hotel to call and request. Vegetarian/Jain: Confirm.', 'type=Restaurant; who=Adults; lead=Ask the hotel to call and request; veg/jain=Confirm'),
  ('activity', 'Gotemba Premium Outlets', 'Hakone', 'Activity', 'Shoppers', 'None', 'n/a', 'jp-guide-gotemba-premium-outlets', 'A large outlet mall with Mt Fuji views, on the way between Hakone and Tokyo. Suits: Shoppers. Booking lead time: None. Vegetarian/Jain: n/a.', 'type=Activity; who=Shoppers; lead=None; veg/jain=n/a'),
  ('activity', 'Fuji Five Lakes day trip from Tokyo', 'Hakone', 'Activity', 'All', 'None', 'n/a', 'jp-guide-fuji-five-lakes-day-trip-from-tokyo', 'A day trip by road to the lakes at the foot of Mt Fuji. Suits: All. Booking lead time: None. Vegetarian/Jain: n/a.', 'type=Activity; who=All; lead=None; veg/jain=n/a'),
  ('activity', 'Daily ski lessons', 'Niseko', 'Activity', 'Beginners, families', 'Confirm; book with the hotel', 'n/a', 'jp-guide-daily-ski-lessons', 'Morning lessons with an instructor, leaving the afternoons free. Suits: Beginners, families. Booking lead time: Confirm; book with the hotel. Vegetarian/Jain: n/a.', 'type=Activity; who=Beginners, families; lead=Confirm; book with the hotel; veg/jain=n/a'),
  ('activity', 'Skiing Mt Niseko Annupuri', 'Niseko', 'Activity', 'Skiers', 'Confirm', 'n/a', 'jp-guide-skiing-mt-niseko-annupuri', 'Skiing on Niseko''s main mountain, known for light powder snow. Suits: Skiers. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Activity; who=Skiers; lead=Confirm; veg/jain=n/a'),
  ('activity', 'Private hot springs and spa treatments', 'Niseko', 'Experience', 'Couples, all', 'Confirm', 'n/a', 'jp-guide-private-hot-springs-and-spa-treatments', 'Soaking in a private onsen or booking a spa treatment after a day on the snow. Suits: Couples, all. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Experience; who=Couples, all; lead=Confirm; veg/jain=n/a'),
  ('activity', 'Nikko Toshogu shrine (UNESCO)', 'Nikko', 'Activity', 'All, families', 'None', 'n/a', 'jp-guide-nikko-toshogu-shrine-unesco', 'An elaborately decorated shrine to the first Tokugawa shogun, famous for the carving of the three wise monkeys. Suits: All, families. Booking lead time: None. Vegetarian/Jain: n/a.', 'type=Activity; who=All, families; lead=None; veg/jain=n/a'),
  ('activity', 'Nikko kayaking, cycling, waterfall walks', 'Nikko', 'Activity', 'Families, active guests', 'Confirm', 'n/a', 'jp-guide-nikko-kayaking-cycling-waterfall-walks', 'Outdoor activities in Nikko National Park, around Lake Chuzenji and its waterfalls. Suits: Families, active guests. Booking lead time: Confirm. Vegetarian/Jain: n/a.', 'type=Activity; who=Families, active guests; lead=Confirm; veg/jain=n/a')

) AS v(entity_type, name, city, guide_type, who_it_suits, lead_time, veg_jain, external_key, description, legacy_notes)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_cities ci ON ci.country_id = co.id AND lower(ci.name) = lower(v.city)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_entities e
  WHERE e.active = true
    AND e.entity_type = v.entity_type
    AND (
      e.external_key = v.external_key
      OR (e.city_id = ci.id AND lower(e.name) = lower(v.name))
    )
);


INSERT INTO public.kb_restaurant_details (entity_id, cuisine, price_tier, awards)
SELECT e.id, NULL, NULL, '[]'::jsonb
FROM public.kb_entities e
WHERE e.entity_type = 'restaurant'
  AND e.active = true
  AND e.external_key LIKE 'jp-guide-%'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_restaurant_details d WHERE d.entity_id = e.id
  );

INSERT INTO public.kb_activity_details (entity_id, category, duration_text, price_tier)
SELECT
  e.id,
  coalesce(e.external_ids->>'guide_type', 'activity'),
  e.external_ids->>'lead_time',
  NULL
FROM public.kb_entities e
WHERE e.entity_type = 'activity'
  AND e.active = true
  AND e.external_key LIKE 'jp-guide-%'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_activity_details d WHERE d.entity_id = e.id
  );


-- =============================================================================
-- 9. Attach one flagship hotel onto the first day note per city
-- =============================================================================

WITH preferred AS (
  SELECT * FROM (VALUES
    ('Tokyo', 1, ARRAY[
      'Palace Hotel Tokyo',
      'Mandarin Oriental Tokyo',
      'Four Seasons Tokyo at Otemachi',
      'Four Seasons — Tokyo at Otemachi'
    ]::text[]),
    ('Kyoto', 1, ARRAY[
      'Park Hyatt Kyoto',
      'The Ritz-Carlton Kyoto',
      'Four Seasons Kyoto',
      'Four Seasons — Kyoto'
    ]::text[]),
    ('Osaka', 1, ARRAY[
      'Waldorf Astoria Osaka',
      'Four Seasons Osaka',
      'Four Seasons — Osaka',
      'The St. Regis Osaka'
    ]::text[]),
    ('Hakone', 1, ARRAY[
      'ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu',
      'Gora Kadan'
    ]::text[]),
    ('Niseko', 1, ARRAY[
      'Park Hyatt Niseko Hanazono',
      'Higashiyama Niseko Village, a Ritz-Carlton Reserve'
    ]::text[])
  ) AS t(city, pick_rank, hotel_names)
),
first_days AS (
  SELECT DISTINCT ON (i.id, p.city)
    ii.id AS item_id,
    p.city,
    p.hotel_names
  FROM public.kb_itineraries i
  JOIN public.kb_countries c ON c.id = i.country_id AND c.country_code = 'JP'
  JOIN public.kb_itinerary_items ii ON ii.itinerary_id = i.id
  JOIN preferred p ON ii.note ILIKE p.city || '%'
  WHERE ii.entity_id IS NULL
  ORDER BY i.id, p.city, ii.day_number, ii.sort_order
),
picked_hotel AS (
  SELECT DISTINCT ON (fd.item_id)
    fd.item_id,
    e.id AS entity_id
  FROM first_days fd
  JOIN public.kb_countries co ON co.country_code = 'JP'
  JOIN public.kb_cities ci ON ci.country_id = co.id AND lower(ci.name) = lower(fd.city)
  JOIN public.kb_entities e
    ON e.entity_type = 'hotel'
   AND e.active = true
   AND e.country_id = co.id
   AND e.city_id = ci.id
   AND e.name = ANY (fd.hotel_names)
  ORDER BY fd.item_id, array_position(fd.hotel_names, e.name) NULLS LAST
)
UPDATE public.kb_itinerary_items ii
SET entity_id = ph.entity_id, updated_at = now()
FROM picked_hotel ph
WHERE ii.id = ph.item_id
  AND ii.entity_id IS NULL;
