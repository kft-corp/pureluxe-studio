import { findTripById, findTripDocument, updateTrip, upsertTripDocumentDraft } from "@pureluxe/db";
import { AppError, tripMessages, type UpdateTripQuoteInput } from "@pureluxe/shared";

import { syncTripCommercials } from "./sync-trip-commercials";
import { syncTripHotelBooking } from "./sync-trip-booking";
import { getTripDetail } from "../trip/get-trip-detail";
import { clearTripDossier } from "../chat/trip-dossier";
import { requireEditableTrip } from "../access/require-assigned-trip";
import {
  buildTripDetail,
  parseQuoteNarrative,
  type TripDetail,
  type TripQuoteSnapshot,
} from "../trip/trip-detail";

const QUOTE_DOC_TYPE = "rates" as const;

type QuoteResult = { detail: TripDetail; quote: TripQuoteSnapshot };

/** Load quote draft + document status for an assigned trip. */
export async function getTripQuote(
  tripId: string,
  actor: { memberId: string },
): Promise<QuoteResult> {
  const detail = await getTripDetail(tripId, actor);
  return { detail, quote: detail.quote };
}

/** Edit quote draft (narrative + optional sell fields). */
export async function updateTripQuote(
  tripId: string,
  input: UpdateTripQuoteInput,
  actor: { memberId: string },
): Promise<QuoteResult> {
  const trip = await requireEditableTrip(tripId, actor.memberId);

  if (
    trip.pricing_locked_at &&
    (input.sell_total !== undefined ||
      input.sell_currency !== undefined ||
      input.payment_plan !== undefined)
  ) {
    throw new AppError({
      userMessage: tripMessages.error.pricingLocked,
      code: "trips.pricing_locked",
      status: 409,
    });
  }

  const existing = await findTripDocument(tripId, QUOTE_DOC_TYPE);
  const previous = parseQuoteNarrative(existing?.narrative_json);
  const nextNarrative = {
    title: input.title !== undefined ? input.title : previous.title,
    intro: input.intro !== undefined ? input.intro : previous.intro,
    notes: input.notes !== undefined ? input.notes : previous.notes,
    highlights:
      input.highlights !== undefined ? input.highlights : previous.highlights,
  };

  const commercialPatch: {
    sell_total?: number | null;
    sell_currency?: string | null;
    payment_plan?: Record<string, unknown> | null;
  } = {};
  if (input.sell_total !== undefined) commercialPatch.sell_total = input.sell_total;
  if (input.sell_currency !== undefined) {
    commercialPatch.sell_currency = input.sell_currency;
  }
  if (input.payment_plan !== undefined) {
    commercialPatch.payment_plan = input.payment_plan;
  }
  if (Object.keys(commercialPatch).length > 0) {
    await updateTrip(tripId, commercialPatch);
  }
  await syncTripCommercials(tripId);

  await upsertTripDocumentDraft({
    trip_id: tripId,
    type: QUOTE_DOC_TYPE,
    narrative_json: nextNarrative,
    status:
      existing?.status === "ready" || existing?.status === "stale"
        ? "stale"
        : (existing?.status ?? "generating"),
  });

  const freshTrip = (await findTripById(tripId)) ?? trip;
  const detail = await buildTripDetail(freshTrip);
  if (input.sell_total != null) {
    await syncTripHotelBooking(detail, actor);
  }
  await clearTripDossier(tripId);
  return { detail, quote: detail.quote };
}
