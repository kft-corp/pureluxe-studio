import {
  findTripLineItemById,
  updateTripLineItemStatus,
  type TripLineItem,
} from "@pureluxe/db";
import { AppError, rateMessages } from "@pureluxe/shared";

import { requireAssignedTrip } from "@/lib/trip-builder";

async function transitionFromPendingReview(
  lineItemId: string,
  nextStatus: "pending" | "rejected",
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

  const updated = await updateTripLineItemStatus(lineItemId, nextStatus, {
    fromStatus: "pending_review",
  });

  if (!updated) {
    throw new AppError({
      userMessage: rateMessages.error.notPendingReview,
      code: "rates.not_pending_review",
      status: 409,
    });
  }

  return updated;
}

/** pending_review → pending (atomic). */
export async function approveTripLineItem(
  lineItemId: string,
  actor: { memberId: string },
): Promise<TripLineItem> {
  return transitionFromPendingReview(lineItemId, "pending", actor);
}

/** pending_review → rejected (atomic). */
export async function rejectTripLineItem(
  lineItemId: string,
  actor: { memberId: string },
): Promise<TripLineItem> {
  return transitionFromPendingReview(lineItemId, "rejected", actor);
}
