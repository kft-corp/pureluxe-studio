-- Optional seed: city geo + kb_airports for Sabre open-GDS discover.
-- NOT a migration — run by hand in SQL Editor / psql after migration 039.
--
-- Depends on:
--   migrations/039_kb_city_geo_airports.sql
--   seeds/016_atlas_kb.sql (countries + cities)
--   seeds/017 / 018 (Maldives / India / Japan cities when present)
--
-- Safe to re-run: airports upsert by IATA; city geo / preferred_airport only
-- fill when null or always refresh preferred from mapping below.
--
-- Scope: destinations we sell / test first (Japan guide, Maldives, India
-- smoke, plus a few Rate Layer hubs). Expand as needed — do not invent
-- Sabre hotel codes here.

-- =============================================================================
-- 1. City-center lat/long + default Sabre radius (geo path)
-- =============================================================================

UPDATE public.kb_cities c
SET
  latitude = v.lat,
  longitude = v.lng,
  default_search_radius = COALESCE(c.default_search_radius, v.radius),
  default_search_uom = COALESCE(c.default_search_uom, v.uom),
  updated_at = now()
FROM (
  VALUES
    -- Japan (guide + smoke)
    ('JP', 'Tokyo',           35.6812,  139.7671, 25.0, 'MI'),
    ('JP', 'Kyoto',           35.0116,  135.7681, 20.0, 'MI'),
    ('JP', 'Osaka',           34.6937,  135.5023, 20.0, 'MI'),
    ('JP', 'Nara',            34.6851,  135.8048, 15.0, 'MI'),
    ('JP', 'Hakone',          35.2324,  139.1069, 15.0, 'MI'),
    ('JP', 'Nikko',           36.7198,  139.6982, 15.0, 'MI'),
    ('JP', 'Hiroshima',       34.3853,  132.4553, 20.0, 'MI'),
    ('JP', 'Miyajima',        34.2960,  132.3198, 10.0, 'MI'),
    ('JP', 'Kanazawa',        36.5613,  136.6562, 15.0, 'MI'),
    ('JP', 'Takayama',        36.1461,  137.2522, 15.0, 'MI'),
    ('JP', 'Sapporo',         43.0618,  141.3545, 25.0, 'MI'),
    ('JP', 'Niseko',          42.8048,  140.6874, 20.0, 'MI'),
    ('JP', 'Furano',          43.3420,  142.3832, 20.0, 'MI'),
    ('JP', 'Nagoya',          35.1815,  136.9066, 20.0, 'MI'),
    ('JP', 'Okayama',         34.6551,  133.9195, 15.0, 'MI'),
    ('JP', 'Okinawa',         26.2124,  127.6792, 25.0, 'MI'),
    ('JP', 'Miyako Island',   24.8055,  125.2811, 20.0, 'MI'),
    ('JP', 'Yokohama',        35.4437,  139.6380, 15.0, 'MI'),
    -- Maldives (gateway + atolls → same geo hub near Malé for discover)
    ('MV', 'Malé',                          4.1755,  73.5093, 50.0, 'MI'),
    ('MV', 'North Malé Atoll',               4.4167,  73.5000, 50.0, 'MI'),
    ('MV', 'South Malé Atoll',               3.8500,  73.4500, 50.0, 'MI'),
    ('MV', 'South Male Atoll',               3.8500,  73.4500, 50.0, 'MI'),
    ('MV', 'South Malé Atoll, Ithaafushi',   3.8833,  73.4500, 40.0, 'MI'),
    ('MV', 'Raa Atoll',                      5.6500,  72.9000, 60.0, 'MI'),
    ('MV', 'Bodufushi Island, Raa Atoll',    5.6500,  72.9000, 40.0, 'MI'),
    ('MV', 'Maalefushi',                     3.2000,  73.0000, 50.0, 'MI'),
    ('MV', 'Baa Atoll',                      5.1000,  73.0000, 60.0, 'MI'),
    -- India (smoke)
    ('IN', 'Jawai',         25.1000,  73.1500, 40.0, 'MI'),
    ('IN', 'Jaisalmer',     26.9157,  70.9083, 30.0, 'MI'),
    ('IN', 'Ranthambhore',  26.0173,  76.5026, 30.0, 'MI'),
    -- Hubs often used in Rate Layer / open shop tests
    ('FR', 'Paris',         48.8566,    2.3522, 15.0, 'MI'),
    ('AE', 'Dubai',         25.2048,   55.2708, 25.0, 'MI'),
    ('ID', 'Bali',          -8.4095,  115.1889, 30.0, 'MI'),
    ('SG', 'Singapore',      1.3521,  103.8198, 15.0, 'MI')
) AS v(country_code, city_name, lat, lng, radius, uom)
JOIN public.kb_countries co ON co.country_code = v.country_code
WHERE c.country_id = co.id
  AND lower(trim(c.name)) = lower(trim(v.city_name));

