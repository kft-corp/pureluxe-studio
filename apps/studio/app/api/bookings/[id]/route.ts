import { bookingIdSchema, bookingMessages, updateBookingSchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { getBookingDetail, updateBooking } from "@/lib/bookings";

const NO_STORE = "no-store, no-cache, must-revalidate";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function parseBookingId(context: RouteContext) {
  const { id } = await context.params;
  return bookingIdSchema.parse(id);
}

/** Full booking detail for Studio. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireApiPermission("bookings.read");
    const bookingId = await parseBookingId(context);
    const data = await getBookingDetail(bookingId);
    const response = apiSuccess(data);
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}

/** Patch whitelisted booking fields; returns full detail. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("bookings.write");
    const bookingId = await parseBookingId(context);
    const patch = updateBookingSchema.parse(await request.json());
    const ifUnmodifiedSince = request.headers.get("If-Unmodified-Since");

    const detail = await updateBooking(
      bookingId,
      patch,
      { memberId: session.memberId },
      { ifUnmodifiedSince },
    );

    const response = apiSuccess(detail, {
      message: bookingMessages.success.updated,
    });
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
