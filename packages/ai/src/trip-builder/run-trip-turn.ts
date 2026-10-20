import { buildTripContext, resolveTripStage } from "../context";
import { aiProviderFailedError } from "../errors";
import { buildSystemPrompt } from "../prompts";
import { streamClaudeMessage, textFromClaudeMessage } from "../providers";
import {
  TRIP_BUILDER_READ_TOOLS,
  claudeRoundUsage,
  streamAgentLoop,
  type AgentStreamChunk,
} from "../tools";
import type { TripBuilderStage, TripTurnInput } from "../types";

import { buildModelMessages } from "./build-model-messages";
import { buildChatMemory } from "./chat-memory";

function prepareTurn(input: TripTurnInput) {
  const stage = resolveTripStage(input.trip);
  const tripContext = buildTripContext(input.trip);
  const hasTools = Boolean(input.tools);
  const atlas = input.atlasNotes?.trim();
  const dossier = input.dossierNotes?.trim();
  const ratePack = input.ratePackNotes?.trim();
  const memory = buildChatMemory(input.trip, input.history);
  const system = [
    buildSystemPrompt({
      stage,
      tripContext,
      toolsEnabled: hasTools,
    }),
    dossier
      ? [
          "",
          "Trip pack. Private. This is everything PureLuxe has for this trip: client, documents, health, stays, hotel, contract, place notes, rates, quote, and booking.",
          "Answer only the part they asked. Do not recite this pack. Do not say cache, database, table, file, pack, or Atlas.",
          "If a place, hotel, or rate detail is not written here, or in the hotel rates when they are attached, say PureLuxe doesn't have that. Do not invent it.",
          "Passport numbers, medication, the emergency contact, and bank details are in this pack. Give them only when the advisor asks for that item.",
          "",
          dossier,
        ].join("\n")
      : "",
    ratePack
      ? [
          "",
          "Hotel rates for this turn. Private. These are the filtered rooms and hotel facts from the latest rate search for this trip.",
          "Answer only the part they asked. Do not recite every room or every rule.",
          "Do not say database, table, file, pack, or Atlas. Do not invent a price, a cancel rule, an offer, or a charge that is not written here.",
          "If these rates do not cover the question, say PureLuxe doesn't have that.",
          "Team cost is the advisor cost. Do not call it the client price. Bank payout is not in this pack.",
          "If they are choosing a room for the client, compare only the rooms in this pack. Name the room and the team cost, and say what is included and the cancellation when those are written here. Tell them to tap Add for the client on that card. Client chose this is for a room already saved, after the client has picked. Do not save a room. If a suggested client price is written here, you may repeat that figure. Do not calculate a different price. Percent questions are answered before you see them.",
          "",
          ratePack,
        ].join("\n")
      : "",
    memory
      ? [
          "",
          "Chat memory. Private. A few lines from this trip and from earlier messages.",
          "Trip facts win if they disagree. Use this when the new message is short, such as that one, the cheaper room, same dates, or and the visa.",
          "Do not recite this memory.",
          "",
          memory,
        ].join("\n")
      : "",
    atlas
      ? [
          "",
          "Place notes for this turn only. These are private.",
          "These notes are what PureLuxe has for the country, city, or hotel they named, even if they only gave the name.",
          "A short follow-up about visa, season, rooms, amenities, or the hotel still uses these notes.",
          "Answer in your own words, and only the part they asked. A broad question can be a short summary, not every line.",
          "Do not paste these notes. Do not say database, table, file, pack, or Atlas.",
          "Do not invent a hotel, visa rule, season, amenity, or price that is not written here.",
          "If these notes do not cover the question, say PureLuxe doesn't have that.",
          "If they asked which hotel to use and hotels are listed, they can tap Use or type select 1. Do not add that unless they are choosing a hotel.",
          "",
          atlas,
        ].join("\n")
      : "",
  ].join("\n");
  const messages = buildModelMessages(input.history, input.message);
  return { stage, system, messages, hasTools };
}

/** One trip chat turn — yields status + text chunks. */
export async function* streamTripTurn(
  input: TripTurnInput,
): AsyncGenerator<AgentStreamChunk, TripBuilderStage, unknown> {
  const { stage, system, messages, hasTools } = prepareTurn(input);

  if (hasTools && input.tools) {
    yield* streamAgentLoop({
      system,
      messages,
      handlers: input.tools,
      toolSchemas: TRIP_BUILDER_READ_TOOLS,
      meter: input.meter,
    });
    return stage;
  }

  yield { kind: "status", phase: "thinking" };
  const stopModel = input.meter?.startModelCall();
  try {
    const iterator = streamClaudeMessage({ system, messages });
    let firstDelta = true;
    let step = await iterator.next();
    while (!step.done) {
      if (firstDelta) {
        input.meter?.markText();
        yield { kind: "status", phase: "writing" };
        firstDelta = false;
      }
      yield { kind: "delta", text: step.value };
      step = await iterator.next();
    }
    input.meter?.addRound(claudeRoundUsage(step.value));
    if (!textFromClaudeMessage(step.value)) throw aiProviderFailedError();
    return stage;
  } finally {
    stopModel?.();
  }
}
