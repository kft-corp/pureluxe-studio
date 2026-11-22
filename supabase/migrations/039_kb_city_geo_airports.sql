-- City-center geo + airport master for Sabre open-GDS discover (Trip Builder).
-- Lat/long live on kb_cities (geography). destination_profiles stay Rate Layer routing.
-- Depends on: 016 (kb_cities, kb_countries).
-- Additive only.

-- =============================================================================
-- 1. kb_cities — city-center coordinates + default Sabre search radius
-- =============================================================================

ALTER TABLE public.kb_cities
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS default_search_radius numeric(8, 2),
  ADD COLUMN IF NOT EXISTS default_search_uom text;

ALTER TABLE public.kb_cities
  DROP CONSTRAINT IF EXISTS kb_cities_latitude_range;
ALTER TABLE public.kb_cities
  ADD CONSTRAINT kb_cities_latitude_range
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);

ALTER TABLE public.kb_cities
  DROP CONSTRAINT IF EXISTS kb_cities_longitude_range;
ALTER TABLE public.kb_cities
  ADD CONSTRAINT kb_cities_longitude_range
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);

ALTER TABLE public.kb_cities
  DROP CONSTRAINT IF EXISTS kb_cities_lat_lng_pair;
ALTER TABLE public.kb_cities
  ADD CONSTRAINT kb_cities_lat_lng_pair
  CHECK ((latitude IS NULL) = (longitude IS NULL));

ALTER TABLE public.kb_cities
  DROP CONSTRAINT IF EXISTS kb_cities_default_search_radius_positive;
ALTER TABLE public.kb_cities
  ADD CONSTRAINT kb_cities_default_search_radius_positive
  CHECK (default_search_radius IS NULL OR default_search_radius > 0);

ALTER TABLE public.kb_cities
  DROP CONSTRAINT IF EXISTS kb_cities_default_search_uom_check;
ALTER TABLE public.kb_cities
  ADD CONSTRAINT kb_cities_default_search_uom_check
  CHECK (
    default_search_uom IS NULL
    OR default_search_uom IN ('MI', 'KM')
  );

COMMENT ON COLUMN public.kb_cities.latitude IS
  'City / destination center latitude for Sabre GetHotelAvail GeoSearch. Null until seeded.';
COMMENT ON COLUMN public.kb_cities.longitude IS
  'City / destination center longitude for Sabre GetHotelAvail GeoSearch. Null until seeded.';
COMMENT ON COLUMN public.kb_cities.default_search_radius IS
  'Default Sabre geo radius around city center (with default_search_uom). Null → app default (e.g. 25).';
COMMENT ON COLUMN public.kb_cities.default_search_uom IS
  'Sabre GeoRef UOM: MI | KM. Null → app default (usually MI).';

CREATE INDEX IF NOT EXISTS kb_cities_has_geo_idx
  ON public.kb_cities (id)
  WHERE active = true AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- =============================================================================
-- 2. kb_airports — IATA airport master (linked to city)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kb_airports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iata_code       text NOT NULL,
  name            text NOT NULL,
  city_id         uuid REFERENCES public.kb_cities (id) ON DELETE SET NULL,
  country_id      uuid REFERENCES public.kb_countries (id) ON DELETE SET NULL,
  latitude        double precision,
  longitude       double precision,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_airports_iata_format
    CHECK (iata_code ~ '^[A-Z]{3}$'),
  CONSTRAINT kb_airports_name_not_blank
    CHECK (length(trim(name)) > 0),
  CONSTRAINT kb_airports_latitude_range
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT kb_airports_longitude_range
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT kb_airports_lat_lng_pair
    CHECK ((latitude IS NULL) = (longitude IS NULL))
);

COMMENT ON TABLE public.kb_airports IS
  'Airport master (IATA) for Sabre GetHotelAvail airport RefPoint and Trip Builder location resolve. Prefer city_id link; country_id optional denormalized filter.';

COMMENT ON COLUMN public.kb_airports.iata_code IS
  'IATA airport code (CDG, DPS, DXB). Always uppercase 3 letters.';

COMMENT ON COLUMN public.kb_airports.city_id IS
  'Primary city this airport serves. Null only for rare unmapped airports.';

CREATE UNIQUE INDEX IF NOT EXISTS kb_airports_iata_uidx
  ON public.kb_airports (iata_code);

CREATE INDEX IF NOT EXISTS kb_airports_city_idx
  ON public.kb_airports (city_id)
  WHERE active = true AND city_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS kb_airports_country_idx
  ON public.kb_airports (country_id)
  WHERE active = true AND country_id IS NOT NULL;

DROP TRIGGER IF EXISTS kb_airports_set_updated_at ON public.kb_airports;
CREATE TRIGGER kb_airports_set_updated_at
  BEFORE UPDATE ON public.kb_airports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.kb_airports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_airports TO service_role;

-- =============================================================================
-- 3. kb_cities.preferred_airport_id — primary airport for Sabre airport search
-- =============================================================================

ALTER TABLE public.kb_cities
  ADD COLUMN IF NOT EXISTS preferred_airport_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kb_cities_preferred_airport_id_fkey'
  ) THEN
    ALTER TABLE public.kb_cities
      ADD CONSTRAINT kb_cities_preferred_airport_id_fkey
      FOREIGN KEY (preferred_airport_id)
      REFERENCES public.kb_airports (id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.kb_cities.preferred_airport_id IS
  'Preferred airport for Sabre open-GDS discover (airport RefPoint). Optional; fall back to city lat/long.';

CREATE INDEX IF NOT EXISTS kb_cities_preferred_airport_idx
  ON public.kb_cities (preferred_airport_id)
  WHERE preferred_airport_id IS NOT NULL;
