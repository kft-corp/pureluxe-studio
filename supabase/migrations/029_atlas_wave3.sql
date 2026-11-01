-- Atlas Wave 3 — client polish + rating cache + POIs (§I6 step 6 / §I4).
-- Spec: docs/studio/schema-improvements-atlas-rates.md §I4
-- Depends on: 016 (kb_entities, kb_hotel_details, kb_cities, kb_facts, kb_customer_feedback),
--             027 (feedback visibility / category_scores).
--
-- Additive only. Safe-ish to re-run: IF NOT EXISTS.

-- =============================================================================
-- 1. kb_hotel_details — rating cache + optional star class + popularity
-- =============================================================================

ALTER TABLE public.kb_hotel_details
  ADD COLUMN IF NOT EXISTS star_rating smallint,
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3, 2),
  ADD COLUMN IF NOT EXISTS rating_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category_rating_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS times_quoted int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS times_booked int NOT NULL DEFAULT 0;

ALTER TABLE public.kb_hotel_details
  DROP CONSTRAINT IF EXISTS kb_hotel_details_star_rating_range,
  DROP CONSTRAINT IF EXISTS kb_hotel_details_rating_avg_range,
  DROP CONSTRAINT IF EXISTS kb_hotel_details_rating_count_nonneg,
  DROP CONSTRAINT IF EXISTS kb_hotel_details_category_rating_stats_object,
  DROP CONSTRAINT IF EXISTS kb_hotel_details_times_quoted_nonneg,
  DROP CONSTRAINT IF EXISTS kb_hotel_details_times_booked_nonneg;

ALTER TABLE public.kb_hotel_details
  ADD CONSTRAINT kb_hotel_details_star_rating_range
    CHECK (star_rating IS NULL OR star_rating BETWEEN 1 AND 5),
  ADD CONSTRAINT kb_hotel_details_rating_avg_range
    CHECK (rating_avg IS NULL OR (rating_avg >= 0 AND rating_avg <= 5)),
  ADD CONSTRAINT kb_hotel_details_rating_count_nonneg
    CHECK (rating_count >= 0),
  ADD CONSTRAINT kb_hotel_details_category_rating_stats_object
    CHECK (jsonb_typeof(category_rating_stats) = 'object'),
  ADD CONSTRAINT kb_hotel_details_times_quoted_nonneg
    CHECK (times_quoted >= 0),
  ADD CONSTRAINT kb_hotel_details_times_booked_nonneg
    CHECK (times_booked >= 0);

COMMENT ON COLUMN public.kb_hotel_details.star_rating IS
  'Optional official class 1–5 (not PureLuxe feedback).';
COMMENT ON COLUMN public.kb_hotel_details.rating_avg IS
  'Cached overall avg from kb_customer_feedback (studio / client_safe). Source of truth = feedback rows.';
COMMENT ON COLUMN public.kb_hotel_details.rating_count IS
  'Cached count of feedback rows used for rating_avg.';
COMMENT ON COLUMN public.kb_hotel_details.category_rating_stats IS
  'Cached {category:{avg,count}} for cleanliness, facilities, food, location, value, child_friendliness.';
COMMENT ON COLUMN public.kb_hotel_details.times_quoted IS
  'Popularity cache: how often this hotel was quoted (derived from trips — not Excel).';
COMMENT ON COLUMN public.kb_hotel_details.times_booked IS
  'Popularity cache: how often this hotel was booked (derived from bookings — not Excel).';

CREATE INDEX IF NOT EXISTS kb_hotel_details_rating_avg_idx
  ON public.kb_hotel_details (rating_avg DESC NULLS LAST)
  WHERE rating_count > 0;

