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

import { buildSimpleQuotePdf } from "./build-quote-pdf";
import { getTripDetail } from "./get-trip-detail";
import { requireAssignedTrip } from "./require-assigned-trip";
import {
  buildTripDetail,
  parseQuoteNarrative,
  type TripDetail,
  type TripQuoteSnapshot,
} from "./trip-detail";

const QUOTE_DOC_TYPE = "rates" as const;

type QuoteResult = { detail: TripDetail; quote: TripQuoteSnapshot };

function quoteReady(detail: TripDetail): boolean {
  return Boolean(
    detail.client &&
      detail.stay?.check_in &&
      detail.stay.check_out &&
      detail.stay.property_name &&
      detail.rates.selected,
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
        stay: detail.stay,
        rate_id: detail.rates.selected?.id ?? null,
        rate_cost: detail.rates.selected?.cost_internal ?? null,
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

  await upsertTripDocumentDraft({
    trip_id: tripId,
    type: QUOTE_DOC_TYPE,
    narrative_json: nextNarrative,
    status:
      existing?.status === "ready" || existing?.status === "stale"
        ? "stale"
        : (existing?.status ?? "generating"),
  });

  const freshTrip =
    Object.keys(commercialPatch).length > 0
      ? ((await findTripById(tripId)) ?? trip)
      : trip;
  const detail = await buildTripDetail(freshTrip);
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

  const lines = [
    "PureLuxe Quote",
    detail.quote.title || "Hotel quote",
    "",
    `Client: ${detail.client?.display_name ?? "—"}`,
    `Hotel: ${detail.stay?.property_name ?? "—"}`,
    `City: ${detail.stay?.city ?? "—"}`,
    `Dates: ${detail.stay?.check_in ?? "—"} to ${detail.stay?.check_out ?? "—"}`,
    `Rate: ${detail.rates.selected?.title ?? "—"}`,
    `Cost (internal): ${detail.rates.selected?.cost_internal ?? "—"} ${detail.rates.selected?.currency ?? ""}`,
    `Sell: ${detail.trip.sell_total ?? "—"} ${detail.trip.sell_currency ?? ""}`,
    "",
    detail.quote.intro ? `Intro: ${detail.quote.intro}` : "Intro: —",
    detail.quote.notes ? `Notes: ${detail.quote.notes}` : "Notes: —",
    ...detail.quote.highlights.map((item) => `- ${item}`),
  ];

  try {
    const path = buildTripDocumentPath(tripId, QUOTE_DOC_TYPE);
    await uploadTripDocumentPdf(path, buildSimpleQuotePdf(lines));
    await completeTripDocumentReady({
      trip_id: tripId,
      type: QUOTE_DOC_TYPE,
      file_path: path,
      source_fingerprint: fingerprint,
      generated_by_id: actor.memberId,
    });
    detail = await buildTripDetail(trip);
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
