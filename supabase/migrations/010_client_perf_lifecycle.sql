-- Client module performance + lifecycle helpers.
-- Depends on 003–009.

-- =============================================================================
-- 1. Directory / search indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS clients_active_display_name_idx
  ON public.clients (display_name)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS clients_active_completeness_idx
  ON public.clients (profile_completeness)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS clients_phone_trgm_idx
  ON public.clients
  USING gin (phone gin_trgm_ops)
  WHERE active = true AND phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS client_merge_candidates_open_a_idx
  ON public.client_merge_candidates (client_id_a, similarity DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS client_merge_candidates_open_b_idx
  ON public.client_merge_candidates (client_id_b, similarity DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS client_documents_pending_upload_idx
  ON public.client_documents (created_at)
  WHERE status = 'pending_upload';

-- =============================================================================
-- 2. Document status: pending_upload (row exists before file lands)
-- =============================================================================

ALTER TABLE public.client_documents
  DROP CONSTRAINT IF EXISTS client_documents_status_check;

ALTER TABLE public.client_documents
  ADD CONSTRAINT client_documents_status_check
  CHECK (
    status IN (
      'pending_upload',
      'pending_review',
      'verified',
      'rejected',
      'expired'
    )
  );

COMMENT ON COLUMN public.client_documents.status IS
  'pending_upload | pending_review | verified | rejected | expired';

-- =============================================================================
-- 3. Completeness refresh in one DB round-trip
-- =============================================================================

CREATE OR REPLACE FUNCTION public.refresh_client_profile_completeness(
  p_client_id uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.clients%ROWTYPE;
  score integer := 0;
  has_preference boolean;
  has_verified_passport boolean;
  has_family boolean;
  has_health_basics boolean;
BEGIN
  SELECT * INTO c
  FROM public.clients
  WHERE id = p_client_id AND active = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.client_preferences
    WHERE client_id = p_client_id AND active = true
    LIMIT 1
  ) INTO has_preference;

  SELECT EXISTS (
    SELECT 1
    FROM public.client_documents
    WHERE client_id = p_client_id
      AND document_type = 'passport'
      AND status = 'verified'
    LIMIT 1
  ) INTO has_verified_passport;

  SELECT EXISTS (
    SELECT 1
    FROM public.family_members
    WHERE client_id = p_client_id
    LIMIT 1
  ) INTO has_family;

  SELECT EXISTS (
    SELECT 1
    FROM public.client_health_profiles h
    WHERE h.client_id = p_client_id
      AND (
        cardinality(h.dietary_restrictions) > 0
        OR nullif(trim(coalesce(h.emergency_contact_name, '')), '') IS NOT NULL
        OR nullif(trim(coalesce(h.emergency_contact_phone, '')), '') IS NOT NULL
      )
    LIMIT 1
  ) INTO has_health_basics;

  IF nullif(trim(coalesce(c.display_name, '')), '') IS NOT NULL THEN
    score := score + 10;
  END IF;
  IF nullif(trim(coalesce(c.email, '')), '') IS NOT NULL
     OR nullif(trim(coalesce(c.phone, '')), '') IS NOT NULL THEN
    score := score + 10;
  END IF;
  IF nullif(trim(coalesce(c.nationality, '')), '') IS NOT NULL THEN
    score := score + 10;
  END IF;
  IF nullif(trim(coalesce(c.city_of_residence, '')), '') IS NOT NULL THEN
    score := score + 10;
  END IF;
  IF c.important_dates IS NOT NULL AND jsonb_typeof(c.important_dates) = 'array'
     AND jsonb_array_length(c.important_dates) > 0 THEN
    score := score + 5;
  END IF;
  IF nullif(trim(coalesce(c.guest_notes, '')), '') IS NOT NULL OR has_preference THEN
    score := score + 10;
  END IF;
  IF has_verified_passport THEN
    score := score + 15;
  END IF;
  IF has_family THEN
    score := score + 10;
  END IF;
  IF c.relationship_owner_id IS NOT NULL THEN
    score := score + 10;
  END IF;
  IF has_health_basics THEN
    score := score + 10;
  END IF;

  score := LEAST(100, score);

  IF score IS DISTINCT FROM c.profile_completeness THEN
    UPDATE public.clients
    SET
      profile_completeness = score,
      updated_by_id = COALESCE(p_actor_id, updated_by_id),
      updated_at = now()
    WHERE id = p_client_id;
  END IF;

  RETURN score;
END;
$$;

COMMENT ON FUNCTION public.refresh_client_profile_completeness(uuid, uuid) IS
  'Recompute clients.profile_completeness from core fields + related signals in one call.';

-- =============================================================================
-- 4. Lifecycle purge helpers (call from cron / ops jobs)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.purge_stale_client_document_uploads(
  p_older_than interval DEFAULT interval '24 hours'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH doomed AS (
    DELETE FROM public.client_documents
    WHERE status = 'pending_upload'
      AND created_at < now() - p_older_than
    RETURNING 1
  )
  SELECT count(*)::integer INTO deleted_count FROM doomed;

  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_old_client_audit_logs(
  p_retain_days integer DEFAULT 365
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH doomed AS (
    DELETE FROM public.client_audit_log
    WHERE created_at < now() - make_interval(days => p_retain_days)
    RETURNING 1
  )
  SELECT count(*)::integer INTO deleted_count FROM doomed;

  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_inactive_client_preferences(
  p_older_than interval DEFAULT interval '90 days'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH doomed AS (
    DELETE FROM public.client_preferences
    WHERE active = false
      AND updated_at < now() - p_older_than
    RETURNING 1
  )
  SELECT count(*)::integer INTO deleted_count FROM doomed;

  RETURN deleted_count;
END;
$$;
