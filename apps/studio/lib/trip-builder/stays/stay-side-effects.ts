import {
  clearSelectedAccommodationForLeg,
  deleteLineItemsForLeg,
  deleteTripLeg,
  deleteTripLineItemsByIds,
  deleteUnselectedStayOptions,
  findOpenHotelBookingForTrip,
  findTripDocument,
  findTripById,
  insertBookingAuditLogs,
  listPricedAccommodationLineItems,
  listTripLegs,
  updateBooking,
  updateTrip,
  upsertTripDocumentDraft,
} from "@pureluxe/db";
import { AppError, tripMessages } from "@pureluxe/shared";

import { syncTripCommercials } from "../pricing/sync-trip-commercials";
import { isQuoteWithClient } from "@/lib/trips/trip-status";
import { staysOverlap } from "../trip/trip-window";

const QUOTE_DOC_TYPES = ["rates", "options"] as const;

/**
 * A ready quote no longer matches the trip. Leave drafts and missing files alone.
 * `clientChoice`: the client picked a room from the sent quote, so the trip keeps its status.
 * Any other change means the client's copy is out of date, even when the PDF was already
 * marked stale by an earlier client choice, so a sent quote goes back to Building.
 */
export async function markQuoteStale(
  tripId: string,
  options: { clientChoice?: boolean } = {},
): Promise<void> {
  await Promise.all(QUOTE_DOC_TYPES.map((type) => markOneQuoteStale(tripId, type)));
  if (!options.clientChoice) await reopenSentQuote(tripId);
}

/** The client's options quote changed after it was sent. They need the new one. */
export async function reopenSentQuote(tripId: string): Promise<void> {
  const trip = await findTripById(tripId);
  if (trip && isQuoteWithClient(trip.status)) {
    await updateTrip(tripId, { status: "building" });
  }
}

async function markOneQuoteStale(
  tripId: string,
  type: (typeof QUOTE_DOC_TYPES)[number],
): Promise<void> {
  const existing = await findTripDocument(tripId, type);
  if (!existing || existing.status !== "ready") return;
  await upsertTripDocumentDraft({
    trip_id: tripId,
    type,
    status: "stale",
  });
}

/**
 * Founder #3: drop priced quote options when party / rooms / nights / city change
 * so old costs cannot remain looking current. Stay shell is kept.
 */
export async function clearStaleQuotePricesForLeg(
  tripId: string,
  legId: string,
): Promise<void> {
  await clearSelectedAccommodationForLeg(tripId, legId);
  await deleteUnselectedStayOptions(tripId, legId);
  const priced = await listPricedAccommodationLineItems(tripId, legId);
  if (priced.length > 0) {
    await deleteTripLineItemsByIds(priced.map((row) => row.id));
  }
}

/**
 * Cancel the open Trip Builder hotel booking for one stay, when one exists.
 * `pendingOnly`: leave a booking the team already confirmed with the hotel.
 */
export async function cancelStayBooking(
  tripId: string,
  legId: string,
  actor: { memberId: string },
  options: { pendingOnly?: boolean; reason?: string } = {},
): Promise<void> {
  const existing = await findOpenHotelBookingForTrip(tripId, legId);
  if (!existing) return;
  if (options.pendingOnly && existing.status !== "pending") return;
  const now = new Date().toISOString();
  await updateBooking({
    id: existing.id,
    status: "cancelled",
    cancelled_at: existing.cancelled_at ?? now,
    cancellation_reason: options.reason ?? "Stay removed in Trip Builder",
  });
  await insertBookingAuditLogs([
    {
      booking_id: existing.id,
      action: "cancelled",
      field_name: "status",
      old_value: existing.status,
      new_value: "cancelled",
      performed_by: "team",
      team_member_id: actor.memberId,
      metadata: { source: "trip_builder", trip_id: tripId, leg_id: legId },
    },
  ]);
}

/** Drop a stay: cancel its booking, remove its line items, then delete the leg. */
export async function removeStayRecord(
  tripId: string,
  legId: string,
  actor: { memberId: string },
): Promise<void> {
  await cancelStayBooking(tripId, legId, actor);
  await deleteLineItemsForLeg(tripId, legId);
  await deleteTripLeg(tripId, legId);
  const remaining = await listTripLegs(tripId);
  if (remaining.length === 0) {
    await updateTrip(tripId, { legs_confirmed_at: null });
  }
  await syncTripCommercials(tripId);
}

export function assertNoUnconfirmedOverlap(
  legs: { id: string; destination: string; check_in: string | null; check_out: string | null }[],
  checkIn: string,
  checkOut: string,
  ignoreLegId: string | null,
  confirmOverlap: boolean,
): void {
  if (confirmOverlap) return;
  const clash = legs.find(
    (leg) =>
      leg.id !== ignoreLegId &&
      leg.check_in &&
      leg.check_out &&
      staysOverlap(checkIn, checkOut, leg.check_in, leg.check_out),
  );
  if (!clash || !clash.check_in || !clash.check_out) return;
  throw new AppError({
    userMessage: `${tripMessages.error.stayOverlap} It overlaps ${clash.destination} (${clash.check_in} to ${clash.check_out}).`,
    code: "trips.stay_overlap",
    status: 409,
  });
}
