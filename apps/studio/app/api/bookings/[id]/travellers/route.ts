import {
  bookingIdSchema,
  bookingMessages,
  createBookingTravellerSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { createBookingTraveller } from "@/lib/bookings";

type RouteContext = { params: Promise<{ id: string }> };

/** Add a traveller to a booking. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("bookings.write");
    const { id } = await context.params;
    const bookingId = bookingIdSchema.parse(id);
    const body = createBookingTravellerSchema.parse(await request.json());

    const detail = await createBookingTraveller(bookingId, body, {
      memberId: session.memberId,
    });

    return apiSuccess(detail, {
      message: bookingMessages.success.travellerCreated,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
