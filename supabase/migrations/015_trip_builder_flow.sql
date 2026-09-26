-- Trip Builder + Trips portfolio: complete the kernel for the current product flow.
-- Spec: docs/studio/trip-builder-module.md §7 / §10
--       docs/studio/trips-module.md §6
-- Depends on: 011 (destination_profiles, company_settings), 012 (trip kernel), 013 (bookings).
--
-- Do NOT edit 012 — already consumed by 013/014. This migration is additive.
-- Safe to re-run: IF NOT EXISTS / DROP IF EXISTS + CREATE OR REPLACE.
--
-- Adds durable relations the kernel deferred:
--   trip_pending_confirms, trip_attachments, trip_undo_actions,
--   trip_idempotency_keys, trip_attention_snoozes
-- Tightens documents, assignment recents, one-selected stay, one-primary traveller.

-- =============================================================================
-- 1. Helpers — parent recency + studio chat preview (home / trip ▾)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.touch_parent_trip()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_trip_id uuid;
BEGIN
  v_trip_id := COALESCE(NEW.trip_id, OLD.trip_id);
  IF v_trip_id IS NOT NULL THEN
    UPDATE public.trips
    SET updated_at = now()
    WHERE id = v_trip_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.touch_parent_trip() IS
  'Keeps trips.updated_at current when children change — assigned recents / portfolio sort.';

CREATE OR REPLACE FUNCTION public.sync_trip_studio_chat_preview()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.channel IS DISTINCT FROM 'studio' THEN
    RETURN NEW;
  END IF;

  UPDATE public.trips
  SET
    last_studio_message_at = NEW.created_at,
    last_studio_message_preview = NULLIF(left(trim(NEW.content), 180), ''),
    updated_at = now()
  WHERE id = NEW.trip_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_trip_studio_chat_preview() IS
  'Denormalizes last studio message onto trips for home / header switcher.';

