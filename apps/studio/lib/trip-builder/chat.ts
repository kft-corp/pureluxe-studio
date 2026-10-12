import {
  streamTripTurn,
  type AgentPhase,
  type AgentStreamChunk,
  type ChatHistoryMessage,
} from "@pureluxe/ai";
import {
  findAssistantReplyAfter,
  findTripChatMessageByClientRequestId,
  insertTripChatMessage,
  listTripChatMessagesPage,
  updateTripChatMessage,
  type TripChatMessage,
} from "@pureluxe/db";
import {
  AppError,
  type TripBuilderChatLinesInput,
  type TripBuilderChatListQuery,
  type TripBuilderChatSendInput,
  tripMessages,
} from "@pureluxe/shared";

import { createTripTools, toTripFacts } from "@/lib/ai";

import { questionUsesRatePack, readRateSearchPack } from "@/lib/rates/rate-search-pack";

import { answerAtlasStay } from "./atlas-stay";
import { getTripDetail } from "./get-trip-detail";
import {
  isClientQuestion,
  isFollowUpFragment,
  isPlaceQuestion,
  isTripQuestion,
  mightNamePlace,
} from "./message-intent";
import { getTripDossier, questionNeedsPlaceLookup } from "./trip-dossier";
import { requireAssignedTrip } from "./require-assigned-trip";

/** Lean chat row for Studio APIs / UI (studio channel only). */
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  incomplete: boolean;
  client_request_id: string | null;
  created_at: string;
};

export type ChatStreamEvent =
  | { type: "meta"; user: ChatMessage }
  | { type: "clients"; clients: { id: string; display_name: string }[] }
  | { type: "status"; phase: AgentPhase }
  | { type: "delta"; text: string }
  | { type: "done"; assistant: ChatMessage }
  | {
      type: "replay";
      user: ChatMessage;
      assistant: ChatMessage;
    }
  | { type: "error"; message: string };

function toChatMessage(row: TripChatMessage): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    incomplete: row.incomplete,
    client_request_id: row.client_request_id,
    created_at: row.created_at,
  };
}

/** Recent user lines, so "what is the visa?" still refers to the name they just gave. */
function earlierUserText(history: ChatHistoryMessage[]): string {
  return history
    .filter((row) => row.role === "user")
    .slice(-3)
    .map((row) => row.content.trim())
    .filter(Boolean)
    .join("\n");
}

function toHistory(
  rows: TripChatMessage[],
  excludeUserId: string,
): ChatHistoryMessage[] {
  return rows
    .filter(
      (row) =>
        row.id !== excludeUserId &&
        !(row.role === "assistant" && row.incomplete) &&
        row.content.trim().length > 0,
    )
    .map((row) => ({
      role: row.role,
      content: row.content,
    }));
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
};

type ReplayTurn = {
  kind: "replay";
  user: ChatMessage;
  assistant: ChatMessage;
};

export type PreparedChatTurn = StreamTurn | ReplayTurn;

/** Store chat lines on the trip. Does not call the agent. */
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
      content: line.content,
      team_member_id: actor.memberId,
    });
    saved.push(toChatMessage(row));
  }
  return saved;
}

/**
 * Persist (or reuse) the user message, then prepare a Claude stream.
 * Idempotent on client_request_id — completed turns replay; incomplete retries re-stream.
 */
export async function prepareChatTurn(
  tripId: string,
  input: TripBuilderChatSendInput,
  actor: { memberId: string },
): Promise<PreparedChatTurn> {
  await requireAssignedTrip(tripId, actor.memberId);

  const existing = await findTripChatMessageByClientRequestId(
    tripId,
    input.client_request_id,
  );

  if (existing) {
    return resumeFromExistingUser(tripId, existing, actor);
  }

  try {
    const user = await insertTripChatMessage({
      trip_id: tripId,
      channel: "studio",
      role: "user",
      content: input.message,
      team_member_id: actor.memberId,
      client_request_id: input.client_request_id,
    });
    return buildStreamTurn(tripId, user, actor, null);
  } catch (cause) {
    if (!isUniqueViolation(cause)) throw cause;

    const raced = await findTripChatMessageByClientRequestId(
      tripId,
      input.client_request_id,
    );
    if (!raced) throw cause;
    return resumeFromExistingUser(tripId, raced, actor);
  }
}

