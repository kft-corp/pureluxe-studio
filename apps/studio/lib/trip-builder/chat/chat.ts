import {
  TRIP_PROMPT_V2_VERSION,
  createTurnMeter,
  tripThreadId,
  type AgentPhase,
  type AgentStreamChunk,
  type TurnMeter,
} from "@pureluxe/ai";
import {
  findAssistantReplyAfter,
  findTripChatMessageByClientRequestId,
  insertTripChatMessage,
  listTripChatMessagesPage,
  updateTripChatMessage,
  type AgentVersion,
  type TripChatKind,
  type TripChatMessage,
} from "@pureluxe/db";
import {
  AppError,
  type TripBuilderChatLinesInput,
  type TripBuilderChatListQuery,
  type TripBuilderChatSendInput,
  tripMessages,
} from "@pureluxe/shared";

import { requireAssignedTrip } from "../access/require-assigned-trip";
import { holdTripRunLock, type TripRunLock } from "./agent-run-lock";
import { streamAgentV1Turn } from "./agent-v1-turn";
import { prefetchAgentV2, streamAgentV2Turn, type AgentV2Prefetch } from "./agent-v2-turn";
import { tripAgentVersionFor } from "./agent-version";
import { advisorRowFields } from "./chat-turn-request";
import { recordAgentTurn, type AgentTurnOutcome } from "./record-agent-turn";

/** Lean chat row for Studio APIs / UI (studio channel only). */
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  /** action = a button tap, shown as a small grey line. */
  kind: TripChatKind;
  content: string;
  incomplete: boolean;
  client_request_id: string | null;
  created_at: string;
};

export type ChatStreamEvent =
  | { type: "meta"; user: ChatMessage }
  | { type: "clients"; clients: { id: string; display_name: string }[] }
  | { type: "status"; phase: AgentPhase }
  /** What the agent is doing, e.g. "Searching clients…". */
  | { type: "progress"; label: string }
  | { type: "delta"; text: string }
  | { type: "done"; assistant: ChatMessage }
  | {
      type: "replay";
      user: ChatMessage;
      assistant: ChatMessage;
    }
  /** Another reply is still running on this trip. Nothing was saved; send again later. */
  | { type: "busy"; message: string }
  | { type: "error"; message: string };

function toChatMessage(row: TripChatMessage): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    kind: row.kind,
    content: row.content,
    incomplete: row.incomplete,
    client_request_id: row.client_request_id,
    created_at: row.created_at,
  };
}

/** Postgres unique_violation — wrapped inside AppError from dbQueryError. */
function isUniqueViolation(cause: unknown): boolean {
  let current: unknown = cause;
  for (let i = 0; i < 4 && current; i += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      (current as { code?: string }).code === "23505"
    ) {
      return true;
    }
    if (
      typeof current === "object" &&
      current !== null &&
      "cause" in current
    ) {
      current = (current as { cause?: unknown }).cause;
      continue;
    }
    break;
  }
  return false;
}

export type ChatMessagePage = {
  messages: ChatMessage[];
  hasMore: boolean;
};

const DEFAULT_CHAT_PAGE = 30;

/** Load a page of studio-channel messages for an assigned trip (recent first). */
export async function listChatMessages(
  tripId: string,
  actor: { memberId: string },
  query: TripBuilderChatListQuery = { limit: DEFAULT_CHAT_PAGE },
): Promise<ChatMessagePage> {
  await requireAssignedTrip(tripId, actor.memberId);
  const page = await listTripChatMessagesPage(tripId, "studio", {
    limit: query.limit ?? DEFAULT_CHAT_PAGE,
    before: query.before,
  });
  return {
    messages: page.messages.map(toChatMessage),
    hasMore: page.hasMore,
  };
}

type StreamTurn = {
  kind: "stream";
  user: ChatMessage;
  chunks: AsyncIterable<AgentStreamChunk>;
  complete: (fullText: string) => Promise<ChatMessage>;
  abandon: (partialText: string) => Promise<ChatMessage | null>;
  /** Stop the agent (the advisor left). */
  abort: () => void;
  /** Free the trip and save reply metrics. Call after the last event is sent; never throws. */
  finish: (outcome: AgentTurnOutcome) => Promise<void>;
};

type ReplayTurn = {
  kind: "replay";
  user: ChatMessage;
  assistant: ChatMessage;
};

type BusyTurn = {
  kind: "busy";
  message: string;
};

export type PreparedChatTurn = StreamTurn | ReplayTurn | BusyTurn;

/** The signed-in advisor. Permissions gate the history tools. */
type ChatActor = { memberId: string; permissions: readonly string[] };

/** Store chat lines on the trip. Does not call the agent. A chip tap is an action line. */
export async function saveTripChatLines(
  tripId: string,
  lines: TripBuilderChatLinesInput["lines"],
  actor: { memberId: string },
): Promise<ChatMessage[]> {
  await requireAssignedTrip(tripId, actor.memberId);
  const saved: ChatMessage[] = [];
  for (const line of lines) {
    const row = await insertTripChatMessage({
      trip_id: tripId,
      channel: "studio",
      role: line.role,
      kind: line.kind,
      content: line.content,
      payload: line.kind === "action" ? { action: line.action, via: "chip" } : null,
      team_member_id: actor.memberId,
    });
    saved.push(toChatMessage(row));
  }
  return saved;
}

/**
 * Persist (or reuse) the advisor turn, then prepare the agent stream.
 * Idempotent on client_request_id — completed turns replay; unfinished retries re-stream.
 * Agent v2 holds the trip's run lock; a second message while it runs gets a busy reply.
 */
