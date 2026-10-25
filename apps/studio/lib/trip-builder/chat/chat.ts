import {
  TRIP_PROMPT_V2_VERSION,
  createTurnMeter,
  tripThreadId,
  type AgentApproval,
  type AgentChoice,
  type AgentPhase,
  type AgentStreamChunk,
  type ApprovalDecision,
  type RateCompareCard,
  type TripFacts,
  type TurnMeter,
} from "@pureluxe/ai";
import {
  closeTripApproval,
  findAssistantReplyAfter,
  findOpenTripApproval,
  findTripChatMessageByClientRequestId,
  insertTripApproval,
  insertTripChatMessage,
  listTripChatMessagesPage,
  updateTripChatMessage,
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
import { prefetchAgentTurn, streamAgentTurn, type AgentPrefetch } from "./agent-turn";
import { advisorRowFields, agentRequestFromRow } from "./chat-turn-request";
import { logChatFailure } from "./log-chat-error";
import { recordAgentTurn, type AgentTurnOutcome } from "./record-agent-turn";

/** Cards under an agent reply. */
export type ChatReplyCards = {
  /** The reply changed the trip and its latest change can be undone. */
  undo?: true;
  /** Buttons that run a tool directly, e.g. one per matching client. */
  choices?: AgentChoice[];
  /** Multi-hotel rate comparison (Stage 3c). */
  rateCompare?: RateCompareCard;
  /** Multi-city date split proposal (Stage 4). */
  legSplit?: import("@pureluxe/ai/chat-stream").LegSplitCard;
  /** What Confirm will do. The agent is waiting for Confirm or Cancel. */
  approval?: string;
};

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
  /** Agent replies only. */
  cards?: ChatReplyCards;
};

export type ChatStreamEvent =
  | { type: "meta"; user: ChatMessage }
  | { type: "status"; phase: AgentPhase }
  /** What the agent is doing, e.g. "Finding the client…". */
  | { type: "progress"; label: string }
  | { type: "delta"; text: string }
  /** The agent changed the trip; reload it. */
  | { type: "changed"; summary: string }
  /** Home chat: open this trip (just created, or chosen). Sent after `done`. */
  | { type: "opened"; tripId: string }
  /** Open the options quote PDF (short-lived signed URL; not stored on the message). */
  | { type: "quote_preview"; url: string }
  | { type: "done"; assistant: ChatMessage }
  | {
      type: "replay";
      user: ChatMessage;
      assistant: ChatMessage;
    }
  /** Another reply is still running on this trip. Nothing was saved; send again later. */
  | { type: "busy"; message: string }
  /** Stream failed. Optional assistant is the saved interrupted reply (always preferred). */
  | { type: "error"; message: string; assistant?: ChatMessage };

/** What a finished reply carries besides its text, gathered from the agent's chunks. */
export type ReplyOutcome = {
  undo: boolean;
  choices: AgentChoice[];
  rateCompare: RateCompareCard | null;
  legSplit: import("@pureluxe/ai/chat-stream").LegSplitCard | null;
  approval: AgentApproval | null;
};

function compactCards(cards: ChatReplyCards): ChatReplyCards | null {
  const compact: ChatReplyCards = {
    ...(cards.undo ? { undo: true as const } : {}),
    ...(cards.choices?.length ? { choices: cards.choices } : {}),
    ...(cards.rateCompare ? { rateCompare: cards.rateCompare } : {}),
    ...(cards.legSplit ? { legSplit: cards.legSplit } : {}),
    ...(cards.approval ? { approval: cards.approval } : {}),
  };
  return Object.keys(compact).length > 0 ? compact : null;
}