async function resumeFromExistingUser(
  tripId: string,
  existing: TripChatMessage,
  actor: { memberId: string },
): Promise<PreparedChatTurn> {
  if (existing.role !== "user") {
    throw new AppError({
      userMessage: tripMessages.error.chatSendFailed,
      code: "trips.chat_idempotency_conflict",
      status: 409,
    });
  }

  const assistant = await findAssistantReplyAfter(
    tripId,
    "studio",
    existing.created_at,
  );

  if (assistant && !assistant.incomplete && assistant.content.trim()) {
    return {
      kind: "replay",
      user: toChatMessage(existing),
      assistant: toChatMessage(assistant),
    };
  }

  // Re-stream; reuse incomplete assistant row when present so we don't duplicate.
  return buildStreamTurn(
    tripId,
    existing,
    actor,
    assistant?.incomplete ? assistant : null,
  );
}

async function buildStreamTurn(
  tripId: string,
  userRow: TripChatMessage,
  actor: { memberId: string },
  draftAssistant: TripChatMessage | null,
): Promise<StreamTurn> {
  const detail = await getTripDetail(tripId, actor);
  const dossier = await getTripDossier(tripId, actor, detail);
  const { messages: rows } = await listTripChatMessagesPage(tripId, "studio", {
    limit: 40,
  });
  const history = toHistory(rows, userRow.id);
  const stays = detail.stays.length > 0 ? detail.stays : detail.stay ? [detail.stay] : [];
  const cityHint =
    stays.find((stay) => stay.city.trim() && !stay.property_name?.trim())?.city ??
    stays.find((stay) => stay.city.trim())?.city ??
    null;
  const ratePack = readRateSearchPack(tripId);
  const placeQuestion = isPlaceQuestion(userRow.content);
  const followUp = isFollowUpFragment(userRow.content);
  const editingTrip =
    !placeQuestion &&
    /\b(?:change|move|update|edit|set|shift|correct|remove|add)\b/i.test(userRow.content) &&
    /\b(?:dates?|start|end|stay|hotel|city|check[\s-]?in|check[\s-]?out|rooms?)\b/i.test(
      userRow.content,
    );
  const lookupPlace =
    !editingTrip &&
    !isClientQuestion(userRow.content) &&
    (placeQuestion ||
      mightNamePlace(userRow.content) ||
      followUp ||
      questionNeedsPlaceLookup(dossier.placeNames) ||
      (Boolean(cityHint) && isTripQuestion(userRow.content)));
  const namedOnly =
    mightNamePlace(userRow.content) &&
    !/\d/.test(userRow.content) &&
    !/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|start|end)\b/i.test(
      userRow.content,
    );
  const atlas = lookupPlace
    ? await answerAtlasStay({
        question: userRow.content,
        cityHint,
        earlier: earlierUserText(history),
      })
    : { matched: false, answer: "", hotels: [], place: { city: null, country: null } };
  const atlasNotes = atlas.matched
    ? atlas.answer
    : namedOnly
      ? "No stored notes matched this name. Say PureLuxe doesn't have that. Do not say file. Do not describe the place or hotel from general knowledge."
      : null;

  async function* chunks(): AsyncGenerator<AgentStreamChunk> {
    yield* streamTripTurn({
      tripId,
      memberId: actor.memberId,
      message: userRow.content,
      trip: toTripFacts(detail),
      history,
      clientRequestId: userRow.client_request_id,
      atlasNotes,
      dossierNotes: dossier.notes,
      ratePackNotes:
        !isClientQuestion(userRow.content) &&
        !editingTrip &&
        (questionUsesRatePack(userRow.content) || placeQuestion || followUp)
          ? ratePack
          : null,
      tools: createTripTools({
        tripId,
        memberId: actor.memberId,
      }),
    });
  }

  return {
    kind: "stream",
    user: toChatMessage(userRow),
    chunks: chunks(),
    complete: async (fullText) => {
      const content =
        fullText.trim() || "I couldn't generate a reply. Please try again.";

      if (draftAssistant) {
        const assistant = await updateTripChatMessage(draftAssistant.id, {
          content,
          incomplete: false,
        });
        return toChatMessage(assistant);
      }

      const assistant = await insertTripChatMessage({
        trip_id: tripId,
        channel: "studio",
        role: "assistant",
        content,
        incomplete: false,
      });
      return toChatMessage(assistant);
    },
    abandon: async (partialText) => {
      const content = partialText.trim();
      if (!content && !draftAssistant) return null;

      if (draftAssistant) {
        const assistant = await updateTripChatMessage(draftAssistant.id, {
          content: content || draftAssistant.content,
          incomplete: true,
        });
        return toChatMessage(assistant);
      }

      if (!content) return null;
      const assistant = await insertTripChatMessage({
        trip_id: tripId,
        channel: "studio",
        role: "assistant",
        content,
        incomplete: true,
      });
      return toChatMessage(assistant);
    },
  };
}
