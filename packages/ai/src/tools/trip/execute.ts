import type { ClientToolHandlers } from "../clients";

import type { TripToolHandlers } from "./types";

function canGetTrip(
  handlers: ClientToolHandlers | TripToolHandlers,
): handlers is TripToolHandlers {
  return "getTrip" in handlers && typeof handlers.getTrip === "function";
}

/**
 * Run get_trip.
 * Returns a model-facing error object when no trip handlers are wired.
 */
export async function executeTripTool(
  input: unknown,
  handlers: ClientToolHandlers | TripToolHandlers,
): Promise<unknown> {
  void input;
  if (!canGetTrip(handlers)) {
    return {
      error:
        "get_trip is not available before a trip exists. Ask the advisor to tap Create trip, or answer from client tools only.",
    };
  }
  return handlers.getTrip();
}
