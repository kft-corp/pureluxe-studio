import { addRateOptionBodySchema, rateMessages } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { attachRateOption } from "@/lib/rates";

/** Persist a search option onto the trip (optionally select it). */
export async function POST(request: Request) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const input = addRateOptionBodySchema.parse(await request.json());
    const data = await attachRateOption(input, {
      memberId: session.memberId,
    });

    return apiSuccess(data, {
      status: 201,
      message: input.select
        ? rateMessages.success.rateSelected
        : rateMessages.success.rateAdded,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
