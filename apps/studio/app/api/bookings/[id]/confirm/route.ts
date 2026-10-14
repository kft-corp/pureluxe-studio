import {
  bookingIdSchema,
  bookingMessages,
  confirmBookingSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { confirmBooking } from "@/lib/bookings";

type RouteContext = { params: Promise<{ id: string }> };

/** Confirm a pending / on-hold booking. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("bookings.write");
    const { id } = await context.params;
    const bookingId = bookingIdSchema.parse(id);
    const body = confirmBookingSchema.parse(await request.json().catch(() => ({})));

    const detail = await confirmBooking(bookingId, body, {
      memberId: session.memberId,
    });

    return apiSuccess(detail, { message: bookingMessages.success.confirmed });
  } catch (cause) {
    return apiFromError(cause);
  }
}
