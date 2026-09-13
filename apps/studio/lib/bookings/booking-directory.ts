import { listBookings } from "@pureluxe/db";
import type { ListBookingsQuery } from "@pureluxe/shared";

export { BOOKING_DIRECTORY_PAGE_SIZE } from "./booking-limits";

type ListDirectoryOptions = ListBookingsQuery & {
  actorMemberId?: string | null;
};

/** Directory list for the Bookings page. */
export async function listBookingDirectory(query: ListDirectoryOptions) {
  return listBookings(query);
}