export async function prepareChatTurn(
  tripId: string,
  input: TripBuilderChatSendInput,
  actor: ChatActor,
): Promise<PreparedChatTurn> {
  const meter = createTurnMeter();
  const version = tripAgentVersionFor(actor.memberId);
  if (input.kind === "resume" && version === "v1") {
    throw new AppError({
      userMessage: tripMessages.error.agentNoApproval,
      code: "trips.chat_no_pending_approval",
      status: 409,
    });
  }

  // Independent reads: the send-key lookup is only used once access is confirmed.
  const [, existing] = await Promise.all([
    requireAssignedTrip(tripId, actor.memberId),
    findTripChatMessageByClientRequestId(tripId, input.client_request_id),
  ]);
  meter.mark("access");
  const replay = existing ? await findReplay(tripId, existing) : null;
  if (replay) return replay;

  // The trip loads while the lock is taken and the message is saved.
  const prefetch = version === "v2" ? prefetchAgentV2(tripId, actor) : null;
  const lock = version === "v2" ? await holdTripRunLock(tripId) : null;
  if (version === "v2" && !lock) {
    return { kind: "busy", message: tripMessages.error.agentBusy };
  }
  meter.mark("lock");

  try {
    if (existing) {
      const draft = await findAssistantReplyAfter(tripId, "studio", existing.created_at);
      meter.mark("saved");
      return buildStreamTurn({
        tripId,
        userRow: existing,
        draftAssistant: draft?.incomplete ? draft : null,
        retry: true,
        actor,
        prefetch,
        lock,
        meter,
      });
    }
    const user = await insertAdvisorTurn(tripId, input, actor);
    meter.mark("saved");
    return buildStreamTurn({
      tripId,
      userRow: user.row,
      draftAssistant: null,
      retry: user.raced,
      actor,
      prefetch,
      lock,
      meter,
    });
  } catch (cause) {
    await lock?.release();
    throw cause;
  }
}

/** A finished reply for this send key, replayed instead of running the agent again. */
async function findReplay(tripId: string, existing: TripChatMessage): Promise<ReplayTurn | null> {
  if (existing.role !== "user") {
    throw new AppError({
      userMessage: tripMessages.error.chatSendFailed,
      code: "trips.chat_idempotency_conflict",
      status: 409,
    });
  }

  const assistant = await findAssistantReplyAfter(tripId, "studio", existing.created_at);
  if (!assistant || assistant.incomplete || !assistant.content.trim()) return null;
  return { kind: "replay", user: toChatMessage(existing), assistant: toChatMessage(assistant) };
}

/** Insert the advisor row. A concurrent send with the same key reuses the first row. */
async function insertAdvisorTurn(
  tripId: string,
  input: TripBuilderChatSendInput,
  actor: ChatActor,
): Promise<{ row: TripChatMessage; raced: boolean }> {
  try {
    const row = await insertTripChatMessage({
      trip_id: tripId,
      channel: "studio",
      role: "user",
      ...advisorRowFields(input),
      team_member_id: actor.memberId,
      client_request_id: input.client_request_id,
    });
    return { row, raced: false };
  } catch (cause) {
    if (!isUniqueViolation(cause)) throw cause;
    const raced = await findTripChatMessageByClientRequestId(tripId, input.client_request_id);
    if (!raced) throw cause;
    return { row: raced, raced: true };
  }
}

function buildStreamTurn(input: {
  tripId: string;
  userRow: TripChatMessage;
  draftAssistant: TripChatMessage | null;
  retry: boolean;
  actor: ChatActor;
  /** Set for agent v2: its handlers and the trip facts already loading. Null runs v1. */
  prefetch: AgentV2Prefetch | null;
  lock: TripRunLock | null;
  /** Started with the request, so timings include access, lock and saving. */
  meter: TurnMeter;
}): StreamTurn {
  const { tripId, userRow, draftAssistant, actor, prefetch, lock, meter } = input;
  const version: AgentVersion = prefetch ? "v2" : "v1";
  const controller = new AbortController();
  const traceId = lock?.runId ?? null;

  const chunks = prefetch
    ? streamAgentV2Turn({
        tripId,
        userRow,
        prefetch,
        meter,
        retry: input.retry,
        signal: controller.signal,
      })
    : streamAgentV1Turn({ tripId, userRow, message: userRow.content, actor, meter });

  async function saveAssistant(content: string, incomplete: boolean): Promise<ChatMessage> {
    if (draftAssistant) {
      const row = await updateTripChatMessage(draftAssistant.id, {
        content,
        incomplete,
        trace_id: traceId,
      });
      return toChatMessage(row);
    }
    const row = await insertTripChatMessage({
      trip_id: tripId,
      channel: "studio",
      role: "assistant",
      content,
      incomplete,
      trace_id: traceId,
    });
    return toChatMessage(row);
  }

  return {
    kind: "stream",
    user: toChatMessage(userRow),
    chunks,
    complete: (fullText) =>
      saveAssistant(fullText.trim() || "I couldn't generate a reply. Please try again.", false),
    abandon: async (partialText) => {
      const content = partialText.trim() || draftAssistant?.content || "";
      return content ? saveAssistant(content, true) : null;
    },
    abort: () => controller.abort(),
    finish: async (outcome) => {
      await lock?.release();
      await recordAgentTurn({
        meter,
        outcome,
        channel: "trip",
        tripId,
        memberId: actor.memberId,
        clientRequestId: userRow.client_request_id,
        agentVersion: version,
        threadId: version === "v2" ? tripThreadId(tripId) : null,
        promptVersion: version === "v2" ? TRIP_PROMPT_V2_VERSION : null,
      });
    },
  };
}
