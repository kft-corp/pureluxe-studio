import {
  clearSelectedAccommodationForLeg,
  findTripLineItemById,
  isStayShellLineItem,
  setTripLineItemSelected,
  updateTripLineItemStatus,
  type TripLineItem,
} from "@pureluxe/db";
import { AppError, rateMessages } from "@pureluxe/shared";

import { requireAssignedTrip } from "@/lib/trip-builder";

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

  await requireAssignedTrip(existing.trip_id, actor.memberId);

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

  await clearSelectedAccommodationForLeg(row.trip_id, legId);
  const selected = await setTripLineItemSelected(row.id, true);
  if (!selected) {
    throw new AppError({
      userMessage: rateMessages.error.lineItemNotFound,
      code: "rates.line_item_not_found",
      status: 404,
    });
  }

  return selected;
}
