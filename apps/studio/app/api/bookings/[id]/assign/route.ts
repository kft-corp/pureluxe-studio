import {
  assignBookingOwnerSchema,
  bookingIdSchema,
  bookingMessages,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { assignBookingOwner } from "@/lib/bookings";

type RouteContext = { params: Promise<{ id: string }> };

/** Assign or clear the relationship owner. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("bookings.write");
    const { id } = await context.params;
    const bookingId = bookingIdSchema.parse(id);
    const body = assignBookingOwnerSchema.parse(await request.json());

    const detail = await assignBookingOwner(bookingId, body, {
      memberId: session.memberId,
    });

    return apiSuccess(detail, { message: bookingMessages.success.assigned });
  } catch (cause) {
    return apiFromError(cause);
  }
}
