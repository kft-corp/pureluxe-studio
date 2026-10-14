import { bookingIdSchema, bookingMessages } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { supersedeBooking } from "@/lib/bookings";

type RouteContext = { params: Promise<{ id: string }> };

/** Amend — supersede prior booking and return the new version. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("bookings.write");
    const { id } = await context.params;
    const bookingId = bookingIdSchema.parse(id);

    const detail = await supersedeBooking(bookingId, {
      memberId: session.memberId,
    });

    return apiSuccess(detail, { message: bookingMessages.success.superseded });
  } catch (cause) {
    return apiFromError(cause);
  }
}
