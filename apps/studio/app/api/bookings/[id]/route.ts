import { bookingIdSchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { getBookingDetail } from "@/lib/bookings";

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
