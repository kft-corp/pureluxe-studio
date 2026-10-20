-- Trip Builder agent v2, Stage 2: the agent changes the trip itself, with Undo and approvals.
-- Spec: docs/trip-builder-agent-redesign.md §5.8, §5.9, §6 (Fix 1, Fix 2), §7.1
--       docs/trip-builder-agent-decisions.md (#2 risk levels, #4 extend 015 tables, #9 Undo 24 h)
-- Depends on: 012 (trips), 015 (trip_undo_actions, trip_idempotency_keys, trip_pending_confirms).
--
-- Additive. Safe to re-run: IF NOT EXISTS / DROP IF EXISTS + CREATE OR REPLACE.
--
-- Adds:
--   trips.version / assumptions          — stale-change check; values the agent assumed.
--   trip_undo_actions.tool / args / summary / idempotency_key
--   trip_pending_confirms.thread_id / trip_version / summary
--   agent_record_trip_change()           — version + Undo copy + duplicate record, all or nothing.
--   agent_record_trip_undo()             — use an Undo once, bump the version.

-- =============================================================================
-- 1. trips — version and assumptions
-- =============================================================================

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assumptions jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.trips.version IS
  'Bumped on every agent change and Undo. A change or approval made against an older version is refused.';
COMMENT ON COLUMN public.trips.assumptions IS
  'Values the agent assumed rather than asked, e.g. {"year": true, "rooms": true}. Shown as editable in the header.';

ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_version_positive,
  DROP CONSTRAINT IF EXISTS trips_assumptions_object;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_version_positive CHECK (version >= 1),
  ADD CONSTRAINT trips_assumptions_object CHECK (jsonb_typeof(assumptions) = 'object');

-- =============================================================================
-- 2. trip_undo_actions — one row per agent change
-- =============================================================================

ALTER TABLE public.trip_undo_actions
  ADD COLUMN IF NOT EXISTS tool text,
  ADD COLUMN IF NOT EXISTS args jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

COMMENT ON TABLE public.trip_undo_actions IS
  'One row per agent change. before_payload restores the trip; usable once, for 24 hours.';
COMMENT ON COLUMN public.trip_undo_actions.summary IS
  'What changed, shown on the Undo button, e.g. "Dates set to 10–15 Dec 2026".';

CREATE UNIQUE INDEX IF NOT EXISTS trip_undo_actions_idem_uidx
  ON public.trip_undo_actions (trip_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- =============================================================================
-- 3. trip_pending_confirms — approval cards that survive a reload
-- =============================================================================

ALTER TABLE public.trip_pending_confirms
  ADD COLUMN IF NOT EXISTS thread_id text,
  ADD COLUMN IF NOT EXISTS trip_version integer,
  ADD COLUMN IF NOT EXISTS summary text;

COMMENT ON COLUMN public.trip_pending_confirms.thread_id IS
  'Agent thread (trip:<id>) paused on this approval.';
COMMENT ON COLUMN public.trip_pending_confirms.trip_version IS
  'trips.version when the card was shown. A change since then refuses the approval.';
COMMENT ON COLUMN public.trip_pending_confirms.summary IS
  'What Confirm will do, shown on the card.';

-- =============================================================================
-- 4. agent_record_trip_change() — bookkeeping for one change, all or nothing
-- =============================================================================
-- The change itself runs through Studio's trip services first. This records it:
-- bumps the version, stores the Undo copy and the duplicate-protection result.

CREATE OR REPLACE FUNCTION public.agent_record_trip_change(
  p_trip_id uuid,
  p_member_id uuid,
  p_tool text,
  p_args jsonb,
  p_summary text,
  p_before jsonb,
  p_after jsonb,
  p_idempotency_key text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_version integer;
BEGIN
  UPDATE public.trips
  SET version = version + 1
  WHERE id = p_trip_id
  RETURNING version INTO v_version;

  IF v_version IS NULL THEN
    RAISE EXCEPTION 'agent_record_trip_change: trip % not found', p_trip_id USING ERRCODE = 'P0002';
  END IF;

  -- No before copy: the change can't be undone (it cancelled bookings or cleared rates).
  IF p_before IS NOT NULL THEN
    INSERT INTO public.trip_undo_actions
      (trip_id, member_id, action, tool, args, summary, before_payload, after_payload, expires_at, idempotency_key)
    VALUES
      (p_trip_id, p_member_id, p_tool, p_tool, p_args, p_summary, p_before, COALESCE(p_after, '{}'::jsonb),
       now() + interval '24 hours', p_idempotency_key);
  END IF;

  INSERT INTO public.trip_idempotency_keys (trip_id, member_id, idempotency_key, result, expires_at)
  VALUES (
    p_trip_id, p_member_id, p_idempotency_key,
    jsonb_build_object('ok', true, 'summary', p_summary, 'version', v_version),
    now() + interval '24 hours'
  )
  ON CONFLICT (member_id, idempotency_key, (COALESCE(trip_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  DO NOTHING;

  RETURN v_version;
END;
$$;

COMMENT ON FUNCTION public.agent_record_trip_change(uuid, uuid, text, jsonb, text, jsonb, jsonb, text) IS
  'Record one agent change in one transaction: version + 1, Undo row (24 h, skipped when p_before is null), duplicate-protection result. Returns the new version.';

-- =============================================================================
-- 5. agent_record_trip_undo() — use an Undo once
-- =============================================================================

CREATE OR REPLACE FUNCTION public.agent_record_trip_undo(
  p_trip_id uuid,
  p_undo_id uuid,
  p_member_id uuid,
  p_idempotency_key text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_version integer;
BEGIN
  UPDATE public.trip_undo_actions
  SET consumed_at = now()
  WHERE id = p_undo_id
    AND trip_id = p_trip_id
    AND consumed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agent_record_trip_undo: undo % already used', p_undo_id USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.trips
  SET version = version + 1
  WHERE id = p_trip_id
  RETURNING version INTO v_version;

  INSERT INTO public.trip_idempotency_keys (trip_id, member_id, idempotency_key, result, expires_at)
  VALUES (
    p_trip_id, p_member_id, p_idempotency_key,
    jsonb_build_object('ok', true, 'undone', p_undo_id, 'version', v_version),
    now() + interval '24 hours'
  )
  ON CONFLICT (member_id, idempotency_key, (COALESCE(trip_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  DO NOTHING;

  RETURN v_version;
END;
$$;

COMMENT ON FUNCTION public.agent_record_trip_undo(uuid, uuid, uuid, text) IS
  'Mark an Undo used (once), bump the trip version and store the duplicate-protection result. Returns the new version.';

REVOKE ALL ON FUNCTION public.agent_record_trip_change(uuid, uuid, text, jsonb, text, jsonb, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_record_trip_change(uuid, uuid, text, jsonb, text, jsonb, jsonb, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_record_trip_change(uuid, uuid, text, jsonb, text, jsonb, jsonb, text) TO service_role;

REVOKE ALL ON FUNCTION public.agent_record_trip_undo(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_record_trip_undo(uuid, uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_record_trip_undo(uuid, uuid, uuid, text) TO service_role;
