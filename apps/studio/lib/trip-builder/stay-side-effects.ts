import {
  deleteLineItemsForLeg,
  deleteTripLeg,
  findOpenHotelBookingForTrip,
  findTripDocument,
  insertBookingAuditLogs,
  listTripLegs,
  updateBooking,
  updateTrip,
  upsertTripDocumentDraft,
} from "@pureluxe/db";
import { AppError, tripMessages } from "@pureluxe/shared";

import { syncTripCommercials } from "./sync-trip-commercials";
import { staysOverlap } from "./trip-window";

const QUOTE_DOC_TYPES = ["rates", "options"] as const;

/** A ready quote no longer matches the trip. Leave drafts and missing files alone. */
export async function markQuoteStale(tripId: string): Promise<void> {
  await Promise.all(QUOTE_DOC_TYPES.map((type) => markOneQuoteStale(tripId, type)));
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

/** Cancel the open Trip Builder hotel booking for one stay, when one exists. */
export async function cancelStayBooking(
  tripId: string,
  legId: string,
  actor: { memberId: string },
): Promise<void> {
  const existing = await findOpenHotelBookingForTrip(tripId, legId);
  if (!existing) return;
  const now = new Date().toISOString();
  await updateBooking({
    id: existing.id,
    status: "cancelled",
    cancelled_at: existing.cancelled_at ?? now,
    cancellation_reason: "Stay removed in Trip Builder",
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
