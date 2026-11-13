-- Priority Japan hotels → Rate Layer properties + Atlas property_id link.
-- NOT a migration — supabase db push ignores this folder.
--
-- Purpose (gap #1): Trip Builder can treat these as Contracted for hotel_find
-- coverage/suggest. Contracted rate seasons are still ops/import — until then
-- rates_search may return no_rates and the advisor uses paste quote.
--
-- Depends on:
--   migrations/011_rate_layer.sql (+ external_key / preferred_partner columns)
--   seeds/016_atlas_kb.sql and/or 018_japan_destination_guide.sql (KB hotels)
-- Safe to re-run: WHERE NOT EXISTS / natural-key guards.

-- =============================================================================
-- 0. Destination profiles (city spines for Japan)
-- =============================================================================

INSERT INTO public.destination_profiles (canonical_name, aliases, destination_type, notes)
SELECT v.canonical_name, v.aliases::jsonb, v.destination_type, v.notes
FROM (
  VALUES
    ('Tokyo', '["TYO","tokyo"]', 'city_countryside', 'Japan priority Rate Layer seed'),
    ('Kyoto', '["kyoto"]', 'city_countryside', 'Japan priority Rate Layer seed'),
    ('Osaka', '["KIX","ITM","osaka"]', 'city_countryside', 'Japan priority Rate Layer seed'),
    ('Hakone', '["hakone"]', 'city_countryside', 'Japan priority Rate Layer seed'),
    ('Japan', '["JP","japan"]', 'city_countryside', 'Japan country profile for routing')
) AS v(canonical_name, aliases, destination_type, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.destination_profiles p
  WHERE lower(p.canonical_name) = lower(v.canonical_name)
);

-- =============================================================================
-- 1. Priority properties (Rate Layer)
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
  'Japan priority seed — link Atlas preferred; contracted seasons still ops/import.',
  true
FROM (
  VALUES
    -- Tokyo
    ('Palace Hotel Tokyo', '', '', 'Tokyo', 'palace-hotel-tokyo', 'Palace Hotel Tokyo'),
    ('Capitol Hotel Tokyu', '', '', 'Tokyo', 'capitol-hotel-tokyu', 'Capitol Hotel Tokyu'),
    ('Mandarin Oriental Tokyo', 'Mandarin Oriental', 'Mandarin Oriental', 'Tokyo', 'mandarin-oriental-tokyo', 'Mandarin Oriental, Tokyo|Mandarin Oriental Tokyo'),
    ('Four Seasons Tokyo at Otemachi', 'Four Seasons', 'Four Seasons', 'Tokyo', 'four-seasons-tokyo-otemachi', 'Four Seasons — Tokyo at Otemachi|Four Seasons Tokyo Otemachi|Four Seasons Tokyo at Otemachi'),
    -- Kyoto
    ('Four Seasons Kyoto', 'Four Seasons', 'Four Seasons', 'Kyoto', 'four-seasons-kyoto', 'Four Seasons — Kyoto|Four Seasons Kyoto'),
    ('Park Hyatt Kyoto', 'Park Hyatt', 'Hyatt', 'Kyoto', 'park-hyatt-kyoto', 'Park Hyatt Kyoto'),
    ('The Ritz-Carlton Kyoto', 'Ritz-Carlton', 'Marriott', 'Kyoto', 'ritz-carlton-kyoto', 'The Ritz-Carlton, Kyoto|Ritz-Carlton Kyoto|The Ritz-Carlton Kyoto'),
    -- Osaka
    ('Waldorf Astoria Osaka', 'Waldorf Astoria', 'Hilton', 'Osaka', 'waldorf-astoria-osaka', 'Waldorf Astoria Osaka'),
    ('Four Seasons Osaka', 'Four Seasons', 'Four Seasons', 'Osaka', 'four-seasons-osaka', 'Four Seasons — Osaka|Four Seasons Osaka'),
    ('The St. Regis Osaka', 'St. Regis', 'Marriott', 'Osaka', 'st-regis-osaka', 'The St. Regis Osaka|St. Regis Osaka'),
    -- Hakone
    ('ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu', '', '', 'Hakone', 'espacio-hakone-geihinkan', 'ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu')
) AS v(name, brand, chain, city, external_key, aliases)
JOIN public.destination_profiles dp ON lower(dp.canonical_name) = lower(v.city)
WHERE NOT EXISTS (
  SELECT 1 FROM public.properties x
  WHERE lower(x.external_key) = lower(v.external_key)
     OR lower(x.name) = lower(v.name)
);

-- =============================================================================
-- 2. Link Atlas KB hotels → properties (canonical money link)
-- =============================================================================

-- Link by Atlas / guide external_key
UPDATE public.kb_entities e
SET
  property_id = p.id,
  contract_status = 'contracted',
  updated_at = now()
FROM public.properties p
JOIN (
  VALUES
    ('palace-hotel-tokyo', 'palace-hotel-tokyo'),
    ('jp-guide-palace-hotel-tokyo', 'palace-hotel-tokyo'),
    ('capitol-hotel-tokyu', 'capitol-hotel-tokyu'),
    ('jp-guide-capitol-hotel-tokyu', 'capitol-hotel-tokyu'),
    ('mandarin-oriental-tokyo', 'mandarin-oriental-tokyo'),
    ('jp-guide-mandarin-oriental-tokyo', 'mandarin-oriental-tokyo'),
    ('four-seasons-tokyo-at-otemachi', 'four-seasons-tokyo-otemachi'),
    ('jp-guide-four-seasons-tokyo-at-otemachi', 'four-seasons-tokyo-otemachi'),
    ('four-seasons-kyoto', 'four-seasons-kyoto'),
    ('jp-guide-four-seasons-kyoto', 'four-seasons-kyoto'),
    ('park-hyatt-kyoto', 'park-hyatt-kyoto'),
    ('jp-guide-park-hyatt-kyoto', 'park-hyatt-kyoto'),
    ('the-ritz-carlton-kyoto', 'ritz-carlton-kyoto'),
    ('jp-guide-the-ritz-carlton-kyoto', 'ritz-carlton-kyoto'),
    ('waldorf-astoria-osaka', 'waldorf-astoria-osaka'),
    ('jp-guide-waldorf-astoria-osaka', 'waldorf-astoria-osaka'),
    ('four-seasons-osaka', 'four-seasons-osaka'),
    ('jp-guide-four-seasons-osaka', 'four-seasons-osaka'),
    ('the-st-regis-osaka', 'st-regis-osaka'),
    ('jp-guide-the-st-regis-osaka', 'st-regis-osaka'),
    ('espacio-the-hakone-geihinkan-rin-poh-ki-ryu', 'espacio-hakone-geihinkan'),
    ('jp-guide-espacio-the-hakone-geihinkan-rin-poh-ki-ryu', 'espacio-hakone-geihinkan')
) AS m(kb_key, prop_key) ON lower(p.external_key) = lower(m.prop_key)
WHERE e.entity_type = 'hotel'
  AND e.active = true
  AND lower(COALESCE(e.external_key, '')) = lower(m.kb_key)
  AND (e.property_id IS DISTINCT FROM p.id OR e.contract_status IS DISTINCT FROM 'contracted');

-- Fallback: exact display name match for priority Japan properties still unlinked
UPDATE public.kb_entities e
SET
  property_id = p.id,
  contract_status = 'contracted',
  updated_at = now()
FROM public.properties p
WHERE e.entity_type = 'hotel'
  AND e.active = true
  AND e.property_id IS NULL
  AND p.active = true
  AND p.country ILIKE 'Japan'
  AND (
    lower(e.name) = lower(p.name)
    OR lower(e.name) = ANY (
      SELECT lower(a) FROM unnest(COALESCE(p.aliases, '{}'::text[])) AS a
    )
  );
