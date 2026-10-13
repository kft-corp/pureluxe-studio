import { journeyStatusActionSchema, tripIdSchema, tripMessages } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { setJourneyStatus } from "@/lib/trips";

type RouteContext = { params: Promise<{ id: string }> };

const SUCCESS = {
  send: tripMessages.success.quoteSent,
  waiting: tripMessages.success.waitingOnClient,
  reopen: tripMessages.success.quoteReopened,
  accept: tripMessages.success.quoteAccepted,
  confirm: tripMessages.success.tripConfirmed,
  cancel: tripMessages.success.tripCancelled,
} as const;

/** Change trip status from the trip page. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trips.write");
    const { id } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const body = journeyStatusActionSchema.parse(await request.json());
    await setJourneyStatus(tripId, body.action, { memberId: session.memberId });
    return apiSuccess({ ok: true }, { message: SUCCESS[body.action] });
  } catch (cause) {
    return apiFromError(cause);
  }
}
