import { AppError } from "@pureluxe/shared";

/** Words an advisor types to steer the chat, never the name of a place or hotel. */
const COMMAND_WORDS = new Set([
  "add stay",
  "complete",
  "completed",
  "continue",
  "done",
  "finished",
  "next",
  "no",
  "ok",
  "okay",
  "plan these stays",
  "save",
  "save stay",
  "that's all",
  "thats all",
  "yes",
]);

/** "City: Maldives", "Destination - Bali", "Hotel: Soneva Fushi". */
const FIELD_LABEL = /^(?:city|destination|place|stay|hotel|property)\s*[:\-–]\s*/i;
/** "City maldives" (not "City of London"). */
const BARE_CITY_LABEL = /^city\s+(?!of\b)/i;

function titleCase(value: string): string {
  return value.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

/**
 * A city or hotel name as typed, without form labels and never a command word
 * (Feedback v2 notes 7 and 10). An all-lowercase name gets capitals.
 */
export function cleanPlaceName(value: string, kind: "city" | "hotel"): string {
  let name = value.trim().replace(/\s+/g, " ").replace(FIELD_LABEL, "");
  if (kind === "city") name = name.replace(BARE_CITY_LABEL, "");
  name = name.trim();

  if (!name || COMMAND_WORDS.has(name.toLowerCase().replace(/[.!]+$/, ""))) {
    throw new AppError({
      userMessage: `"${value.trim()}" isn't a ${kind === "city" ? "place" : "hotel"} name.`,
      code: "trips.not_a_place",
      status: 400,
    });
  }
  return name === name.toLowerCase() ? titleCase(name) : name;
}
