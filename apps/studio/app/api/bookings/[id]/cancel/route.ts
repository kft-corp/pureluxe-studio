import {
  bookingIdSchema,
  bookingMessages,
  cancelBookingSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { cancelBooking } from "@/lib/bookings";

type RouteContext = { params: Promise<{ id: string }> };

/** Cancel a booking with an ops reason. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("bookings.write");
    const { id } = await context.params;
    const bookingId = bookingIdSchema.parse(id);
    const body = cancelBookingSchema.parse(await request.json());

    const detail = await cancelBooking(bookingId, body, {
      memberId: session.memberId,
    });

    return apiSuccess(detail, { message: bookingMessages.success.cancelled });
  } catch (cause) {
    return apiFromError(cause);
  }
}
