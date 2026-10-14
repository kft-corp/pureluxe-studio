import { bookingIdSchema, bookingMessages } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { softDeleteBooking } from "@/lib/bookings";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Soft-delete — removes from Studio ledger; row kept for audit.
 * Prefer Cancel for supplier-side cancellations.
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("bookings.write");
    const { id } = await context.params;
    const bookingId = bookingIdSchema.parse(id);

    await softDeleteBooking(bookingId, { memberId: session.memberId });

    return apiSuccess(
      { id: bookingId },
      { message: bookingMessages.success.deleted },
    );
  } catch (cause) {
    return apiFromError(cause);
  }
}
