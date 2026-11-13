-- Internal PureLuxe hotel scoring-matrix factors (destination guide).
-- Full-name keys so Trip Builder can read without an abbr map.
-- Not guest feedback (that stays on rating_avg / kb_customer_feedback).
-- Depends on: 037 (guide_score on kb_hotel_details).

ALTER TABLE public.kb_hotel_details
  ADD COLUMN IF NOT EXISTS guide_score_factors jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.kb_hotel_details
  DROP CONSTRAINT IF EXISTS kb_hotel_details_guide_score_factors_object;

ALTER TABLE public.kb_hotel_details
  ADD CONSTRAINT kb_hotel_details_guide_score_factors_object
  CHECK (jsonb_typeof(guide_score_factors) = 'object');

COMMENT ON COLUMN public.kb_hotel_details.guide_score_factors IS
  'Internal guide matrix: luxury, support, rooms, food_and_beverage, neighbourhood, access, service, character, wellness, family, indian_client_fit, value, views_and_privacy, consistency. Values 1–5; omit key when unscored (?). Never client-facing; not guest feedback.';

COMMENT ON COLUMN public.kb_hotel_details.guide_score IS
  'Average of scored guide_score_factors (exclude ?). Internal only — never guest star rating.';
