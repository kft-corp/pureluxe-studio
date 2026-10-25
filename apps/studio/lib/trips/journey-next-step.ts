import type { JourneyCard, TripStatus } from "@pureluxe/db";

/**
 * The next step once the plan is in place. Trip Builder and the trip page both use it,
 * so they always say the same thing.
 */
export function statusNextStep(input: {
  status: TripStatus;
  /** Options quote PDF is saved and matches the trip. */
  quoteReady: boolean;
  /** Options quote PDF no longer matches the trip. */
  quoteStale: boolean;
  /** Every stay has the client's chosen room. Null when not known. */
  roomsChosen: boolean | null;
}): string {
  switch (input.status) {
    case "cancelled":
      return "Trip cancelled";
    case "completed":
      return "Trip finished";
    case "confirmed":
      return "Ready for travel";
    case "booking":
      return input.roomsChosen === false
        ? "Record the client's room"
        : "Check today's price and book";
    case "quote_sent":
      return "Wait for the client's reply";
    case "waiting_on_client":
      return "Follow up with the client";
    default:
      // Stage 3d: quote_send builds the PDF and marks sent in one step.
      if (input.quoteStale) return "Regenerate the options quote";
      return "Send the options quote";
  }
}

/** One line under a trip on the list: the next thing to do. */
export function journeyNextStep(
  card: Pick<
    JourneyCard,
    "status" | "phase" | "starts_on" | "ends_on" | "destinations" | "proposal_stale"
  > & { client: unknown },
): string {
  if (card.phase === "cancelled") return "Trip cancelled";
  if (card.phase === "on_trip") return "Guest is travelling";
  if (card.phase === "past") return "Journey finished";
  if (card.status !== "building") {
    return statusNextStep({
      status: card.status,
      quoteReady: false,
      quoteStale: false,
      roomsChosen: null,
    });
  }
  if (card.proposal_stale) return "Regenerate the options quote";
  if (!card.client) return "Select a client";
  if (!card.starts_on || !card.ends_on) return "Set the trip dates";
  if (card.destinations.length === 0) return "Add places or search rates";
  return "Add rooms to the options quote";
}