-- =============================================================================
-- 2. Helper to refresh rating cache from feedback (studio + client_safe)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.kb_refresh_hotel_rating_cache(p_entity_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_avg numeric(3, 2);
  v_count int;
  v_stats jsonb;
BEGIN
  SELECT
    round(avg(f.rating)::numeric, 2),
    count(*)::int
  INTO v_avg, v_count
  FROM public.kb_customer_feedback f
  WHERE f.entity_id = p_entity_id
    AND f.visibility IN ('studio', 'client_safe')
    AND f.rating IS NOT NULL;

  SELECT coalesce(
    jsonb_object_agg(cat.key, jsonb_build_object('avg', cat.avg, 'count', cat.cnt)),
    '{}'::jsonb
  )
  INTO v_stats
  FROM (
    SELECT
      ks.key,
      round(avg((f.category_scores ->> ks.key)::numeric), 2) AS avg,
      count(*)::int AS cnt
    FROM public.kb_customer_feedback f
    CROSS JOIN (
      VALUES
        ('cleanliness'),
        ('facilities'),
        ('food'),
        ('location'),
        ('value'),
        ('child_friendliness')
    ) AS ks(key)
    WHERE f.entity_id = p_entity_id
      AND f.visibility IN ('studio', 'client_safe')
      AND f.category_scores ? ks.key
      AND (f.category_scores ->> ks.key) ~ '^[1-5]$'
    GROUP BY ks.key
  ) cat;

  UPDATE public.kb_hotel_details d
  SET
    rating_avg = v_avg,
    rating_count = coalesce(v_count, 0),
    category_rating_stats = coalesce(v_stats, '{}'::jsonb)
  WHERE d.entity_id = p_entity_id;
END;
$$;

COMMENT ON FUNCTION public.kb_refresh_hotel_rating_cache(uuid) IS
  'Recompute kb_hotel_details rating_avg / rating_count / category_rating_stats from studio+client_safe feedback.';

GRANT EXECUTE ON FUNCTION public.kb_refresh_hotel_rating_cache(uuid) TO service_role;

-- =============================================================================
-- 3. kb_nearby_pois — airport / beach / landmark near hotel or city
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kb_nearby_pois (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       uuid REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  city_id         uuid REFERENCES public.kb_cities (id) ON DELETE CASCADE,
  name            text NOT NULL,
  poi_type        text NOT NULL,
  distance_text   text,
  distance_m      int,
  latitude        double precision,
  longitude       double precision,
  sort_order      int NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_nearby_pois_name_not_blank
    CHECK (length(trim(name)) > 0),
  CONSTRAINT kb_nearby_pois_type_check
    CHECK (poi_type IN ('airport', 'beach', 'landmark', 'restaurant', 'other')),
  CONSTRAINT kb_nearby_pois_has_parent
    CHECK (entity_id IS NOT NULL OR city_id IS NOT NULL),
  CONSTRAINT kb_nearby_pois_distance_m_nonneg
    CHECK (distance_m IS NULL OR distance_m >= 0),
  CONSTRAINT kb_nearby_pois_latitude_range
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT kb_nearby_pois_longitude_range
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT kb_nearby_pois_lat_lng_pair
    CHECK ((latitude IS NULL) = (longitude IS NULL))
);

COMMENT ON TABLE public.kb_nearby_pois IS
  'Nearby airport/beach/landmark for hotel detail / Trip Builder. Prefer entity_id; city_id alone = city-level POI.';
COMMENT ON COLUMN public.kb_nearby_pois.distance_text IS
  'Advisor-friendly distance, e.g. "25 min seaplane".';

DROP TRIGGER IF EXISTS kb_nearby_pois_set_updated_at ON public.kb_nearby_pois;
CREATE TRIGGER kb_nearby_pois_set_updated_at
  BEFORE UPDATE ON public.kb_nearby_pois
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS kb_nearby_pois_entity_idx
  ON public.kb_nearby_pois (entity_id, sort_order)
  WHERE active = true AND entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS kb_nearby_pois_city_idx
  ON public.kb_nearby_pois (city_id, sort_order)
  WHERE active = true AND city_id IS NOT NULL;

ALTER TABLE public.kb_nearby_pois ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_nearby_pois TO service_role;

-- =============================================================================
-- 4. kb_facts.fact_kind — highlight | faq | general
-- =============================================================================

ALTER TABLE public.kb_facts
  ADD COLUMN IF NOT EXISTS fact_kind text NOT NULL DEFAULT 'general';

ALTER TABLE public.kb_facts
  DROP CONSTRAINT IF EXISTS kb_facts_fact_kind_check;

ALTER TABLE public.kb_facts
  ADD CONSTRAINT kb_facts_fact_kind_check
    CHECK (fact_kind IN ('highlight', 'faq', 'general'));

COMMENT ON COLUMN public.kb_facts.fact_kind IS
  'Optional fact flavour for UI: highlight | faq | general.';

CREATE INDEX IF NOT EXISTS kb_facts_entity_kind_idx
  ON public.kb_facts (entity_id, fact_kind)
  WHERE status = 'approved';
