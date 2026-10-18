import { journeyStatusActionSchema, tripIdSchema, tripMessages } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { setJourneyStatus } from "@/lib/trips";

const SUCCESS = {
  send: tripMessages.success.quoteSent,
  waiting: tripMessages.success.waitingOnClient,
  reopen: tripMessages.success.quoteReopened,
  accept: tripMessages.success.quoteAccepted,
  confirm: tripMessages.success.tripConfirmed,
  cancel: tripMessages.success.tripCancelled,
} as const;

/** Change trip status from the trip page. */
export const POST = apiRoute<{ id: string }>(
  "trips.write",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const body = journeyStatusActionSchema.parse(await request.json());
    await setJourneyStatus(tripId, body.action, { memberId: session.memberId });
    return apiSuccess({ ok: true }, { message: SUCCESS[body.action] });
  },
);
