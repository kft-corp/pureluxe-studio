import { findBookingById, type Booking } from "@pureluxe/db";
import { AppError, bookingMessages } from "@pureluxe/shared";

/** Load a non-demo booking that exists, or throw 404. */
export async function requireActiveBooking(
  bookingId: string,
): Promise<Booking> {
  const booking = await findBookingById(bookingId);
  if (!booking) {
    throw new AppError({
      userMessage: bookingMessages.error.notFound,
      code: "bookings.not_found",
      status: 404,
    });
  }
  return booking;
}
