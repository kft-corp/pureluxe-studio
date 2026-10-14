import {
  createTripSchema,
  listTripsQuerySchema,
  tripMessages,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { createTrip, listTripBuilderTrips } from "@/lib/trip-builder";

const NO_STORE = "no-store, no-cache, must-revalidate";

function queryFromUrl(url: URL) {
  return listTripsQuerySchema.parse({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
}

/** Assigned trips — Trip Builder home / switcher. */
export async function GET(request: Request) {
  try {
    const session = await requireApiPermission("trip_builder.read");
    const query = queryFromUrl(new URL(request.url));
    const data = await listTripBuilderTrips(query, {
      memberId: session.memberId,
    });
    const response = apiSuccess(data, {
      message: tripMessages.success.listed,
    });
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}

/** Create trip — assigned to the current member. */
export async function POST(request: Request) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const input = createTripSchema.parse(await request.json());
    const data = await createTrip(input, { memberId: session.memberId });
    return apiSuccess(data, {
      status: 201,
      message: tripMessages.success.created,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
