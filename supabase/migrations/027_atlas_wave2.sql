-- Atlas Wave 2 — advisor intelligence (§I6 step 4 / §I3).
-- Spec: docs/studio/schema-improvements-atlas-rates.md §I3
-- Depends on: 001 (team_members), 016 (kb_entities, kb_customer_feedback), 024.
--
-- Additive only. Safe-ish to re-run: IF NOT EXISTS.

-- =============================================================================
-- 1. kb_property_reports — Fora-style advisor writeups
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kb_property_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       uuid NOT NULL REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  author_id       uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  title           text NOT NULL,
  body            text NOT NULL,
  audience_tags   text[] NOT NULL DEFAULT '{}'::text[],
  status          text NOT NULL DEFAULT 'draft',
  kb_tier         text NOT NULL DEFAULT 'kb_verified',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_property_reports_title_not_blank
    CHECK (length(trim(title)) > 0),
  CONSTRAINT kb_property_reports_body_not_blank
    CHECK (length(trim(body)) > 0),
  CONSTRAINT kb_property_reports_status_check
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT kb_property_reports_tier_check
    CHECK (kb_tier IN ('kb_verified', 'kb_scraped', 'llm_general'))
);

COMMENT ON TABLE public.kb_property_reports IS
  'Long advisor writeups (Fora-style). Short pitch stays on kb_entities.advisor_take.';
COMMENT ON COLUMN public.kb_property_reports.audience_tags IS
  'honeymoon, family, …';

DROP TRIGGER IF EXISTS kb_property_reports_set_updated_at ON public.kb_property_reports;
CREATE TRIGGER kb_property_reports_set_updated_at
  BEFORE UPDATE ON public.kb_property_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS kb_property_reports_entity_status_idx
  ON public.kb_property_reports (entity_id, status)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS kb_property_reports_audience_idx
  ON public.kb_property_reports USING gin (audience_tags)
  WHERE status = 'published';

ALTER TABLE public.kb_property_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_property_reports TO service_role;

-- =============================================================================
-- 2. kb_customer_feedback — visibility + category_scores + travel context
-- =============================================================================

ALTER TABLE public.kb_customer_feedback
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS travel_date date,
  ADD COLUMN IF NOT EXISTS trip_style text,
  ADD COLUMN IF NOT EXISTS category_scores jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.kb_customer_feedback
  DROP CONSTRAINT IF EXISTS kb_customer_feedback_visibility_check;

ALTER TABLE public.kb_customer_feedback
  ADD CONSTRAINT kb_customer_feedback_visibility_check
    CHECK (visibility IN ('staff', 'studio', 'client_safe'));

ALTER TABLE public.kb_customer_feedback
  DROP CONSTRAINT IF EXISTS kb_customer_feedback_category_scores_object;

ALTER TABLE public.kb_customer_feedback
  ADD CONSTRAINT kb_customer_feedback_category_scores_object
    CHECK (jsonb_typeof(category_scores) = 'object');

COMMENT ON COLUMN public.kb_customer_feedback.visibility IS
  'staff = ops only; studio = advisors; client_safe = guest UI later.';
COMMENT ON COLUMN public.kb_customer_feedback.category_scores IS
  'Frozen keys only: cleanliness, facilities, food, location, value, child_friendliness → 1–5.';
COMMENT ON COLUMN public.kb_customer_feedback.trip_style IS
  'honeymoon | family | … optional context.';

CREATE INDEX IF NOT EXISTS kb_customer_feedback_visibility_idx
  ON public.kb_customer_feedback (entity_id, visibility, created_at DESC);

-- =============================================================================
-- 3. kb_entity_collections — advisor shortlists / favorites
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kb_entity_collections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  owner_id        uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  company_wide    boolean NOT NULL DEFAULT false,
  description     text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kb_entity_collections_name_not_blank
    CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE public.kb_entity_collections IS
  'Advisor shortlists / favorites. Not the master hotel catalogue.';

DROP TRIGGER IF EXISTS kb_entity_collections_set_updated_at ON public.kb_entity_collections;
CREATE TRIGGER kb_entity_collections_set_updated_at
  BEFORE UPDATE ON public.kb_entity_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS kb_entity_collections_owner_idx
  ON public.kb_entity_collections (owner_id)
  WHERE active = true AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS kb_entity_collections_company_wide_idx
  ON public.kb_entity_collections (company_wide)
  WHERE active = true AND company_wide = true;

CREATE TABLE IF NOT EXISTS public.kb_entity_collection_items (
  collection_id   uuid NOT NULL REFERENCES public.kb_entity_collections (id) ON DELETE CASCADE,
  entity_id       uuid NOT NULL REFERENCES public.kb_entities (id) ON DELETE CASCADE,
  sort_order      int NOT NULL DEFAULT 0,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (collection_id, entity_id)
);

COMMENT ON TABLE public.kb_entity_collection_items IS
  'Hotels (or other entities) inside an advisor collection.';

CREATE INDEX IF NOT EXISTS kb_entity_collection_items_entity_idx
  ON public.kb_entity_collection_items (entity_id);

ALTER TABLE public.kb_entity_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_entity_collection_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_entity_collections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_entity_collection_items TO service_role;
