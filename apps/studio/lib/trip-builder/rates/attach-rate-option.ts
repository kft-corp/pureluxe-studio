import {
  findFirstTripLeg,
  findTripLegById,
  insertTripLineItem,
  listPricedAccommodationLineItems,
  type TripLineItem,
} from "@pureluxe/db";
import { toLineItemFields, type NormalizedRateOption } from "@pureluxe/rates";
import {
  AppError,
  rateMessages,
  tripMessages,
  type AddRateOptionInput,
} from "@pureluxe/shared";

import { requireEditableTrip } from "../access/require-assigned-trip";
import { markQuoteStale } from "../stays/stay-side-effects";

import { selectAccommodationRate } from "./select-accommodation-rate";

/**
 * Attach a search option as a trip line item.
 * When select=true, marks it as the selected accommodation for the leg.
 */
export async function attachRateOption(
  input: AddRateOptionInput,
  actor: { memberId: string },
): Promise<TripLineItem> {
  const trip = await requireEditableTrip(input.trip_id, actor.memberId);
  if (trip.pricing_locked_at) {
    throw new AppError({
      userMessage: tripMessages.error.pricingLocked,
      code: "trips.pricing_locked",
      status: 409,
    });
  }

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
  if (legId) {
    const saved = await listPricedAccommodationLineItems(input.trip_id, legId);
    const room = (draft.subtitle ?? draft.title).trim().toLowerCase();
    const hotel = (draft.property_name ?? "").trim().toLowerCase();
    const duplicate = saved.find((row) => {
      const sameHotel = (row.property_name ?? "").trim().toLowerCase() === hotel;
      const sameRoom = (row.subtitle ?? row.title).trim().toLowerCase() === room;
      return sameHotel && sameRoom;
    });
    if (duplicate) {
      if (!input.select) return duplicate;
      return selectAccommodationRate(duplicate.id, actor);
    }
  }

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
    tax_percentage: draft.tax_percentage,
    availability_status: draft.availability_status,
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

  if (!input.select || !legId) {
    await markQuoteStale(input.trip_id);
    return created;
  }

  return selectAccommodationRate(created.id, actor);
}
