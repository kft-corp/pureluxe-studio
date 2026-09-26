-- Client module: preferences, health, documents, relationships, audit, dedup.
-- Depends on 003_studio_clients.sql.
-- Canonical spec: docs/studio/client_module.md §6.3–6.5, §6.6, §6.9, §6.10
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where practical.

-- =============================================================================
-- 1. client_preferences
--    Structured taste — dietary restrictions belong in client_health_profiles.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_preferences (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  category         text NOT NULL,
  label            text NOT NULL,
  sentiment        text NOT NULL DEFAULT 'prefer'
                     CHECK (sentiment IN ('prefer', 'avoid', 'require')),
  source           text NOT NULL DEFAULT 'advisor'
                     CHECK (source IN ('advisor', 'guest', 'import', 'trainer')),
  is_confirmed     boolean NOT NULL DEFAULT true,
  notes            text,
  active           boolean NOT NULL DEFAULT true,
  created_by_id    uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  confirmed_by_id  uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  confirmed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT client_preferences_label_not_blank CHECK (length(trim(label)) > 0),
  CONSTRAINT client_preferences_category_not_blank CHECK (length(trim(category)) > 0)
);

COMMENT ON TABLE public.client_preferences IS
  'Structured client preferences. Guest-added rows stay is_confirmed = false until advisor confirms.';
COMMENT ON COLUMN public.client_preferences.sentiment IS 'prefer | avoid | require';
COMMENT ON COLUMN public.client_preferences.is_confirmed IS
  'false when source = guest until advisor confirms in Studio.';

CREATE INDEX IF NOT EXISTS client_preferences_client_idx
  ON public.client_preferences (client_id, category)
  WHERE active = true;

DROP TRIGGER IF EXISTS client_preferences_set_updated_at ON public.client_preferences;
CREATE TRIGGER client_preferences_set_updated_at
  BEFORE UPDATE ON public.client_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2. client_health_profiles
--    One health record per client (upsert). Sensitive — stricter access in app code.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_health_profiles (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid NOT NULL UNIQUE REFERENCES public.clients (id) ON DELETE CASCADE,
  dietary_restrictions    text[] NOT NULL DEFAULT '{}',
  mobility_notes          text,
  medication_notes        text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  share_with_hotels       boolean NOT NULL DEFAULT true,
  notes                   text,
  updated_by_id           uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_health_profiles IS
  'One-to-one health profile per client. medication_notes is Studio-only.';
COMMENT ON COLUMN public.client_health_profiles.medication_notes IS
  'Never returned by default guest API; never log in plain text.';

DROP TRIGGER IF EXISTS client_health_profiles_set_updated_at ON public.client_health_profiles;
CREATE TRIGGER client_health_profiles_set_updated_at
  BEFORE UPDATE ON public.client_health_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. client_documents
--    Passports and travel docs with verification lifecycle.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  document_type     text NOT NULL
                      CHECK (document_type IN ('passport', 'visa', 'insurance', 'other')),
  document_number   text,
  issuing_country   text,
  expiry_date       date,
  date_of_birth     date,
  file_path         text,
  file_name         text,
  mime_type         text,
  file_size_bytes   bigint,
  status            text NOT NULL DEFAULT 'pending_review'
                      CHECK (status IN ('pending_review', 'verified', 'rejected', 'expired')),
  verified_at       timestamptz,
  verified_by_id    uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  uploaded_by_id    uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_documents IS
  'Client travel documents. Type-specific fields use generic columns + metadata JSONB.';
COMMENT ON COLUMN public.client_documents.file_path IS 'Supabase Storage path.';

CREATE INDEX IF NOT EXISTS client_documents_client_idx
  ON public.client_documents (client_id);

CREATE INDEX IF NOT EXISTS client_documents_expiry_idx
  ON public.client_documents (expiry_date)
  WHERE document_type = 'passport' AND status = 'verified';

DROP TRIGGER IF EXISTS client_documents_set_updated_at ON public.client_documents;
CREATE TRIGGER client_documents_set_updated_at
  BEFORE UPDATE ON public.client_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 4. client_relationships
--    Non-household links only — spouse/child/parent live in family_members.role.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_relationships (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_client_id     uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  to_client_id       uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  relationship_type  text NOT NULL
                       CHECK (relationship_type IN (
                         'assistant', 'travel_companion', 'colleague', 'referrer', 'other'
                       )),
  notes              text,
  created_by_id      uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),

  UNIQUE (from_client_id, to_client_id, relationship_type),
  CHECK (from_client_id <> to_client_id)
);

