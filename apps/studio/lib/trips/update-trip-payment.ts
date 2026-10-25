import { findTripById, updateTrip } from "@pureluxe/db";
import {
  AppError,
  tripMessages,
  type UpdateTripPaymentInput,
} from "@pureluxe/shared";

import { getJourney, type JourneyPageModel } from "./get-journey";

/** Record offline client payment on the trip (not a payment gateway). */
export async function updateTripPayment(
  tripId: string,
  input: UpdateTripPaymentInput,
  _actor: { memberId: string },
): Promise<JourneyPageModel> {
  const trip = await findTripById(tripId);
  if (!trip || trip.is_demo || trip.archived_at) {
    throw new AppError({
      userMessage: tripMessages.error.notFound,
      code: "trips.not_found",
      status: 404,
    });
  }

  await updateTrip(tripId, {
    ...(input.amount_received !== undefined
      ? { amount_received: input.amount_received }
      : {}),
    ...(input.payment_status !== undefined
      ? { payment_status: input.payment_status }
      : {}),
  });

  return getJourney(tripId);
}
