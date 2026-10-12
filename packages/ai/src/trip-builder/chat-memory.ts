import type { ChatHistoryMessage, TripFacts } from "../types";

import { MAX_MODEL_HISTORY } from "./build-model-messages";

const MAX_MEMORY_CHARS = 1400;
const MAX_EARLIER_LINES = 8;
const EARLIER_LINE_CHARS = 140;
const OPEN_QUESTION_CHARS = 180;

function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function oneLine(value: string, max: number): string {
  return clip(value.replace(/\s+/g, " ").trim(), max);
}

function names(values: Array<string | null | undefined>, empty: string): string {
  const kept = values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  return kept.length > 0 ? kept.join(", ") : empty;
}

/**
 * Short block for the next turn. Built from trip fields and user lines
 * that fall outside the raw history window. No extra model call.
 */
export function buildChatMemory(
  trip: TripFacts,
  history: ChatHistoryMessage[] | undefined,
): string {
  const prior = (history ?? []).filter((row) => row.content.trim().length > 0);
  const dropped = prior.slice(0, Math.max(0, prior.length - MAX_MODEL_HISTORY));
  const earlier = dropped
    .filter((row) => row.role === "user")
    .slice(-MAX_EARLIER_LINES)
    .map((row) => oneLine(row.content, EARLIER_LINE_CHARS));

  const travellers = names(
    (trip.travellers ?? []).map(
      (person) =>
        `${person.display_name} (${person.role === "primary" ? "lead" : person.party_role})`,
    ),
    trip.client ? `${trip.client.display_name} (lead)` : "not set",
  );
  const stays = trip.stays ?? [];
  const openCities = stays
    .filter((stay) => !stay.property_name?.trim() || !stay.rate_selected)
    .map((stay) => stay.city.trim())
    .filter(Boolean);
  const compared = (trip.rates.candidates ?? []).map((rate) => rate.title.trim()).filter(Boolean);
  const shown = compared.slice(0, 8);
  const hidden = compared.length - shown.length;
  const favored = trip.rates.selected?.title.trim() || "not chosen";
  const lastUser = [...prior].reverse().find((row) => row.role === "user");
  const openQuestion =
    lastUser && /\?/.test(lastUser.content) ? oneLine(lastUser.content, OPEN_QUESTION_CHARS) : null;

  const lines = [
    `Travellers: ${travellers}`,
    `Dates: ${
      trip.starts_on && trip.ends_on ? `${trip.starts_on} to ${trip.ends_on}` : "not set"
    }`,
    `Open cities: ${openCities.length > 0 ? openCities.join(", ") : "none"}`,
    `Hotels compared: ${
      shown.length > 0
        ? `${shown.join(", ")}${hidden > 0 ? `, and ${hidden} more` : ""}`
        : "none saved"
    }`,
    `Room favored: ${favored}`,
    openQuestion ? `Still open: ${openQuestion}` : null,
    earlier.length > 0 ? "Earlier in this chat:" : null,
    ...earlier.map((line) => `- ${line}`),
  ].filter((line): line is string => Boolean(line));

  return clip(lines.join("\n"), MAX_MEMORY_CHARS);
}
