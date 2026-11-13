-- Country season / weather windows for Trip Builder "When to go".
-- Multi-country: free-text labels + optional month bands (Japan, Maldives, Europe, ski…).
-- Depends on: 016 (kb_countries, kb_tier / provenance checks).
-- Additive only.

-- =============================================================================
-- 1. kb_country_season_windows
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kb_country_season_windows (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id        uuid NOT NULL REFERENCES public.kb_countries (id) ON DELETE CASCADE,
  season_key        text,
  label             text NOT NULL,
  months_label      text,
  month_from        smallint,
  month_to          smallint,
  day_from          smallint,
  day_to            smallint,
  climate_notes     text,
  best_for          text,
  watch_outs        text,
  demand_level      text,
  book_ahead_notes  text,
  sort_order        int NOT NULL DEFAULT 0,
  kb_tier           text NOT NULL DEFAULT 'kb_scraped',
  provenance        text NOT NULL DEFAULT 'kb',
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_country_season_windows_label_not_blank
    CHECK (length(trim(label)) > 0),
  CONSTRAINT kb_country_season_windows_month_from_range
    CHECK (month_from IS NULL OR month_from BETWEEN 1 AND 12),
  CONSTRAINT kb_country_season_windows_month_to_range
    CHECK (month_to IS NULL OR month_to BETWEEN 1 AND 12),
  CONSTRAINT kb_country_season_windows_day_from_range
    CHECK (day_from IS NULL OR day_from BETWEEN 1 AND 31),
  CONSTRAINT kb_country_season_windows_day_to_range
    CHECK (day_to IS NULL OR day_to BETWEEN 1 AND 31),
  CONSTRAINT kb_country_season_windows_demand_level_check
    CHECK (
      demand_level IS NULL
      OR demand_level IN ('peak', 'shoulder', 'value', 'avoid')
    ),
  CONSTRAINT kb_country_season_windows_tier_check
    CHECK (kb_tier IN ('kb_verified', 'kb_scraped', 'llm_general')),
  CONSTRAINT kb_country_season_windows_provenance_check
    CHECK (provenance IN ('kb', 'llm', 'advisor_direct'))
);

COMMENT ON TABLE public.kb_country_season_windows IS
  'Season / weather windows per country (guide table). best_season on kb_country_facts stays the short PureLuxe summary.';

COMMENT ON COLUMN public.kb_country_season_windows.season_key IS
  'Optional stable slug (spring, dry, ski). Free-text label is the display name.';

COMMENT ON COLUMN public.kb_country_season_windows.months_label IS
  'Human months string for chat (e.g. Mar to May).';

COMMENT ON COLUMN public.kb_country_season_windows.month_from IS
  'Optional 1–12 start month for trip-date overlap (supports wrap when month_to < month_from).';

COMMENT ON COLUMN public.kb_country_season_windows.demand_level IS
  'Optional: peak | shoulder | value | avoid — for Heads-up and ranking.';

CREATE UNIQUE INDEX IF NOT EXISTS kb_country_season_windows_country_key_uidx
  ON public.kb_country_season_windows (country_id, season_key)
  WHERE season_key IS NOT NULL AND active = true;

CREATE UNIQUE INDEX IF NOT EXISTS kb_country_season_windows_country_label_uidx
  ON public.kb_country_season_windows (country_id, lower(trim(label)))
  WHERE active = true;

CREATE INDEX IF NOT EXISTS kb_country_season_windows_country_sort_idx
  ON public.kb_country_season_windows (country_id, sort_order)
  WHERE active = true;

DROP TRIGGER IF EXISTS kb_country_season_windows_set_updated_at ON public.kb_country_season_windows;
CREATE TRIGGER kb_country_season_windows_set_updated_at
  BEFORE UPDATE ON public.kb_country_season_windows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.kb_country_season_windows ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_country_season_windows TO service_role;
