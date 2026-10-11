import { AppError, tripMessages } from "@pureluxe/shared";

export type TripWindow = {
  start: string;
  end: string;
};

export function tripWindow(trip: {
  starts_on: string | null;
  ends_on: string | null;
}): TripWindow | null {
  if (!trip.starts_on || !trip.ends_on) return null;
  return { start: trip.starts_on, end: trip.ends_on };
}

/**
 * Nights overlap when one stay checks in before the other checks out.
 * A checkout morning that is the next stay's check-in does not overlap.
 */
export function staysOverlap(
  checkIn: string,
  checkOut: string,
  otherIn: string,
  otherOut: string,
): boolean {
  return checkIn < otherOut && checkOut > otherIn;
}

/** YYYY-MM-DD compare. Check-out is the morning the guest leaves, so it may equal the trip end. */
export function stayInsideWindow(
  window: TripWindow,
  checkIn: string,
  checkOut: string,
): boolean {
  return checkIn >= window.start && checkOut <= window.end && checkOut > checkIn;
}

export function assertStayInsideTrip(
  trip: { starts_on: string | null; ends_on: string | null },
  checkIn: string,
  checkOut: string,
): TripWindow {
  const window = tripWindow(trip);
  if (!window) {
    throw new AppError({
      userMessage: tripMessages.error.tripDatesRequired,
      code: "trips.dates_required",
      status: 409,
    });
  }
  if (!stayInsideWindow(window, checkIn, checkOut)) {
    throw new AppError({
      userMessage: `${tripMessages.error.legOutsideTrip} The trip is ${window.start} to ${window.end}.`,
      code: "trips.leg_outside",
      status: 409,
    });
  }
  return window;
}
