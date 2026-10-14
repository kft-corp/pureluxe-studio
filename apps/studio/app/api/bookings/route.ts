import {
  bookingMessages,
  createBookingSchema,
  listBookingsQuerySchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { createBooking, listBookingDirectory } from "@/lib/bookings";

const NO_STORE = "no-store, no-cache, must-revalidate";

function queryFromUrl(url: URL) {
  return listBookingsQuerySchema.parse({
    q: url.searchParams.get("q") ?? undefined,
    scope: url.searchParams.get("scope") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    work: url.searchParams.get("work") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    missing_ref: url.searchParams.get("missing_ref") ?? undefined,
    no_trip: url.searchParams.get("no_trip") ?? undefined,
    ticket_deadline_soon:
      url.searchParams.get("ticket_deadline_soon") ?? undefined,
    owner: url.searchParams.get("owner") ?? undefined,
    start_from: url.searchParams.get("start_from") ?? undefined,
    start_to: url.searchParams.get("start_to") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
}

/** Directory — search, Mine/All, type, work queue, status, ops filters, paginate. */
export async function GET(request: Request) {
  try {
    const session = await requireApiPermission("bookings.read");
    const query = queryFromUrl(new URL(request.url));
    const data = await listBookingDirectory({
      ...query,
      actorMemberId: session.memberId,
    });
    const response = apiSuccess(data);
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}

/** Create booking — offline / orphan inventory (`source = manual`). */
export async function POST(request: Request) {
  try {
    const session = await requireApiPermission("bookings.write");
    const input = createBookingSchema.parse(await request.json());
    const data = await createBooking(input, { memberId: session.memberId });
    return apiSuccess(data, {
      status: 201,
      message: bookingMessages.success.created,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