function toChatMessage(row: TripChatMessage): ChatMessage {
  const cards = row.role === "assistant" && row.payload ? compactCards(row.payload) : null;
  return {
    id: row.id,
    role: row.role,
    kind: row.kind,
    content: row.content,
    incomplete: row.incomplete,
    client_request_id: row.client_request_id,
    created_at: row.created_at,
    ...(cards ? { cards } : {}),
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
  complete: (fullText: string, outcome: ReplyOutcome) => Promise<ChatMessage>;
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
 * The turn holds the trip's run lock; a second message while it runs gets a busy reply.
 */
export async function prepareChatTurn(
  tripId: string,
  input: TripBuilderChatSendInput,
  actor: ChatActor,
): Promise<PreparedChatTurn> {
  const meter = createTurnMeter();

  // Everything starts at once; nothing is used before access is confirmed. The trip
  // load checks access itself, and the lock is given back if this turn doesn't run.
  const lockAttempt = holdTripRunLock(tripId);
  const giveBackLock = () => lockAttempt.then((held) => held?.release(), () => undefined);
  const prefetch = prefetchAgentTurn(tripId, actor);
  let existing: TripChatMessage | null;
  let replay: ReplayTurn | null;
  try {
    [, existing] = await Promise.all([
      requireAssignedTrip(tripId, actor.memberId),
      findTripChatMessageByClientRequestId(tripId, input.client_request_id),
    ]);
    meter.mark("access");
    replay = existing ? await findReplay(tripId, existing) : null;
  } catch (cause) {
    await giveBackLock();
    logChatFailure("prepare turn access failed", { tripId, cause });
    throw cause;
  }
  if (replay) {
    await giveBackLock();
    return replay;
  }

  const lock = await lockAttempt;
  if (!lock) {
    console.info("[trip-chat] prepare turn busy", { tripId });
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
    const decision =
      input.kind === "resume"
        ? await settleApproval(tripId, input.decision, actor, prefetch.trip)
        : undefined;
    const user = await insertAdvisorTurn(tripId, input, actor, decision);
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
    await lock.release();
    logChatFailure("prepare turn save failed", { tripId, cause });
    throw cause;
  }
}

/**
 * Close the approval card this Confirm or Cancel answers. A card that timed out, or
 * a trip the agent changed since it was shown, resumes as `expired`.
 */
async function settleApproval(
  tripId: string,
  decision: ApprovalDecision,
  actor: ChatActor,
  trip: Promise<TripFacts>,
): Promise<ApprovalDecision> {
  const [open, facts] = await Promise.all([findOpenTripApproval(tripId, actor.memberId), trip]);
  if (!open) {
    throw new AppError({
      userMessage: tripMessages.error.agentNoApproval,
      code: "trips.chat_no_pending_approval",
      status: 409,
    });
  }
  const stale =
    Date.parse(open.expires_at) <= Date.now() || open.trip_version !== (facts.version ?? null);
  await closeTripApproval({
    id: open.id,
    status: stale ? "expired" : "consumed",
    memberId: actor.memberId,
  });
  return stale ? "expired" : decision;
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
  decision: ApprovalDecision | undefined,
): Promise<{ row: TripChatMessage; raced: boolean }> {
  try {
    const row = await insertTripChatMessage({
      trip_id: tripId,
      channel: "studio",
      role: "user",
      ...advisorRowFields(input, decision),
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
  /** Handlers and the trip facts already loading. */
  prefetch: AgentPrefetch;
  lock: TripRunLock;
  /** Started with the request, so timings include access, lock and saving. */
  meter: TurnMeter;
}): StreamTurn {
  const { tripId, userRow, draftAssistant, actor, prefetch, lock, meter } = input;
  const controller = new AbortController();
  const traceId = lock.runId;
  const threadId = tripThreadId(tripId);

  const chunks = streamAgentTurn({
    tripId,
    request: agentRequestFromRow(userRow),
    userRowId: userRow.id,
    prefetch,
    meter,
    retry: input.retry,
    signal: controller.signal,
  });

  async function saveAssistant(
    content: string,
    incomplete: boolean,
    cards: ChatReplyCards | null = null,
  ): Promise<ChatMessage> {
    if (draftAssistant) {
      const row = await updateTripChatMessage(draftAssistant.id, {
        content,
        incomplete,
        payload: cards,
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
      payload: cards,
      trace_id: traceId,
    });
    return toChatMessage(row);
  }

  return {
    kind: "stream",
    user: toChatMessage(userRow),
    chunks,
    complete: async (fullText, outcome) => {
      if (outcome.approval) {
        await insertTripApproval({
          tripId,
          memberId: actor.memberId,
          tool: outcome.approval.tool,
          args: outcome.approval.args,
          summary: outcome.approval.summary,
          threadId,
          tripVersion: outcome.approval.tripVersion,
        });
      }
      const content =
        fullText.trim() ||
        outcome.approval?.summary ||
        "I couldn't generate a reply. Please try again.";
      const cards = compactCards({
        undo: outcome.undo || undefined,
        choices: outcome.choices,
        rateCompare: outcome.rateCompare ?? undefined,
        legSplit: outcome.legSplit ?? undefined,
        approval: outcome.approval?.summary,
      });
      return saveAssistant(content, false, cards);
    },
    abandon: async (partialText) => {
      const content =
        partialText.trim() ||
        draftAssistant?.content?.trim() ||
        tripMessages.error.replyInterrupted;
      return saveAssistant(content, true);
    },
    abort: () => controller.abort(),
    finish: async (outcome) => {
      await lock.release();
      await recordAgentTurn({
        meter,
        outcome,
        channel: "trip",
        tripId,
        memberId: actor.memberId,
        clientRequestId: userRow.client_request_id,
        threadId,
        promptVersion: TRIP_PROMPT_V2_VERSION,
      });
    },
  };
}
