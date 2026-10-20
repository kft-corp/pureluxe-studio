-- Trip Builder agent: per-reply metrics + scheduled clean-up.
-- Spec: docs/trip-builder-agent-redesign.md §7.6, §7.7, §10
--       docs/trip-builder-agent-decisions.md (monitoring: own table, no hosted tracing)
-- Depends on: 001 (team_members), 012 (trips), 015 (trip_idempotency_keys,
--             trip_undo_actions, trip_pending_confirms).
--
-- Additive. Safe to re-run: IF NOT EXISTS / DROP IF EXISTS + CREATE OR REPLACE.
--
-- Adds:
--   agent_turns       — one row per agent reply (tokens, timing, tools, errors).
--                       Baseline for today's agent (v1) and the new agent (v2).
--   agent_cleanup()   — deletes expired agent rows. Scheduled daily when pg_cron
--                       is enabled; otherwise call it from Vercel Cron via RPC.

-- =============================================================================
-- 1. agent_turns
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agent_turns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             uuid REFERENCES public.trips (id) ON DELETE CASCADE,
  member_id           uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  channel             text NOT NULL DEFAULT 'trip'
                        CHECK (channel IN ('trip', 'home')),
  agent_version       text NOT NULL DEFAULT 'v1'
                        CHECK (agent_version IN ('v1', 'v2')),
  thread_id           text,
  client_request_id   text,
  prompt_version      text,
  model               text NOT NULL,
  fallback_used       boolean NOT NULL DEFAULT false,
  rounds              integer NOT NULL DEFAULT 0,
  tool_calls          jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_tokens        integer NOT NULL DEFAULT 0,
  output_tokens       integer NOT NULL DEFAULT 0,
  cache_read_tokens   integer NOT NULL DEFAULT 0,
  cache_write_tokens  integer NOT NULL DEFAULT 0,
  ttft_ms             integer,
  total_ms            integer,
  status              text NOT NULL DEFAULT 'ok'
                        CHECK (status IN ('ok', 'error', 'aborted')),
  error_code          text,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT agent_turns_model_not_blank
    CHECK (length(trim(model)) > 0),
  CONSTRAINT agent_turns_tool_calls_is_array
    CHECK (jsonb_typeof(tool_calls) = 'array'),
  CONSTRAINT agent_turns_counts_non_negative
    CHECK (
      rounds >= 0
      AND input_tokens >= 0
      AND output_tokens >= 0
      AND cache_read_tokens >= 0
      AND cache_write_tokens >= 0
    ),
  CONSTRAINT agent_turns_timings_non_negative
    CHECK (
      (ttft_ms IS NULL OR ttft_ms >= 0)
      AND (total_ms IS NULL OR total_ms >= 0)
    ),
  CONSTRAINT agent_turns_trip_when_trip_channel
    CHECK (channel = 'home' OR trip_id IS NOT NULL)
);

COMMENT ON TABLE public.agent_turns IS
  'One row per Trip Builder agent reply: model, rounds, tools, tokens, timing, errors. No message text, tool results, or client data — metrics only.';
COMMENT ON COLUMN public.agent_turns.channel IS
  'trip = Trip Builder chat on a trip; home = pre-trip home chat (trip_id null).';
COMMENT ON COLUMN public.agent_turns.agent_version IS
  'v1 = current agent (baseline); v2 = LangGraph agent behind TRIP_AGENT_V2.';
COMMENT ON COLUMN public.agent_turns.thread_id IS
  'LangGraph thread (trip:<id>). Null for v1.';
COMMENT ON COLUMN public.agent_turns.client_request_id IS
  'Same id as trip_chat_messages.client_request_id for the advisor message.';
COMMENT ON COLUMN public.agent_turns.prompt_version IS
  'Instructions version that produced the reply (e.g. TRIP_PROMPT_V2). Null for v1.';
COMMENT ON COLUMN public.agent_turns.fallback_used IS
  'True when the backup model (ANTHROPIC_FALLBACK_MODEL) answered.';
COMMENT ON COLUMN public.agent_turns.rounds IS
  'Model calls in this reply (1 + one per tool round).';
COMMENT ON COLUMN public.agent_turns.tool_calls IS
  'Array of { name, ms, ok, error_code }. Names and timings only — never inputs or results.';
COMMENT ON COLUMN public.agent_turns.input_tokens IS
  'Uncached input tokens summed across rounds.';
COMMENT ON COLUMN public.agent_turns.cache_read_tokens IS
  'Input tokens served from the prompt cache, summed across rounds.';
COMMENT ON COLUMN public.agent_turns.cache_write_tokens IS
  'Input tokens written to the prompt cache, summed across rounds.';
COMMENT ON COLUMN public.agent_turns.ttft_ms IS
  'Milliseconds from request start to the first streamed text.';
COMMENT ON COLUMN public.agent_turns.total_ms IS
  'Milliseconds from request start to the end of the reply.';
COMMENT ON COLUMN public.agent_turns.error_code IS
  'AppError code or provider error class. No error message text.';

CREATE INDEX IF NOT EXISTS agent_turns_created_idx
  ON public.agent_turns (created_at DESC);

CREATE INDEX IF NOT EXISTS agent_turns_trip_created_idx
  ON public.agent_turns (trip_id, created_at DESC)
  WHERE trip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_turns_version_created_idx
  ON public.agent_turns (agent_version, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_turns_errors_idx
  ON public.agent_turns (created_at DESC)
  WHERE status <> 'ok';

-- =============================================================================
-- 2. agent_cleanup() — retention for agent rows (redesign §7.7)
-- =============================================================================
-- Later migrations extend this function (rate search results, run locks,
-- LangGraph checkpoints) with CREATE OR REPLACE.

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

  RETURN jsonb_build_object(
    'agent_turns_deleted', v_turns,
    'idempotency_keys_deleted', v_idempotency,
    'undo_actions_deleted', v_undo,
    'pending_confirms_expired', v_confirms_closed,
    'pending_confirms_deleted', v_confirms_old
  );
END;
$$;

COMMENT ON FUNCTION public.agent_cleanup() IS
  'Daily retention: agent_turns 180d; idempotency keys 24h past expiry; undo rows 30d after use or expiry; pending confirms expired, then deleted 30d later. Returns row counts.';

-- Destructive: never callable from the browser (anon / authenticated).
REVOKE ALL ON FUNCTION public.agent_cleanup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_cleanup() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_cleanup() TO service_role;

-- =============================================================================
-- 3. Schedule — daily 03:30 UTC when pg_cron is enabled
-- =============================================================================
-- Without pg_cron this block does nothing. Enable it in Supabase
-- (Database → Extensions → pg_cron) and re-run this migration, or call
-- `select public.agent_cleanup()` from Vercel Cron via supabase.rpc().

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'agent-cleanup-daily',
      '30 3 * * *',
      'select public.agent_cleanup()'
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled: agent_cleanup() is not scheduled.';
  END IF;
END
$do$;

-- =============================================================================
-- 4. RLS + service_role grants (Studio APIs use service_role; no client policies)
-- =============================================================================

ALTER TABLE public.agent_turns ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_turns TO service_role;
