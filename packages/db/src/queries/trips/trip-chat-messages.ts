import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  TripChatChannel,
  TripChatKind,
  TripChatMessage,
  TripChatMode,
  TripChatRole,
} from "../../schema";

const MESSAGE_COLUMNS = [
  "id",
  "trip_id",
  "channel",
  "team_member_id",
  "role",
  "kind",
  "content",
  "payload",
  "tool_calls",
  "mode",
  "is_demo",
  "incomplete",
  "client_request_id",
  "trace_id",
  "created_at",
].join(", ");

export type ListTripChatMessagesPageOptions = {
  /** Page size (1–100). Default 30. */
  limit?: number;
  /** Exclusive upper bound — load rows older than this ISO timestamp. */
  before?: string;
};

export type TripChatMessagePage = {
  /** Oldest → newest within this page. */
  messages: TripChatMessage[];
  hasMore: boolean;
};

const DEFAULT_PAGE_LIMIT = 30;
const MAX_PAGE_LIMIT = 100;

/**
 * Paginated chat messages (newest page first).
 * Returns the page in oldest → newest order for UI rendering.
 */
export async function listTripChatMessagesPage(
  tripId: string,
  channel: TripChatChannel = "studio",
  options: ListTripChatMessagesPageOptions = {},
): Promise<TripChatMessagePage> {
  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_PAGE_LIMIT, 1),
    MAX_PAGE_LIMIT,
  );
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() => {
    let query = supabase
      .from("trip_chat_messages")
      .select(MESSAGE_COLUMNS)
      .eq("trip_id", tripId)
      .eq("channel", channel)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (options.before) {
      query = query.lt("created_at", options.before);
    }

    return query;
  });

  if (error) {
    throw dbQueryError(error);
  }

  const rows = (data as TripChatMessage[] | null) ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  page.reverse();
  return { messages: page, hasMore };
}

/**
 * Recent chat messages for a trip + channel (oldest first).
 * Caps at `limit` (default 40) — use listTripChatMessagesPage for UI paging.
 */
export async function listTripChatMessages(
  tripId: string,
  channel: TripChatChannel = "studio",
  limit = 40,
): Promise<TripChatMessage[]> {
  const page = await listTripChatMessagesPage(tripId, channel, { limit });
  return page.messages;
}

/** Find a message by idempotent client send key (studio channel). */
export async function findTripChatMessageByClientRequestId(
  tripId: string,
  clientRequestId: string,
): Promise<TripChatMessage | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_chat_messages")
      .select(MESSAGE_COLUMNS)
      .eq("trip_id", tripId)
      .eq("client_request_id", clientRequestId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripChatMessage | null;
}

/**
 * First assistant reply after a user message (same trip + channel).
 * Used for idempotent replay after a completed turn.
 */
export async function findAssistantReplyAfter(
  tripId: string,
  channel: TripChatChannel,
  afterCreatedAt: string,
): Promise<TripChatMessage | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_chat_messages")
      .select(MESSAGE_COLUMNS)
      .eq("trip_id", tripId)
      .eq("channel", channel)
      .eq("role", "assistant")
      .gt("created_at", afterCreatedAt)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripChatMessage | null;
}

export type InsertTripChatMessageInput = {
  trip_id: string;
  channel: TripChatChannel;
  role: TripChatRole;
  /** Defaults to text. A button tap is an action row with its { action, args } payload. */
  kind?: TripChatKind;
  content: string;
  payload?: Record<string, unknown> | null;
  team_member_id?: string | null;
  tool_calls?: unknown;
  mode?: TripChatMode | null;
  is_demo?: boolean;
  incomplete?: boolean;
  client_request_id?: string | null;
  trace_id?: string | null;
};

/** Insert one chat message row. */
export async function insertTripChatMessage(
  input: InsertTripChatMessageInput,
): Promise<TripChatMessage> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_chat_messages")
      .insert({
        trip_id: input.trip_id,
        channel: input.channel,
        role: input.role,
        kind: input.kind ?? "text",
        content: input.content,
        payload: input.payload ?? null,
        team_member_id: input.team_member_id ?? null,
        tool_calls: input.tool_calls ?? null,
        mode: input.mode ?? null,
        is_demo: input.is_demo ?? false,
        incomplete: input.incomplete ?? false,
        client_request_id: input.client_request_id ?? null,
        trace_id: input.trace_id ?? null,
      })
      .select(MESSAGE_COLUMNS)
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as unknown as TripChatMessage;
}

/** Update assistant content / incomplete flag after a stream finishes. */
export async function updateTripChatMessage(
  messageId: string,
  patch: {
    content?: string;
    incomplete?: boolean;
    payload?: Record<string, unknown> | null;
    trace_id?: string | null;
  },
): Promise<TripChatMessage> {
  const supabase = getServiceClient();
  const next: Record<string, unknown> = {};
  if (patch.content !== undefined) next.content = patch.content;
  if (patch.incomplete !== undefined) next.incomplete = patch.incomplete;
  if (patch.payload !== undefined) next.payload = patch.payload;
  if (patch.trace_id !== undefined) next.trace_id = patch.trace_id;

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_chat_messages")
      .update(next)
      .eq("id", messageId)
      .select(MESSAGE_COLUMNS)
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as unknown as TripChatMessage;
}
