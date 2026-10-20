-- Trip Builder agent v2 foundations: action chat rows, stored rate searches,
-- the agent schema for saved progress, and the one-run-per-trip lock.
-- Spec: docs/trip-builder-agent-redesign.md §5.3, §5.6, §5.9, §7.1, §7.2, §7.4, §7.6, §7.7
--       Appendix A.1 (run lock), A.2 (chat messages), A.3 (rate results)
-- Depends on: 011 (rate_search_events, properties), 012 (trips, trip_legs,
--             trip_chat_messages), 015 (content check), 017 (agent_cleanup).
--
-- Additive. Safe to re-run: IF NOT EXISTS / DROP IF EXISTS + CREATE OR REPLACE.
--
-- Adds:
--   trip_chat_messages.kind / payload / trace_id — button taps stored as actions.
--   rate_search_events  — trip link, dates, party, status, expiry.
--   rate_search_results — one row per room offer (its id is the rate_ref).
--   agent schema        — LangGraph checkpoint tables (created by PostgresSaver.setup()).
--   trips.agent_run_id / agent_run_expires_at + agent_begin_run / agent_end_run.
--   agent_cleanup()     — extended with rate searches, run locks and checkpoints.
--   agent_turns.prep_ms / model_ms / prep_steps — where reply time goes (section 8).

-- =============================================================================
-- 1. trip_chat_messages — text, action (button tap) and event rows
-- =============================================================================

ALTER TABLE public.trip_chat_messages
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS trace_id text;

COMMENT ON COLUMN public.trip_chat_messages.kind IS
  'text = typed message or agent reply; action = button tap (payload holds { action, args }); event = system line such as Undo.';
COMMENT ON COLUMN public.trip_chat_messages.payload IS
  'Structured data for action / event rows. Content keeps the short label shown in chat.';
COMMENT ON COLUMN public.trip_chat_messages.trace_id IS
  'Agent run id behind this reply, so support can find the matching agent_turns row.';

ALTER TABLE public.trip_chat_messages
  DROP CONSTRAINT IF EXISTS trip_chat_messages_kind_valid,
  DROP CONSTRAINT IF EXISTS trip_chat_messages_payload_object,
  DROP CONSTRAINT IF EXISTS trip_chat_messages_content_not_blank;

ALTER TABLE public.trip_chat_messages
  ADD CONSTRAINT trip_chat_messages_kind_valid
    CHECK (kind IN ('text', 'action', 'event')),
  ADD CONSTRAINT trip_chat_messages_payload_object
    CHECK (payload IS NULL OR jsonb_typeof(payload) = 'object'),
  ADD CONSTRAINT trip_chat_messages_content_not_blank
    CHECK (
      length(trim(content)) > 0
      OR tool_calls IS NOT NULL
      OR payload IS NOT NULL
    );

-- =============================================================================
-- 2. rate_search_events — remembered searches (replaces the in-memory store)
-- =============================================================================

ALTER TABLE public.rate_search_events
  ADD COLUMN IF NOT EXISTS check_in date,
  ADD COLUMN IF NOT EXISTS check_out date,
  ADD COLUMN IF NOT EXISTS adults integer,
  ADD COLUMN IF NOT EXISTS children integer,
  ADD COLUMN IF NOT EXISTS rooms integer,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON TABLE public.rate_search_events IS
  'One row per rate search. Trip searches are remembered for follow-up questions until expires_at.';
COMMENT ON COLUMN public.rate_search_events.status IS
  'Search outcome: ok | empty | stub | consultant_required | error.';
COMMENT ON COLUMN public.rate_search_events.expires_at IS
  'Follow-up questions read this search until then. A trip, stay or rate change sets it to now().';
COMMENT ON COLUMN public.rate_search_events.meta IS
  'hotel_brief (rules on file for these dates) and markup (minimum markup note). No bank payout.';