-- =============================================================================
-- 2. trips — archive, recents columns, money sanity, assigned-recent index
-- =============================================================================

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by_id uuid
    REFERENCES public.team_members (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_studio_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_studio_message_preview text;

COMMENT ON COLUMN public.trips.archived_at IS
  'Soft-hide from Trip Builder home default. NULL = visible. Portfolio may still list.';
COMMENT ON COLUMN public.trips.archived_by_id IS
  'Team member who archived. Hard delete remains admin-only (not this column).';
COMMENT ON COLUMN public.trips.last_studio_message_at IS
  'Denormalized from trip_chat_messages (channel=studio). Do not treat as chat truth.';
COMMENT ON COLUMN public.trips.last_studio_message_preview IS
  'Truncated last studio message for home / trip ▾. Chat rows remain canonical.';

ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_sell_total_non_negative,
  DROP CONSTRAINT IF EXISTS trips_cost_total_non_negative,
  DROP CONSTRAINT IF EXISTS trips_margin_internal_non_negative;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_sell_total_non_negative
    CHECK (sell_total IS NULL OR sell_total >= 0),
  ADD CONSTRAINT trips_cost_total_non_negative
    CHECK (cost_total_internal IS NULL OR cost_total_internal >= 0);

CREATE INDEX IF NOT EXISTS trips_assigned_recent_idx
  ON public.trips (relationship_owner_id, updated_at DESC)
  WHERE archived_at IS NULL AND is_demo = false;

CREATE INDEX IF NOT EXISTS trips_archived_at_idx
  ON public.trips (archived_at)
  WHERE archived_at IS NOT NULL;

-- =============================================================================
-- 3. trip_clients — one primary traveller per trip
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS trip_clients_one_primary_uidx
  ON public.trip_clients (trip_id)
  WHERE role = 'primary';

COMMENT ON INDEX public.trip_clients_one_primary_uidx IS
  'Domain must keep trips.primary_client_id in sync with the primary trip_clients row.';

-- =============================================================================
-- 4. trip_legs — optional Rate Layer profile + date order
-- =============================================================================

ALTER TABLE public.trip_legs
  ADD COLUMN IF NOT EXISTS destination_profile_id uuid
    REFERENCES public.destination_profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.trip_legs.destination IS
  'Advisor-entered destination text (search / display).';
COMMENT ON COLUMN public.trip_legs.destination_profile_id IS
  'Resolved Rate Layer profile when known. Nullable — resolve-at-search still valid.';

ALTER TABLE public.trip_legs
  DROP CONSTRAINT IF EXISTS trip_legs_dates_ordered;

ALTER TABLE public.trip_legs
  ADD CONSTRAINT trip_legs_dates_ordered
    CHECK (
      check_in IS NULL
      OR check_out IS NULL
      OR check_out >= check_in
    );

CREATE INDEX IF NOT EXISTS trip_legs_destination_profile_idx
  ON public.trip_legs (destination_profile_id)
  WHERE destination_profile_id IS NOT NULL;

-- =============================================================================
-- 5. trip_line_items — one selected option per leg + category; availability
-- =============================================================================

ALTER TABLE public.trip_line_items
  ADD COLUMN IF NOT EXISTS availability_status text
    CHECK (
      availability_status IS NULL
      OR availability_status IN ('unknown', 'available', 'unavailable', 'on_request')
    );

COMMENT ON COLUMN public.trip_line_items.availability_status IS
  'Offline / supplier check. NULL or unknown until checked. Attention: selected + unavailable.';

ALTER TABLE public.trip_line_items
  DROP CONSTRAINT IF EXISTS trip_line_items_sell_non_negative,
  DROP CONSTRAINT IF EXISTS trip_line_items_cost_non_negative;

ALTER TABLE public.trip_line_items
  ADD CONSTRAINT trip_line_items_sell_non_negative
    CHECK (sell_amount IS NULL OR sell_amount >= 0),
  ADD CONSTRAINT trip_line_items_cost_non_negative
    CHECK (cost_internal IS NULL OR cost_internal >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS trip_line_items_one_selected_uidx
  ON public.trip_line_items (trip_id, leg_id, category)
  WHERE selected = true AND leg_id IS NOT NULL;

COMMENT ON INDEX public.trip_line_items_one_selected_uidx IS
  'One selected stay/option per leg + category. Null-leg rows (some flights) enforced in domain.';

-- =============================================================================
-- 6. trip_documents — generating before file exists; one itinerary + one rates
-- =============================================================================

ALTER TABLE public.trip_documents
  ALTER COLUMN file_path DROP NOT NULL,
  ALTER COLUMN generated_at DROP NOT NULL,
  ALTER COLUMN source_updated_at DROP NOT NULL;

ALTER TABLE public.trip_documents
  ADD COLUMN IF NOT EXISTS narrative_json jsonb,
  ADD COLUMN IF NOT EXISTS source_fingerprint text,
  ADD COLUMN IF NOT EXISTS generated_by_id uuid
    REFERENCES public.team_members (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.trip_documents.file_path IS
  'Storage path in trip-documents bucket. Null while status=generating.';
COMMENT ON COLUMN public.trip_documents.generated_at IS
  'Last successful render. Null until first ready file.';
COMMENT ON COLUMN public.trip_documents.source_updated_at IS
  'Trip-input timestamp used at generate time — STALE compare.';
COMMENT ON COLUMN public.trip_documents.source_fingerprint IS
  'Hash of commercial / itinerary inputs at generate. Preferred STALE signal.';
COMMENT ON COLUMN public.trip_documents.narrative_json IS
  'Presentation overlay only. Never override sell/cost/dates/hotel.';
COMMENT ON COLUMN public.trip_documents.generated_by_id IS
  'Advisor who last generated this document.';

ALTER TABLE public.trip_documents
  DROP CONSTRAINT IF EXISTS trip_documents_file_path_not_blank,
  DROP CONSTRAINT IF EXISTS trip_documents_ready_has_file;

ALTER TABLE public.trip_documents
  ADD CONSTRAINT trip_documents_file_path_not_blank
    CHECK (file_path IS NULL OR length(trim(file_path)) > 0),
  ADD CONSTRAINT trip_documents_ready_has_file
    CHECK (
      status <> 'ready'
      OR (file_path IS NOT NULL AND length(trim(file_path)) > 0)
    );

DROP INDEX IF EXISTS public.trip_documents_trip_type_idx;

CREATE UNIQUE INDEX IF NOT EXISTS trip_documents_trip_type_uidx
  ON public.trip_documents (trip_id, type);

DROP TRIGGER IF EXISTS trip_documents_set_updated_at ON public.trip_documents;
CREATE TRIGGER trip_documents_set_updated_at
  BEFORE UPDATE ON public.trip_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 7. trip_chat_messages — widget-only rows, stream incomplete, idempotent send
-- =============================================================================

ALTER TABLE public.trip_chat_messages
  ADD COLUMN IF NOT EXISTS incomplete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_request_id text;

COMMENT ON COLUMN public.trip_chat_messages.incomplete IS
  'True if generation was stopped / dropped. v1 prefers discard; column is for later persist.';
COMMENT ON COLUMN public.trip_chat_messages.client_request_id IS
  'Advisor send idempotency. Same trip + key must not insert a second user row.';

ALTER TABLE public.trip_chat_messages
  DROP CONSTRAINT IF EXISTS trip_chat_messages_content_not_blank;

ALTER TABLE public.trip_chat_messages
  ADD CONSTRAINT trip_chat_messages_content_not_blank
    CHECK (
      length(trim(content)) > 0
      OR tool_calls IS NOT NULL
    );

CREATE UNIQUE INDEX IF NOT EXISTS trip_chat_messages_client_request_uidx
  ON public.trip_chat_messages (trip_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- =============================================================================
-- 8. trip_pending_confirms — one active high-stakes chip per advisor + trip
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trip_pending_confirms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES public.team_members (id) ON DELETE CASCADE,
  tool          text NOT NULL,
  args          jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'consumed', 'superseded', 'expired')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz,
  consumed_by_id uuid REFERENCES public.team_members (id) ON DELETE SET NULL,

  CONSTRAINT trip_pending_confirms_tool_not_blank
    CHECK (length(trim(tool)) > 0),
  CONSTRAINT trip_pending_confirms_args_object
    CHECK (jsonb_typeof(args) = 'object'),
  CONSTRAINT trip_pending_confirms_consumed_at_when_done
    CHECK (
      (status = 'pending' AND consumed_at IS NULL)
      OR (status <> 'pending')
    )
);

COMMENT ON TABLE public.trip_pending_confirms IS
  'Durable Yes/No for lock / PDF / publish / book / create. One pending row per trip + member.';
COMMENT ON COLUMN public.trip_pending_confirms.tool IS
  'Allow-listed agent tool name (e.g. lock_pricing, generate_documents).';

CREATE UNIQUE INDEX IF NOT EXISTS trip_pending_confirms_one_active_uidx
  ON public.trip_pending_confirms (trip_id, member_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS trip_pending_confirms_expires_idx
  ON public.trip_pending_confirms (expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS trip_pending_confirms_trip_idx
  ON public.trip_pending_confirms (trip_id, created_at DESC);

-- =============================================================================
-- 9. trip_attachments — quote / email / image uploads (paste pipeline)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trip_attachments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id           uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  chat_message_id   uuid REFERENCES public.trip_chat_messages (id) ON DELETE SET NULL,
  line_item_id      uuid REFERENCES public.trip_line_items (id) ON DELETE SET NULL,
  uploaded_by_id    uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  purpose           text NOT NULL DEFAULT 'other'
                      CHECK (purpose IN ('quote_paste', 'email', 'image', 'other')),
  file_path         text NOT NULL,
  file_name         text NOT NULL,
  mime_type         text,
  file_size_bytes   bigint,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trip_attachments_file_path_not_blank
    CHECK (length(trim(file_path)) > 0),
  CONSTRAINT trip_attachments_file_name_not_blank
    CHECK (length(trim(file_name)) > 0),
  CONSTRAINT trip_attachments_size_non_negative
    CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0)
);

COMMENT ON TABLE public.trip_attachments IS
  'Advisor uploads for paste/parse. Files live in trip-attachments bucket; this row is the relation.';
COMMENT ON COLUMN public.trip_attachments.line_item_id IS
  'Set after paste creates a pending_review line item.';
COMMENT ON COLUMN public.trip_attachments.chat_message_id IS
  'Composer chip / message that carried the file.';

CREATE INDEX IF NOT EXISTS trip_attachments_trip_idx
  ON public.trip_attachments (trip_id, created_at DESC);

CREATE INDEX IF NOT EXISTS trip_attachments_message_idx
  ON public.trip_attachments (chat_message_id)
  WHERE chat_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS trip_attachments_line_item_idx
  ON public.trip_attachments (line_item_id)
  WHERE line_item_id IS NOT NULL;

-- =============================================================================
-- 10. trip_undo_actions — scoped reverse of last safe mutation (select / sell)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trip_undo_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES public.team_members (id) ON DELETE CASCADE,
  action          text NOT NULL,
  before_payload  jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_payload   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  consumed_at     timestamptz,

  CONSTRAINT trip_undo_actions_action_not_blank
    CHECK (length(trim(action)) > 0)
);

COMMENT ON TABLE public.trip_undo_actions IS
  'Last safe undo (select / sell). Publish / book are reversed via unpublish / cancel, not this table.';

CREATE INDEX IF NOT EXISTS trip_undo_actions_open_idx
  ON public.trip_undo_actions (trip_id, member_id, created_at DESC)
  WHERE consumed_at IS NULL;

-- =============================================================================
-- 11. trip_idempotency_keys — double-tap / retry on mutate (create, book, chat)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trip_idempotency_keys (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id           uuid REFERENCES public.trips (id) ON DELETE CASCADE,
  member_id         uuid NOT NULL REFERENCES public.team_members (id) ON DELETE CASCADE,
  idempotency_key   text NOT NULL,
  request_hash      text,
  result            jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,

  CONSTRAINT trip_idempotency_keys_key_not_blank
    CHECK (length(trim(idempotency_key)) > 0)
);

COMMENT ON TABLE public.trip_idempotency_keys IS
  'Same trip + member + key returns the stored result. trip_id null only for create-trip before id exists.';
COMMENT ON COLUMN public.trip_idempotency_keys.request_hash IS
  'Optional body hash — same key + different payload should 409 in domain.';

CREATE UNIQUE INDEX IF NOT EXISTS trip_idempotency_keys_uidx
  ON public.trip_idempotency_keys (
    member_id,
    idempotency_key,
    (COALESCE(trip_id, '00000000-0000-0000-0000-000000000000'::uuid))
  );

-- Unique with nullable trip_id: expression index above. Also a simple lookup.
CREATE INDEX IF NOT EXISTS trip_idempotency_keys_lookup_idx
  ON public.trip_idempotency_keys (member_id, trip_id, idempotency_key);

CREATE INDEX IF NOT EXISTS trip_idempotency_keys_expires_idx
  ON public.trip_idempotency_keys (expires_at);

-- =============================================================================
-- 12. trip_attention_snoozes — portfolio dismiss without fixing (Trips module)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trip_attention_snoozes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES public.team_members (id) ON DELETE CASCADE,
  signal_key      text NOT NULL,
  snoozed_until   timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trip_attention_snoozes_signal_not_blank
    CHECK (length(trim(signal_key)) > 0),
  UNIQUE (trip_id, member_id, signal_key)
);

