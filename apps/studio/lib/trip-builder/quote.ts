import { createHash } from "node:crypto";

import {
  buildTripDocumentPath,
  completeTripDocumentReady,
  createTripDocumentDownloadUrl,
  findTripById,
  findTripDocument,
  markTripDocumentGenerating,
  updateTrip,
  uploadTripDocumentPdf,
  upsertTripDocumentDraft,
} from "@pureluxe/db";
import {
  AppError,
  tripMessages,
  type GenerateTripQuoteInput,
  type UpdateTripQuoteInput,
} from "@pureluxe/shared";

import { buildClientQuotePdf } from "./build-quote-pdf";
import { syncTripCommercials } from "./sync-trip-commercials";
import { syncTripHotelBooking } from "./sync-trip-booking";
import { getTripDetail } from "./get-trip-detail";
import { clearTripDossier } from "./trip-dossier";
import { requireAssignedTrip } from "./require-assigned-trip";
import {
  buildTripDetail,
  parseQuoteNarrative,
  type TripDetail,
  type TripQuoteSnapshot,
} from "./trip-detail";

const QUOTE_DOC_TYPE = "rates" as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatQuoteDate(iso: string | null): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function nightCount(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  const nights = Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000,
  );
  return nights > 0 ? nights : 0;
}

function staysOf(detail: TripDetail) {
  return detail.stays.length > 0 ? detail.stays : detail.stay ? [detail.stay] : [];
}

function selectedForStay(detail: TripDetail, legId: string) {
  return (
    detail.rates.candidates.find(
      (rate) => rate.selected && rate.leg_id === legId,
    ) ?? null
  );
}

function partyLine(stay: TripDetail["stay"], detail: TripDetail): string {
  if (!stay) return "";
  const nights = nightCount(stay.check_in, stay.check_out);
  const parts: string[] = [];
  const names = detail.travellers.map((person) => person.display_name.trim()).filter(Boolean);
  if (names.length > 0) parts.push(names.join(", "));
  if (nights) parts.push(nights === 1 ? "1 night" : `${nights} nights`);
  if (stay.adults) {
    parts.push(stay.adults === 1 ? "1 adult" : `${stay.adults} adults`);
  }
  if (stay.children) {
    parts.push(stay.children === 1 ? "1 child" : `${stay.children} children`);
  }
  if (stay.rooms) {
    parts.push(stay.rooms === 1 ? "1 room" : `${stay.rooms} rooms`);
  }
  return parts.join("  ·  ");
}

type QuoteResult = { detail: TripDetail; quote: TripQuoteSnapshot };

function quoteReady(detail: TripDetail): boolean {
  const stays = staysOf(detail);
  return Boolean(
    detail.client &&
      stays.length > 0 &&
      stays.every(
        (stay) =>
          stay.check_in &&
          stay.check_out &&
          stay.property_name &&
          selectedForStay(detail, stay.leg_id),
      ),
  );
}

function fingerprintFor(detail: TripDetail): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        trip_id: detail.trip.id,
        title: detail.trip.title,
        sell_total: detail.trip.sell_total,
        sell_currency: detail.trip.sell_currency,
        payment_plan: detail.trip.payment_plan,
        stays: staysOf(detail).map((stay) => ({
          leg_id: stay.leg_id,
          city: stay.city,
          check_in: stay.check_in,
          check_out: stay.check_out,
          property_name: stay.property_name,
          rate_id: selectedForStay(detail, stay.leg_id)?.id ?? null,
        })),
        narrative: {
          title: detail.quote.title,
          intro: detail.quote.intro,
          notes: detail.quote.notes,
          highlights: detail.quote.highlights,
        },
      }),
    )
    .digest("hex");
}

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
  const trip = await requireAssignedTrip(tripId, actor.memberId);

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
  clearTripDossier(tripId);
  return { detail, quote: detail.quote };
}

/** Generate the rates quote PDF and mark the document ready. */
export async function generateTripQuotePdf(
  tripId: string,
  input: GenerateTripQuoteInput,
  actor: { memberId: string },
): Promise<QuoteResult> {
  const trip = await requireAssignedTrip(tripId, actor.memberId);
  let detail = await buildTripDetail(trip);

  if (!quoteReady(detail)) {
    throw new AppError({
      userMessage: tripMessages.error.quoteNotReady,
      code: "trips.quote_not_ready",
      status: 409,
    });
  }

  const fingerprint = fingerprintFor(detail);
  const existing = detail.quote.document;

  if (
    !input.force &&
    existing?.status === "ready" &&
    existing.source_fingerprint === fingerprint &&
    existing.has_file
  ) {
    return { detail, quote: detail.quote };
  }

  await markTripDocumentGenerating(tripId, QUOTE_DOC_TYPE);

  const sell =
    detail.trip.sell_total == null
      ? "To be confirmed"
      : `${detail.trip.sell_currency ?? ""} ${detail.trip.sell_total}`.trim();
  const pdf = buildClientQuotePdf({
    clientName: detail.client?.display_name ?? "Guest",
    stays: staysOf(detail).map((stay) => {
      const selected = selectedForStay(detail, stay.leg_id);
      return {
        hotel: stay.property_name ?? "Hotel",
        city: stay.city,
        dates: [formatQuoteDate(stay.check_in), formatQuoteDate(stay.check_out)]
          .filter(Boolean)
          .join("  –  "),
        party: partyLine(stay, detail),
        room: selected?.subtitle || selected?.title || "Accommodation",
        inclusions: selected?.inclusions ?? [],
      };
    }),
    sell,
    intro: detail.quote.intro,
    notes: detail.quote.notes,
    highlights: detail.quote.highlights,
  });

  try {
    const path = buildTripDocumentPath(tripId, QUOTE_DOC_TYPE);
    await uploadTripDocumentPdf(path, pdf);
    await completeTripDocumentReady({
      trip_id: tripId,
      type: QUOTE_DOC_TYPE,
      file_path: path,
      source_fingerprint: fingerprint,
      generated_by_id: actor.memberId,
    });
    detail = await buildTripDetail(trip);
    clearTripDossier(tripId);
    return { detail, quote: detail.quote };
  } catch (cause) {
    throw new AppError({
      userMessage: tripMessages.error.quoteGenerateFailed,
      code: "trips.quote_generate_failed",
      status: 503,
      cause,
    });
  }
}

/** Short-lived signed URL for the ready quote PDF. */
export async function getTripQuoteFileUrl(
  tripId: string,
  actor: { memberId: string },
): Promise<{ url: string; expires_in: number }> {
  await requireAssignedTrip(tripId, actor.memberId);
  const document = await findTripDocument(tripId, QUOTE_DOC_TYPE);

  if (!document?.file_path || document.status === "generating") {
    throw new AppError({
      userMessage: tripMessages.error.quoteFileMissing,
      code: "trips.quote_file_missing",
      status: 404,
    });
  }

  const expiresIn = 120;
  const url = await createTripDocumentDownloadUrl(document.file_path, expiresIn);
  return { url, expires_in: expiresIn };
}
