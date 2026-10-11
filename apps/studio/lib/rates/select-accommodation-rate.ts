import {
  clearSelectedAccommodationForLeg,
  deleteUnselectedStayOptions,
  fillTripLineItemRateFacts,
  findTripLineItemById,
  isStayShellLineItem,
  pointStayShellAtHotel,
  setTripLineItemSelected,
  updateTripLineItemStatus,
  type TripLineItem,
  type TripLineItemAvailabilityStatus,
} from "@pureluxe/db";
import { taxPercentageFromRaw } from "@pureluxe/rates";
import { AppError, rateMessages, tripMessages } from "@pureluxe/shared";

import { requireAssignedTrip } from "@/lib/trip-builder";
import { markQuoteStale } from "@/lib/trip-builder/stay-side-effects";
import { refreshTripAfterRateChange } from "@/lib/trip-builder/sync-trip-commercials";

const AVAILABILITY = new Set<TripLineItemAvailabilityStatus>([
  "unknown",
  "available",
  "unavailable",
  "on_request",
]);

function availabilityFromExtracted(
  extracted: Record<string, unknown> | null,
): TripLineItemAvailabilityStatus | null {
  const value = extracted?.availability_status;
  return typeof value === "string" && AVAILABILITY.has(value as TripLineItemAvailabilityStatus)
    ? (value as TripLineItemAvailabilityStatus)
    : null;
}

/**
 * Select a priced accommodation rate for its leg.
 * Approves pending_review first; clears any prior selection on that leg.
 */
export async function selectAccommodationRate(
  lineItemId: string,
  actor: { memberId: string },
): Promise<TripLineItem> {
  const existing = await findTripLineItemById(lineItemId);
  if (!existing) {
    throw new AppError({
      userMessage: rateMessages.error.lineItemNotFound,
      code: "rates.line_item_not_found",
      status: 404,
    });
  }

  const trip = await requireAssignedTrip(existing.trip_id, actor.memberId);
  if (trip.pricing_locked_at) {
    throw new AppError({
      userMessage: tripMessages.error.pricingLocked,
      code: "trips.pricing_locked",
      status: 409,
    });
  }

  const legId = existing.leg_id;
  if (
    existing.category !== "accommodation" ||
    existing.cost_internal == null ||
    isStayShellLineItem(existing) ||
    !legId
  ) {
    throw new AppError({
      userMessage: rateMessages.error.notSelectable,
      code: "rates.not_selectable",
      status: 400,
    });
  }

  let row = existing;
  if (row.status === "pending_review") {
    const approved = await updateTripLineItemStatus(row.id, "pending", {
      fromStatus: "pending_review",
    });
    if (!approved) {
      throw new AppError({
        userMessage: rateMessages.error.notPendingReview,
        code: "rates.not_pending_review",
        status: 409,
      });
    }
    row = approved;
  }

  const extracted = row.extracted_json;
  const raw =
    extracted?.raw && typeof extracted.raw === "object"
      ? (extracted.raw as Record<string, unknown>)
      : null;
  if (row.availability_status == null || row.tax_percentage == null) {
    await fillTripLineItemRateFacts(row.id, {
      availability_status:
        row.availability_status ?? availabilityFromExtracted(extracted),
      tax_percentage: row.tax_percentage ?? taxPercentageFromRaw(raw),
    });
  }

  await clearSelectedAccommodationForLeg(row.trip_id, legId);
  const selected = await setTripLineItemSelected(row.id, true);
  if (!selected) {
    throw new AppError({
      userMessage: rateMessages.error.lineItemNotFound,
      code: "rates.line_item_not_found",
      status: 404,
    });
  }

  if (selected.property_name?.trim()) {
    await pointStayShellAtHotel({
      trip_id: selected.trip_id,
      leg_id: legId,
      property_id: selected.property_id,
      property_name: selected.property_name,
    });
  }
  await deleteUnselectedStayOptions(selected.trip_id, legId);
  await markQuoteStale(selected.trip_id);
  await refreshTripAfterRateChange(selected.trip_id, actor);
  return selected;
}
