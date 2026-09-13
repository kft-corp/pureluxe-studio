import type { ListBookingsQuery } from "@pureluxe/shared";

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

const QUERY_DEFAULTS = new Set([
  "",
  "any",
  "false",
  "0",
]);

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
