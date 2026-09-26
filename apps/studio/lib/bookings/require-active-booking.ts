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

/** Active booking that is not superseded (edits / lifecycle writes). */
export async function requireEditableBooking(
  bookingId: string,
): Promise<Booking> {
  const booking = await requireActiveBooking(bookingId);
  if (booking.status === "superseded") {
    throw new AppError({
      userMessage: bookingMessages.error.supersededLocked,
      code: "bookings.superseded_locked",
      status: 409,
    });
  }
  return booking;
}
