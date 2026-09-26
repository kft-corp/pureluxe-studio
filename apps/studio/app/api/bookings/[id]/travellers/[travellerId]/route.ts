import {
  bookingIdSchema,
  bookingMessages,
  bookingTravellerIdSchema,
  updateBookingTravellerSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import {
  deleteBookingTraveller,
  updateBookingTraveller,
} from "@/lib/bookings";

type RouteContext = {
  params: Promise<{ id: string; travellerId: string }>;
};

/** Update a traveller on a booking. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("bookings.write");
    const { id, travellerId: rawTravellerId } = await context.params;
    const bookingId = bookingIdSchema.parse(id);
    const travellerId = bookingTravellerIdSchema.parse(rawTravellerId);
    const body = updateBookingTravellerSchema.parse(await request.json());

    const detail = await updateBookingTraveller(
      bookingId,
      travellerId,
      body,
      { memberId: session.memberId },
    );

    return apiSuccess(detail, {
      message: bookingMessages.success.travellerUpdated,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}

/** Remove a traveller from a booking. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("bookings.write");
    const { id, travellerId: rawTravellerId } = await context.params;
    const bookingId = bookingIdSchema.parse(id);
    const travellerId = bookingTravellerIdSchema.parse(rawTravellerId);

    const detail = await deleteBookingTraveller(bookingId, travellerId, {
      memberId: session.memberId,
    });

    return apiSuccess(detail, {
      message: bookingMessages.success.travellerRemoved,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
