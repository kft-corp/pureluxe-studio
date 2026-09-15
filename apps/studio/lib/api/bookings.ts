import type {
  AssignBookingOwnerBody,
  CancelBookingBody,
  ConfirmBookingBody,
  CreateBookingTravellerBody,
  LinkBookingTripBody,
  ListBookingsQuery,
  UpdateBookingBody,
  UpdateBookingTravellerBody,
} from "@pureluxe/shared";

import type { BookingDirectoryRow } from "@pureluxe/db";

import type { BookingDetail } from "@/lib/bookings";
import { apiRoutes } from "@/lib/routes";

import { fetchApi } from "./client";

export type BookingDirectoryItem = BookingDirectoryRow;

export type BookingDirectoryData = {
  bookings: BookingDirectoryItem[];
  total: number;
  limit: number;
  offset: number;
};

export type BookingDetailData = BookingDetail;

const QUERY_DEFAULTS = new Set(["", "any", "false", "0"]);

function toQueryString(params: Partial<ListBookingsQuery>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (value === false) continue;
    const asString = String(value);
    if (QUERY_DEFAULTS.has(asString)) continue;
    search.set(key, asString);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Load the Bookings directory. */
export function listBookings(params: Partial<ListBookingsQuery> = {}) {
  return fetchApi<BookingDirectoryData>(
    `${apiRoutes.bookings.root}${toQueryString(params)}`,
    { cache: "no-store" },
  );
}

/** Load one booking detail for Studio. */
export function getBooking(bookingId: string) {
  return fetchApi<BookingDetailData>(apiRoutes.bookings.byId(bookingId), {
    cache: "no-store",
  });
}

/** Patch booking fields; returns full Studio detail. */
export function updateBooking(
  bookingId: string,
  input: UpdateBookingBody,
  options?: { ifUnmodifiedSince?: string },
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.ifUnmodifiedSince) {
    headers["If-Unmodified-Since"] = options.ifUnmodifiedSince;
  }

  return fetchApi<BookingDetailData>(apiRoutes.bookings.byId(bookingId), {
    method: "PATCH",
    headers,
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Confirm a pending / on-hold booking. */
export function confirmBooking(
  bookingId: string,
  input: ConfirmBookingBody = {},
) {
  return fetchApi<BookingDetailData>(apiRoutes.bookings.confirm(bookingId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Cancel a booking with a reason. */
export function cancelBooking(bookingId: string, input: CancelBookingBody) {
  return fetchApi<BookingDetailData>(apiRoutes.bookings.cancel(bookingId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Amend — returns the new booking detail. */
export function supersedeBooking(bookingId: string) {
  return fetchApi<BookingDetailData>(apiRoutes.bookings.supersede(bookingId), {
    method: "POST",
    cache: "no-store",
  });
}

/** Assign relationship owner. */
export function assignBookingOwner(
  bookingId: string,
  input: AssignBookingOwnerBody,
) {
  return fetchApi<BookingDetailData>(apiRoutes.bookings.assign(bookingId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Link / unlink trip. */
export function linkBookingTrip(bookingId: string, input: LinkBookingTripBody) {
  return fetchApi<BookingDetailData>(apiRoutes.bookings.trip(bookingId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Add traveller. */
export function createBookingTraveller(
  bookingId: string,
  input: CreateBookingTravellerBody,
) {
  return fetchApi<BookingDetailData>(
    apiRoutes.bookings.travellers(bookingId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );
}

/** Update traveller. */
export function updateBookingTraveller(
  bookingId: string,
  travellerId: string,
  input: UpdateBookingTravellerBody,
) {
  return fetchApi<BookingDetailData>(
    apiRoutes.bookings.traveller(bookingId, travellerId),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );
}

/** Remove traveller. */
export function deleteBookingTraveller(
  bookingId: string,
  travellerId: string,
) {
  return fetchApi<BookingDetailData>(
    apiRoutes.bookings.traveller(bookingId, travellerId),
    { method: "DELETE", cache: "no-store" },
  );
}
