import {
  bookingIdSchema,
  bookingMessages,
  linkBookingTripSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { linkBookingTrip } from "@/lib/bookings";

type RouteContext = { params: Promise<{ id: string }> };

/** Link or unlink a trip (and optional leg) on a booking. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("bookings.write");
    const { id } = await context.params;
    const bookingId = bookingIdSchema.parse(id);
    const body = linkBookingTripSchema.parse(await request.json());

    const detail = await linkBookingTrip(bookingId, body, {
      memberId: session.memberId,
    });

    return apiSuccess(detail, { message: bookingMessages.success.tripLinked });
  } catch (cause) {
    return apiFromError(cause);
  }
}