ALTER TABLE public.rate_search_events
  DROP CONSTRAINT IF EXISTS rate_search_events_trip_fk,
  DROP CONSTRAINT IF EXISTS rate_search_events_leg_fk,
  DROP CONSTRAINT IF EXISTS rate_search_events_status_valid,
  DROP CONSTRAINT IF EXISTS rate_search_events_party_non_negative,
  DROP CONSTRAINT IF EXISTS rate_search_events_dates_ordered;

-- NOT VALID: older audit rows were written without a trip check.
ALTER TABLE public.rate_search_events
  ADD CONSTRAINT rate_search_events_trip_fk
    FOREIGN KEY (trip_id) REFERENCES public.trips (id) ON DELETE CASCADE NOT VALID,
  ADD CONSTRAINT rate_search_events_leg_fk
    FOREIGN KEY (leg_id) REFERENCES public.trip_legs (id) ON DELETE SET NULL NOT VALID,
  ADD CONSTRAINT rate_search_events_status_valid
    CHECK (
      status IS NULL
      OR status IN ('ok', 'empty', 'stub', 'consultant_required', 'error')
    ),
  ADD CONSTRAINT rate_search_events_party_non_negative
    CHECK (
      (adults IS NULL OR adults >= 0)
      AND (children IS NULL OR children >= 0)
      AND (rooms IS NULL OR rooms >= 1)
    ),
  ADD CONSTRAINT rate_search_events_dates_ordered
    CHECK (check_in IS NULL OR check_out IS NULL OR check_out > check_in);

CREATE INDEX IF NOT EXISTS rate_search_events_trip_created_idx
  ON public.rate_search_events (trip_id, created_at DESC)
  WHERE trip_id IS NOT NULL;

-- =============================================================================
-- 3. rate_search_results — one row per room offer
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_search_results (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_event_id      uuid NOT NULL REFERENCES public.rate_search_events (id) ON DELETE CASCADE,
  rank                 integer NOT NULL DEFAULT 0,
  property_id          uuid REFERENCES public.properties (id) ON DELETE SET NULL,
  property_name        text,
  room_title           text NOT NULL,
  board                text,
  team_cost            numeric NOT NULL,
  currency             text NOT NULL,
  rate_source_code     text NOT NULL,
  availability_status  text NOT NULL DEFAULT 'unknown',
  recommended          boolean NOT NULL DEFAULT false,
  cancellation         text,
  payment              text,
  inclusions           jsonb NOT NULL DEFAULT '[]'::jsonb,
  offer_rules          jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rate_search_results_room_title_not_blank
    CHECK (length(trim(room_title)) > 0),
  CONSTRAINT rate_search_results_team_cost_non_negative
    CHECK (team_cost >= 0),
  CONSTRAINT rate_search_results_availability_valid
    CHECK (availability_status IN ('available', 'on_request', 'unknown', 'unavailable')),
  CONSTRAINT rate_search_results_inclusions_array
    CHECK (jsonb_typeof(inclusions) = 'array'),
  CONSTRAINT rate_search_results_offer_rules_array
    CHECK (jsonb_typeof(offer_rules) = 'array'),
  CONSTRAINT rate_search_results_raw_object
    CHECK (jsonb_typeof(raw) = 'object')
);

COMMENT ON TABLE public.rate_search_results IS
  'Room offers from one rate search. The row id is the rate_ref: adding a room copies exact prices from here. Team cost is advisor-only.';
COMMENT ON COLUMN public.rate_search_results.rank IS
  'Order the search returned the offers in (0 = first).';
COMMENT ON COLUMN public.rate_search_results.raw IS
  'Supplier / contract payload from @pureluxe/rates (occupancy, season, package nights). No bank payout.';

CREATE INDEX IF NOT EXISTS rate_search_results_event_idx
  ON public.rate_search_results (search_event_id, rank);

-- =============================================================================
-- 4. agent schema — saved agent progress (LangGraph checkpoints)
-- =============================================================================
-- Tables are created by PostgresSaver.setup() on first use over DATABASE_URL.
-- Server only: never exposed through the Supabase API.

CREATE SCHEMA IF NOT EXISTS agent;

COMMENT ON SCHEMA agent IS
  'Trip Builder agent memory (LangGraph checkpoints). Server-only via DATABASE_URL. Sensitive fields are removed before saving. Deleted 90 days after last activity.';

