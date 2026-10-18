import {
  findTripById,
  findTripDocument,
  updateTrip as updateTripRow,
} from "@pureluxe/db";
import {
  AppError,
  tripMessages,
  type JourneyStatusAction,
} from "@pureluxe/shared";

import { isQuoteWithClient, isTripClosed } from "./trip-status";

/** A status the database check does not allow yet (migration not applied). */
async function updateTrip(...args: Parameters<typeof updateTripRow>) {
  try {
    return await updateTripRow(...args);
  } catch (error) {
    const cause = error instanceof AppError ? error.cause : error;
    if ((cause as { code?: string } | null)?.code === "23514") {
      throw new AppError({
        userMessage: tripMessages.error.statusNotEnabled,
        code: "trips.status_not_enabled",
        status: 409,
        cause,
      });
    }
    throw error;
  }
}

/** Statuses where the quote is with the client, or about to be. */
const QUOTE_STAGES = new Set<string>(["building", "quote_sent", "waiting_on_client"]);

/** Status changes from the trip page. Does not edit the plan. */
export async function setJourneyStatus(
  tripId: string,
  action: JourneyStatusAction,
  actor: { memberId: string },
): Promise<void> {
  const trip = await findTripById(tripId);
  if (!trip || trip.is_demo || trip.archived_at) {
    throw new AppError({
      userMessage: tripMessages.error.notFound,
      code: "trips.not_found",
      status: 404,
    });
  }

  if (isTripClosed(trip.status) && action !== "cancel") {
    throw new AppError({
      userMessage: tripMessages.error.tripClosed,
      code: "trips.cancelled",
      status: 409,
    });
  }

  const quote = await findTripDocument(tripId, "options");
  const quoteReady = Boolean(quote?.file_path) && quote?.status === "ready";
  // Once sent, the PDF can only go stale from the client's own room choice:
  // any other change in Trip Builder moves the trip back to building.
  const quoteWithClient = isQuoteWithClient(trip.status) && Boolean(quote?.file_path);

  if (action === "reopen") {
    if (trip.status !== "booking" && trip.status !== "confirmed") {
      throw new AppError({
        userMessage: tripMessages.error.reopenBlocked,
        code: "trips.reopen_blocked",
        status: 409,
      });
    }
    await updateTrip(tripId, {
      status: "building",
      pricing_locked_at: null,
      pricing_locked_by_id: null,
    });
    return;
  }

  if (action === "send" || action === "waiting") {
    const target = action === "send" ? "quote_sent" : "waiting_on_client";
    if (!QUOTE_STAGES.has(trip.status) || !(quoteReady || quoteWithClient)) {
      throw new AppError({
        userMessage:
          quote?.status === "stale"
            ? tripMessages.error.quoteStale
            : action === "send"
              ? tripMessages.error.quoteSendBlocked
              : tripMessages.error.waitingBlocked,
        code: "trips.quote_send_blocked",
        status: 409,
      });
    }
    if (trip.status !== target) await updateTrip(tripId, { status: target });
    return;
  }

  if (action === "accept") {
    if (!quoteWithClient) {
      throw new AppError({
        userMessage:
          quote?.status === "stale"
            ? tripMessages.error.quoteStale
            : tripMessages.error.quoteAcceptBlocked,
        code: "trips.quote_accept_blocked",
        status: 409,
      });
    }
    const now = new Date().toISOString();
    await updateTrip(tripId, {
      status: "booking",
      pricing_locked_at: trip.pricing_locked_at ?? now,
      pricing_locked_by_id: trip.pricing_locked_by_id ?? actor.memberId,
    });
    return;
  }

  if (action === "confirm") {
    if (trip.status === "confirmed") return;
    await updateTrip(tripId, { status: "confirmed" });
    return;
  }

  if (!isTripClosed(trip.status)) {
    await updateTrip(tripId, { status: "cancelled" });
  }
}
