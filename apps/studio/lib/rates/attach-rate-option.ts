import {
  clearSelectedAccommodationForLeg,
  findFirstTripLeg,
  findTripLegById,
  insertTripLineItem,
  setTripLineItemSelected,
  type TripLineItem,
} from "@pureluxe/db";
import { toLineItemFields, type NormalizedRateOption } from "@pureluxe/rates";
import {
  AppError,
  rateMessages,
  type AddRateOptionInput,
} from "@pureluxe/shared";

import { requireAssignedTrip } from "@/lib/trip-builder";

/**
 * Attach a search option as a trip line item.
 * When select=true, marks it as the selected accommodation for the leg.
 */
export async function attachRateOption(
  input: AddRateOptionInput,
  actor: { memberId: string },
): Promise<TripLineItem> {
  await requireAssignedTrip(input.trip_id, actor.memberId);

  let legId = input.leg_id;
  if (legId) {
    const leg = await findTripLegById(legId);
    if (!leg || leg.trip_id !== input.trip_id) {
      throw new AppError({
        userMessage: rateMessages.error.legNotFound,
        code: "rates.leg_not_found",
        status: 404,
      });
    }
  } else {
    legId = (await findFirstTripLeg(input.trip_id))?.id ?? null;
  }

  const draft = toLineItemFields(input.option as NormalizedRateOption);
  const created = await insertTripLineItem({
    trip_id: input.trip_id,
    leg_id: legId,
    category: draft.category,
    title: draft.title,
    subtitle: draft.subtitle,
    details: draft.details,
    property_id: draft.property_id,
    property_name: draft.property_name,
    currency: draft.currency,
    cost_internal: draft.cost_internal,
    rate_source_code: draft.rate_source_code,
    inclusions: draft.inclusions,
    cancellation_policy: draft.cancellation_policy,
    payment_policy: draft.payment_policy,
    status: input.select ? "pending" : "pending_review",
    selected: false,
    source: "manual",
    extracted_json: draft.extracted,
    created_by_id: actor.memberId,
  });

  if (!input.select || !legId) return created;

  await clearSelectedAccommodationForLeg(input.trip_id, legId);
  return (await setTripLineItemSelected(created.id, true)) ?? created;
}