COMMENT ON TABLE public.client_relationships IS
  'Professional / non-household links between client records. Household uses families + family_members.';

-- =============================================================================
-- 5. client_merge_candidates
--    Persisted dedup suggestions — not a hard unique constraint on names.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_merge_candidates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id_a     uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  client_id_b     uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  similarity      numeric(4, 3) NOT NULL CHECK (similarity BETWEEN 0 AND 1),
  match_reason    text NOT NULL,
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'merged', 'dismissed')),
  notes           text,
  resolved_by_id  uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CHECK (client_id_a < client_id_b),
  UNIQUE (client_id_a, client_id_b)
);

COMMENT ON TABLE public.client_merge_candidates IS
  'Dedup suggestions with resolution state. Pairs stored in canonical order (client_id_a < client_id_b).';
COMMENT ON COLUMN public.client_merge_candidates.match_reason IS 'name | email | phone | composite';
COMMENT ON COLUMN public.client_merge_candidates.notes IS
  'Ops notes — e.g. why dismissed, or context before merge.';

DROP TRIGGER IF EXISTS client_merge_candidates_set_updated_at ON public.client_merge_candidates;
CREATE TRIGGER client_merge_candidates_set_updated_at
  BEFORE UPDATE ON public.client_merge_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 6. client_audit_log
--    Append-only field-level history. Never store health field values here.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  action          text NOT NULL
                    CHECK (action IN (
                      'created', 'updated', 'merged', 'deactivated', 'reactivated',
                      'approved', 'document_verified', 'preference_confirmed', 'guest_invited'
                    )),
  field_name      text,
  old_value       text,
  new_value       text,
  team_member_id  uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_audit_log IS
  'Append-only client change history. Prefer over last_edited_by columns on clients.';

CREATE INDEX IF NOT EXISTS client_audit_log_client_idx
  ON public.client_audit_log (client_id, created_at DESC);

-- =============================================================================
-- 7. find_similar_clients
--    pg_trgm-powered dedup suggestions for profile banner and create-time checks.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.find_similar_clients(
  search_name text,
  similarity_threshold numeric DEFAULT 0.3,
  exclude_client_id uuid DEFAULT NULL,
  result_limit int DEFAULT 10
)
RETURNS TABLE (
  client_id uuid,
  display_name text,
  similarity numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id AS client_id,
    c.display_name,
    similarity(c.display_name, search_name)::numeric(4, 3) AS similarity
  FROM public.clients c
  WHERE c.active = true
    AND search_name IS NOT NULL
    AND length(trim(search_name)) > 0
    AND (exclude_client_id IS NULL OR c.id <> exclude_client_id)
    AND similarity(c.display_name, search_name) >= similarity_threshold
  ORDER BY similarity DESC, c.display_name
  LIMIT GREATEST(result_limit, 0);
$$;

COMMENT ON FUNCTION public.find_similar_clients(text, numeric, uuid, int) IS
  'Returns active clients whose display_name is similar to search_name (pg_trgm).';

-- =============================================================================
-- 8. Row Level Security + service_role grants
-- =============================================================================

ALTER TABLE public.client_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_merge_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_audit_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_preferences TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_health_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_relationships TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_merge_candidates TO service_role;
GRANT SELECT, INSERT, DELETE ON public.client_audit_log TO service_role;

GRANT EXECUTE ON FUNCTION public.find_similar_clients(text, numeric, uuid, int) TO service_role;