COMMENT ON TABLE public.trip_attention_snoozes IS
  'Optional Trips portfolio: hide a computed attention signal until snoozed_until.';

CREATE INDEX IF NOT EXISTS trip_attention_snoozes_until_idx
  ON public.trip_attention_snoozes (snoozed_until);

-- =============================================================================
-- 13. Child → trip recency triggers
-- =============================================================================

DROP TRIGGER IF EXISTS trip_clients_touch_trip ON public.trip_clients;
CREATE TRIGGER trip_clients_touch_trip
  AFTER INSERT OR UPDATE OR DELETE ON public.trip_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_parent_trip();

DROP TRIGGER IF EXISTS trip_legs_touch_trip ON public.trip_legs;
CREATE TRIGGER trip_legs_touch_trip
  AFTER INSERT OR UPDATE OR DELETE ON public.trip_legs
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_parent_trip();

DROP TRIGGER IF EXISTS trip_itinerary_days_touch_trip ON public.trip_itinerary_days;
CREATE TRIGGER trip_itinerary_days_touch_trip
  AFTER INSERT OR UPDATE OR DELETE ON public.trip_itinerary_days
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_parent_trip();

DROP TRIGGER IF EXISTS trip_line_items_touch_trip ON public.trip_line_items;
CREATE TRIGGER trip_line_items_touch_trip
  AFTER INSERT OR UPDATE OR DELETE ON public.trip_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_parent_trip();