-- =============================================================================
-- 2. kb_airports (IATA) — primary city_id = main metro the code serves
-- =============================================================================

INSERT INTO public.kb_airports (
  iata_code, name, city_id, country_id, latitude, longitude, active
)
SELECT
  v.iata,
  v.airport_name,
  ci.id,
  co.id,
  v.lat,
  v.lng,
  true
FROM (
  VALUES
    -- Japan
    ('HND', 'Tokyo Haneda Airport',              'JP', 'Tokyo',         35.5494,  139.7798),
    ('NRT', 'Narita International Airport',      'JP', 'Tokyo',         35.7720,  140.3929),
    ('KIX', 'Kansai International Airport',      'JP', 'Osaka',         34.4347,  135.2440),
    ('ITM', 'Osaka Itami Airport',               'JP', 'Osaka',         34.7855,  135.4382),
    ('CTS', 'New Chitose Airport',               'JP', 'Sapporo',       42.7752,  141.6923),
    ('HIJ', 'Hiroshima Airport',                 'JP', 'Hiroshima',     34.4361,  132.9194),
    ('OKA', 'Naha Airport',                      'JP', 'Okinawa',       26.1958,  127.6458),
    ('MMY', 'Miyako Airport',                    'JP', 'Miyako Island', 24.7828,  125.2951),
    ('KMQ', 'Komatsu Airport',                   'JP', 'Kanazawa',      36.3946,  136.4064),
    ('OKJ', 'Okayama Airport',                   'JP', 'Okayama',       34.7569,  133.8552),
    ('NGO', 'Chubu Centrair International',      'JP', 'Nagoya',        34.8584,  136.8054),
    -- Maldives
    ('MLE', 'Velana International Airport',      'MV', 'Malé',           4.1918,   73.5291),
    -- India
    ('UDR', 'Maharana Pratap Airport Udaipur',   'IN', 'Jawai',         24.6177,   73.8961),
    ('JSA', 'Jaisalmer Airport',                 'IN', 'Jaisalmer',     26.8887,   70.8649),
    ('JAI', 'Jaipur International Airport',      'IN', 'Ranthambhore',  26.8242,   75.8122),
    -- Hubs
    ('CDG', 'Paris Charles de Gaulle Airport',   'FR', 'Paris',         49.0097,    2.5479),
    ('ORY', 'Paris Orly Airport',                'FR', 'Paris',         48.7233,    2.3794),
    ('DXB', 'Dubai International Airport',       'AE', 'Dubai',         25.2532,   55.3657),
    ('DPS', 'Ngurah Rai International Airport',  'ID', 'Bali',          -8.7482,  115.1672),
    ('SIN', 'Singapore Changi Airport',          'SG', 'Singapore',      1.3644,  103.9915)
) AS v(iata, airport_name, country_code, city_name, lat, lng)
JOIN public.kb_countries co ON co.country_code = v.country_code
LEFT JOIN public.kb_cities ci
  ON ci.country_id = co.id
 AND lower(trim(ci.name)) = lower(trim(v.city_name))
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_airports a WHERE a.iata_code = v.iata
);

-- Refresh name / geo / city link if airport already existed
UPDATE public.kb_airports a
SET
  name = v.airport_name,
  city_id = COALESCE(ci.id, a.city_id),
  country_id = co.id,
  latitude = v.lat,
  longitude = v.lng,
  active = true,
  updated_at = now()
FROM (
  VALUES
    ('HND', 'Tokyo Haneda Airport',              'JP', 'Tokyo',         35.5494,  139.7798),
    ('NRT', 'Narita International Airport',      'JP', 'Tokyo',         35.7720,  140.3929),
    ('KIX', 'Kansai International Airport',      'JP', 'Osaka',         34.4347,  135.2440),
    ('ITM', 'Osaka Itami Airport',               'JP', 'Osaka',         34.7855,  135.4382),
    ('CTS', 'New Chitose Airport',               'JP', 'Sapporo',       42.7752,  141.6923),
    ('HIJ', 'Hiroshima Airport',                 'JP', 'Hiroshima',     34.4361,  132.9194),
    ('OKA', 'Naha Airport',                      'JP', 'Okinawa',       26.1958,  127.6458),
    ('MMY', 'Miyako Airport',                    'JP', 'Miyako Island', 24.7828,  125.2951),
    ('KMQ', 'Komatsu Airport',                   'JP', 'Kanazawa',      36.3946,  136.4064),
    ('OKJ', 'Okayama Airport',                   'JP', 'Okayama',       34.7569,  133.8552),
    ('NGO', 'Chubu Centrair International',      'JP', 'Nagoya',        34.8584,  136.8054),
    ('MLE', 'Velana International Airport',      'MV', 'Malé',           4.1918,   73.5291),
    ('UDR', 'Maharana Pratap Airport Udaipur',   'IN', 'Jawai',         24.6177,   73.8961),
    ('JSA', 'Jaisalmer Airport',                 'IN', 'Jaisalmer',     26.8887,   70.8649),
    ('JAI', 'Jaipur International Airport',      'IN', 'Ranthambhore',  26.8242,   75.8122),
    ('CDG', 'Paris Charles de Gaulle Airport',   'FR', 'Paris',         49.0097,    2.5479),
    ('ORY', 'Paris Orly Airport',                'FR', 'Paris',         48.7233,    2.3794),
    ('DXB', 'Dubai International Airport',       'AE', 'Dubai',         25.2532,   55.3657),
    ('DPS', 'Ngurah Rai International Airport',  'ID', 'Bali',          -8.7482,  115.1672),
    ('SIN', 'Singapore Changi Airport',          'SG', 'Singapore',      1.3644,  103.9915)
) AS v(iata, airport_name, country_code, city_name, lat, lng)
JOIN public.kb_countries co ON co.country_code = v.country_code
LEFT JOIN public.kb_cities ci
  ON ci.country_id = co.id
 AND lower(trim(ci.name)) = lower(trim(v.city_name))
