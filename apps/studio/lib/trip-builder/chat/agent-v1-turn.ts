import {
  streamTripTurn,
  type AgentStreamChunk,
  type ChatHistoryMessage,
  type TurnMeter,
} from "@pureluxe/ai";
import type { TripChatMessage } from "@pureluxe/db";

import { createTripTools, toTripFacts } from "@/lib/ai";
import { questionUsesRatePack } from "@/lib/rates/rate-search-pack";
import { readRateSearchPack } from "@/lib/rates/rate-search-store";

import {
  isClientQuestion,
  isFollowUpFragment,
  isPlaceQuestion,
  isTripQuestion,
  mightNamePlace,
} from "../intents";
import { answerAtlasStay } from "../stays/atlas-stay";
import { getTripDetail } from "../trip/get-trip-detail";
import { loadChatHistory } from "./chat-history";
import { getTripDossier, questionNeedsPlaceLookup } from "./trip-dossier";

const HISTORY_ROWS = 40;

type ChatActor = { memberId: string; permissions: readonly string[] };

/** Recent user lines, so "what is the visa?" still refers to the name they just gave. */
function earlierUserText(history: ChatHistoryMessage[]): string {
  return history
    .filter((row) => row.role === "user")
    .slice(-3)
    .map((row) => row.content.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Agent v1: text patterns decide which notes to attach, then Claude answers with
 * read-only tools. Removed in Stage 4 of the redesign.
 */
export async function* streamAgentV1Turn(input: {
  tripId: string;
  userRow: TripChatMessage;
  /** What the advisor said. A tap's label for button rows. */
  message: string;
  actor: ChatActor;
  meter: TurnMeter;
}): AsyncGenerator<AgentStreamChunk, void, unknown> {
  const { tripId, userRow, message, actor } = input;
  const detail = await getTripDetail(tripId, actor);
  const [dossier, history, ratePack] = await Promise.all([
    getTripDossier(tripId, actor, detail),
    loadChatHistory(tripId, { limit: HISTORY_ROWS, excludeId: userRow.id }),
    readRateSearchPack(tripId),
  ]);
  const stays = detail.stays.length > 0 ? detail.stays : detail.stay ? [detail.stay] : [];
  const cityHint =
    stays.find((stay) => stay.city.trim() && !stay.property_name?.trim())?.city ??
    stays.find((stay) => stay.city.trim())?.city ??
    null;
  const placeQuestion = isPlaceQuestion(message);
  const followUp = isFollowUpFragment(message);
  const editingTrip =
    !placeQuestion &&
    /\b(?:change|move|update|edit|set|shift|correct|remove|add)\b/i.test(message) &&
    /\b(?:dates?|start|end|stay|hotel|city|check[\s-]?in|check[\s-]?out|rooms?)\b/i.test(message);
  const lookupPlace =
    !editingTrip &&
    !isClientQuestion(message) &&
    (placeQuestion ||
      mightNamePlace(message) ||
      followUp ||
      questionNeedsPlaceLookup(dossier.placeNames) ||
      (Boolean(cityHint) && isTripQuestion(message)));
  const namedOnly =
    mightNamePlace(message) &&
    !/\d/.test(message) &&
    !/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|start|end)\b/i.test(message);
  const atlas = lookupPlace
    ? await answerAtlasStay({
        question: message,
        cityHint,
        earlier: earlierUserText(history),
      })
    : { matched: false, answer: "", hotels: [], place: { city: null, country: null } };
  const atlasNotes = atlas.matched
    ? atlas.answer
    : namedOnly
      ? "No stored notes matched this name. Say PureLuxe doesn't have that. Do not say file. Do not describe the place or hotel from general knowledge."
      : null;
  input.meter.mark("trip");

  yield* streamTripTurn({
    tripId,
    memberId: actor.memberId,
    message,
    trip: toTripFacts(detail, dossier.readiness),
    history,
    clientRequestId: userRow.client_request_id,
    atlasNotes,
    dossierNotes: dossier.notes,
    ratePackNotes:
      !isClientQuestion(message) &&
      !editingTrip &&
      (questionUsesRatePack(message) || placeQuestion || followUp)
        ? ratePack
        : null,
    tools: createTripTools({
      tripId,
      memberId: actor.memberId,
      permissions: actor.permissions,
      readiness: dossier.readiness,
    }),
    meter: input.meter,
  });
}