DROP TRIGGER IF EXISTS trip_documents_touch_trip ON public.trip_documents;
CREATE TRIGGER trip_documents_touch_trip
  AFTER INSERT OR UPDATE OR DELETE ON public.trip_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_parent_trip();

DROP TRIGGER IF EXISTS trip_chat_messages_touch_trip ON public.trip_chat_messages;
CREATE TRIGGER trip_chat_messages_touch_trip
  AFTER INSERT OR UPDATE OR DELETE ON public.trip_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_parent_trip();

DROP TRIGGER IF EXISTS trip_chat_messages_sync_preview ON public.trip_chat_messages;
CREATE TRIGGER trip_chat_messages_sync_preview
  AFTER INSERT ON public.trip_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_trip_studio_chat_preview();

-- =============================================================================
-- 14. Storage — advisor quote uploads (PDFs stay in trip-documents)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-attachments',
  'trip-attachments',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'message/rfc822',
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================================================
-- 15. Settings seed — PDF branding consumed at generate (Settings UI later)
-- =============================================================================

INSERT INTO public.company_settings (key, value)
VALUES (
  'pdf_branding',
  '{
    "company_display_name": "PureLuxe",
    "logo_path": null,
    "logo_dark_path": null,
    "colors": {
      "primary": "#1a4d3e",
      "ink": "#141414",
      "paper": "#f4f1ea"
    },
    "font_display": "Cormorant Garamond",
    "font_body": "DM Sans",
    "letterhead": null,
    "footer_text": null
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 16. RLS + service_role grants (Studio APIs use service_role; no client policies)
-- =============================================================================

ALTER TABLE public.trip_pending_confirms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_undo_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_attention_snoozes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_pending_confirms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_attachments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_undo_actions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_idempotency_keys TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_attention_snoozes TO service_role;