WHERE a.iata_code = v.iata;

-- =============================================================================
-- 3. preferred_airport_id on cities (Sabre airport RefPoint path)
--    Tokyo → HND (guide: Haneda preferred over Narita)
--    Kyoto / Osaka / Nara → KIX
--    Maldives atolls → MLE
-- =============================================================================

UPDATE public.kb_cities c
SET
  preferred_airport_id = a.id,
  updated_at = now()
FROM public.kb_countries co
JOIN (
  VALUES
    ('JP', 'Tokyo',                         'HND'),
    ('JP', 'Yokohama',                      'HND'),
    ('JP', 'Hakone',                        'HND'),
    ('JP', 'Nikko',                         'HND'),
    ('JP', 'Kyoto',                         'KIX'),
    ('JP', 'Osaka',                         'KIX'),
    ('JP', 'Nara',                          'KIX'),
    ('JP', 'Sapporo',                       'CTS'),
    ('JP', 'Niseko',                        'CTS'),
    ('JP', 'Furano',                        'CTS'),
    ('JP', 'Hiroshima',                     'HIJ'),
    ('JP', 'Miyajima',                      'HIJ'),
    ('JP', 'Kanazawa',                      'KMQ'),
    ('JP', 'Okayama',                       'OKJ'),
    ('JP', 'Nagoya',                        'NGO'),
    ('JP', 'Okinawa',                       'OKA'),
    ('JP', 'Miyako Island',                 'MMY'),
    ('MV', 'Malé',                          'MLE'),
    ('MV', 'North Malé Atoll',              'MLE'),
    ('MV', 'South Malé Atoll',              'MLE'),
    ('MV', 'South Male Atoll',              'MLE'),
    ('MV', 'South Malé Atoll, Ithaafushi',  'MLE'),
    ('MV', 'Raa Atoll',                     'MLE'),
    ('MV', 'Bodufushi Island, Raa Atoll',   'MLE'),
    ('MV', 'Maalefushi',                    'MLE'),
    ('MV', 'Baa Atoll',                     'MLE'),
    ('IN', 'Jawai',                         'UDR'),
    ('IN', 'Jaisalmer',                     'JSA'),
    ('IN', 'Ranthambhore',                  'JAI'),
    ('FR', 'Paris',                         'CDG'),
    ('AE', 'Dubai',                         'DXB'),
    ('ID', 'Bali',                          'DPS'),
    ('SG', 'Singapore',                     'SIN')
) AS m(country_code, city_name, iata)
  ON co.country_code = m.country_code
JOIN public.kb_airports a ON a.iata_code = m.iata AND a.active = true
WHERE c.country_id = co.id
  AND lower(trim(c.name)) = lower(trim(m.city_name));

-- =============================================================================
-- 4. Quick verify (optional — comment out in automation)
-- =============================================================================
-- SELECT a.iata_code, a.name, ci.name AS city, co.country_code
-- FROM public.kb_airports a
-- LEFT JOIN public.kb_cities ci ON ci.id = a.city_id
-- LEFT JOIN public.kb_countries co ON co.id = a.country_id
-- ORDER BY a.iata_code;
--
-- SELECT co.country_code, c.name, c.latitude, c.longitude,
--        a.iata_code AS preferred_iata
-- FROM public.kb_cities c
-- JOIN public.kb_countries co ON co.id = c.country_id
-- LEFT JOIN public.kb_airports a ON a.id = c.preferred_airport_id
-- WHERE c.preferred_airport_id IS NOT NULL
-- ORDER BY co.country_code, c.name;