REVOKE ALL ON SCHEMA agent FROM PUBLIC;
REVOKE ALL ON SCHEMA agent FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA agent REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA agent REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 5. Run lock — one agent run per trip at a time
-- =============================================================================

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS agent_run_id uuid,
  ADD COLUMN IF NOT EXISTS agent_run_expires_at timestamptz;

COMMENT ON COLUMN public.trips.agent_run_id IS
  'Agent run that holds this trip. A second message gets a busy reply until the run ends or the lock expires.';
COMMENT ON COLUMN public.trips.agent_run_expires_at IS
  'Lock expiry. The running agent renews it; a crashed run frees the trip when it passes.';

CREATE INDEX IF NOT EXISTS trips_agent_run_expires_idx
  ON public.trips (agent_run_expires_at)
  WHERE agent_run_id IS NOT NULL;

-- Take or renew the lock. True when this run holds the trip.
CREATE OR REPLACE FUNCTION public.agent_begin_run(
  p_trip_id uuid,
  p_run_id uuid,
  p_ttl_seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_taken boolean;
BEGIN
  IF p_ttl_seconds IS NULL OR p_ttl_seconds < 1 OR p_ttl_seconds > 900 THEN
    RAISE EXCEPTION 'agent_begin_run: ttl must be 1–900 seconds' USING ERRCODE = '22023';
  END IF;

  UPDATE public.trips
  SET agent_run_id = p_run_id,
      agent_run_expires_at = now() + make_interval(secs => p_ttl_seconds)
  WHERE id = p_trip_id
    AND (
      agent_run_id IS NULL
      OR agent_run_id = p_run_id
      OR agent_run_expires_at IS NULL
      OR agent_run_expires_at < now()
    )
  RETURNING true INTO v_taken;

  RETURN COALESCE(v_taken, false);
END;
$$;

COMMENT ON FUNCTION public.agent_begin_run(uuid, uuid, integer) IS
  'Take the trip run lock, or renew it for the same run. Returns false while another live run holds it.';

-- Release the lock. Only the run that holds it can release it.
CREATE OR REPLACE FUNCTION public.agent_end_run(p_trip_id uuid, p_run_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.trips
  SET agent_run_id = NULL,
      agent_run_expires_at = NULL
  WHERE id = p_trip_id
    AND agent_run_id = p_run_id;
$$;

COMMENT ON FUNCTION public.agent_end_run(uuid, uuid) IS
  'Release the trip run lock held by this run. No-op when another run holds it.';

REVOKE ALL ON FUNCTION public.agent_begin_run(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_begin_run(uuid, uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_begin_run(uuid, uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.agent_end_run(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_end_run(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_end_run(uuid, uuid) TO service_role;

-- =============================================================================
-- 6. agent_cleanup() — add rate searches, run locks and checkpoints (§7.7)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.agent_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_turns           integer;
  v_idempotency     integer;
  v_undo            integer;
  v_confirms_closed integer;
  v_confirms_old    integer;
  v_rate_searches   integer;
  v_run_locks       integer;
  v_threads         integer := 0;
BEGIN
  DELETE FROM public.agent_turns
  WHERE created_at < now() - interval '180 days';
  GET DIAGNOSTICS v_turns = ROW_COUNT;

  DELETE FROM public.trip_idempotency_keys
  WHERE expires_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_idempotency = ROW_COUNT;

  DELETE FROM public.trip_undo_actions
  WHERE (consumed_at IS NOT NULL AND consumed_at < now() - interval '30 days')
     OR expires_at < now() - interval '30 days';
  GET DIAGNOSTICS v_undo = ROW_COUNT;

  UPDATE public.trip_pending_confirms
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();
  GET DIAGNOSTICS v_confirms_closed = ROW_COUNT;

  DELETE FROM public.trip_pending_confirms
  WHERE status <> 'pending'
    AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_confirms_old = ROW_COUNT;

  -- Searches never used in a quote (trip_line_items.rate_search_result_id arrives in 021).
  DELETE FROM public.rate_search_events
  WHERE created_at < now() - interval '14 days';
  GET DIAGNOSTICS v_rate_searches = ROW_COUNT;

  UPDATE public.trips
  SET agent_run_id = NULL,
      agent_run_expires_at = NULL
  WHERE agent_run_id IS NOT NULL
    AND (agent_run_expires_at IS NULL OR agent_run_expires_at < now());
  GET DIAGNOSTICS v_run_locks = ROW_COUNT;

  -- Checkpoint tables exist only after PostgresSaver.setup() has run.
  IF to_regclass('agent.checkpoints') IS NOT NULL THEN
    WITH stale AS (
      SELECT thread_id
      FROM agent.checkpoints
      GROUP BY thread_id
      HAVING max((checkpoint ->> 'ts')::timestamptz) < now() - interval '90 days'
    ),
    writes AS (
      DELETE FROM agent.checkpoint_writes
      WHERE thread_id IN (SELECT thread_id FROM stale)
    ),
    blobs AS (
      DELETE FROM agent.checkpoint_blobs
      WHERE thread_id IN (SELECT thread_id FROM stale)
    ),
    removed AS (
      DELETE FROM agent.checkpoints
      WHERE thread_id IN (SELECT thread_id FROM stale)
      RETURNING thread_id
    )
    SELECT count(DISTINCT thread_id) INTO v_threads FROM removed;
  END IF;

  RETURN jsonb_build_object(
    'agent_turns_deleted', v_turns,
    'idempotency_keys_deleted', v_idempotency,
    'undo_actions_deleted', v_undo,
    'pending_confirms_expired', v_confirms_closed,
    'pending_confirms_deleted', v_confirms_old,
    'rate_searches_deleted', v_rate_searches,
    'run_locks_cleared', v_run_locks,
    'agent_threads_deleted', v_threads
  );
END;
$$;

COMMENT ON FUNCTION public.agent_cleanup() IS
  'Daily retention: agent_turns 180d; idempotency keys 24h past expiry; undo rows 30d after use or expiry; pending confirms expired, then deleted 30d later; rate searches 14d; stale run locks cleared; agent threads 90d after last activity. Returns row counts.';

REVOKE ALL ON FUNCTION public.agent_cleanup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_cleanup() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_cleanup() TO service_role;

-- =============================================================================
-- 7. RLS + service_role grants (Studio APIs use service_role; no client policies)
-- =============================================================================

ALTER TABLE public.rate_search_results ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_search_results TO service_role;

-- =============================================================================
-- 8. agent_turns timings — preparation vs model time (redesign §9, §10)
-- =============================================================================
-- total_ms − model_ms − tool time (in tool_calls) = database and app time.

ALTER TABLE public.agent_turns
  ADD COLUMN IF NOT EXISTS prep_ms integer,
  ADD COLUMN IF NOT EXISTS model_ms integer,
  ADD COLUMN IF NOT EXISTS prep_steps jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.agent_turns.prep_ms IS
  'Milliseconds from request start to the first model call: access check, run lock, saving the message, agent memory, trip load.';
COMMENT ON COLUMN public.agent_turns.model_ms IS
  'Milliseconds inside model calls, summed across rounds. Null when no model call ran.';
COMMENT ON COLUMN public.agent_turns.prep_steps IS
  'Milliseconds from request start to each preparation step, e.g. {"access":180,"lock":320,"saved":540,"memory":700,"trip":1900}.';

ALTER TABLE public.agent_turns
  DROP CONSTRAINT IF EXISTS agent_turns_prep_timings_non_negative,
  DROP CONSTRAINT IF EXISTS agent_turns_prep_steps_object;

ALTER TABLE public.agent_turns
  ADD CONSTRAINT agent_turns_prep_timings_non_negative
    CHECK ((prep_ms IS NULL OR prep_ms >= 0) AND (model_ms IS NULL OR model_ms >= 0)),
  ADD CONSTRAINT agent_turns_prep_steps_object
    CHECK (jsonb_typeof(prep_steps) = 'object');
