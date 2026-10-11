import { createHash } from "node:crypto";

import {
  buildTripDocumentPath,
  completeTripDocumentReady,
  createTripDocumentDownloadUrl,
  findTripDocument,
  findTripLineItemById,
  isStayShellLineItem,
  markTripDocumentGenerating,
  updateStayOption,
  uploadTripDocumentPdf,
  upsertTripDocumentDraft,
} from "@pureluxe/db";
import { AppError, tripMessages } from "@pureluxe/shared";

import { buildOptionsQuotePdf } from "./build-options-quote-pdf";
import { clientQuotePolicies } from "./hotel-contract-facts";
import {
  optionsQuoteFromTrip,
  roomsForOptionsQuote,
  type OptionsQuoteDocument,
} from "./options-quote-document";
import { applyQuoteEdits, listQuoteLines, quoteLineBlocked } from "./options-quote-lines";
import { clearTripDossier } from "./trip-dossier";
import { getTripDetail } from "./get-trip-detail";
import { requireAssignedTrip } from "./require-assigned-trip";
import { markQuoteStale } from "./stay-side-effects";
import { parseLineEdits, parseQuoteNarrative, type TripDetail } from "./trip-detail";

const OPTIONS_DOC_TYPE = "options" as const;

async function fillHotelPolicies(document: OptionsQuoteDocument) {
  const cache = new Map<string, string[]>();
  for (const stay of document.stays) {
    if (!stay.checkIn || !stay.checkOut) continue;
    for (const hotel of stay.hotels) {
      if (!hotel.propertyId) continue;
      const contractIds = hotel.contractIds.length > 0 ? hotel.contractIds : [null];
      const lines: string[] = [];
      for (const contractId of contractIds) {
        const key = [hotel.propertyId, stay.checkIn, stay.checkOut, contractId ?? "", hotel.seasons.join(",")].join("|");
        let found = cache.get(key);
        if (!found) {
          found = await clientQuotePolicies({
            propertyId: hotel.propertyId,
            checkIn: stay.checkIn,
            checkOut: stay.checkOut,
            contractId,
            seasons: hotel.seasons,
          });
          cache.set(key, found);
        }
        lines.push(...found);
      }
      const notes = roomPolicyNotes(hotel.rooms);
      hotel.policies = [...new Set([...lines, ...notes])];
    }
  }
}

function roomPolicyNotes(rooms: OptionsQuoteDocument["stays"][number]["hotels"][number]["rooms"]): string[] {
  const noted = rooms.flatMap((room) => (room.note ? [{ name: room.name, note: room.note }] : []));
  if (noted.length === 0) return [];
  const unique = [...new Set(noted.map((room) => room.note))];
  if (unique.length === 1) return [unique[0]!];
  return noted.map((room) => `${room.name}. ${room.note}`);
}

function optionsReady(detail: TripDetail): boolean {
  return roomsForOptionsQuote(detail).length > 0;
}

function fingerprintFor(
  detail: TripDetail,
  notes: string | null,
  title: string | null,
  lineEdits: Record<string, string>,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        layout: "client-quote-line-edits",
        title,
        notes,
        lineEdits,
        client: detail.client?.display_name ?? null,
        guests: detail.travellers.map((person) => person.display_name),
        stays: detail.stays.map((stay) => ({
          city: stay.city,
          check_in: stay.check_in,
          check_out: stay.check_out,
          adults: stay.adults,
          children: stay.children,
        })),
        rooms: roomsForOptionsQuote(detail).map((row) => ({
            id: row.id,
            sell: row.sell_amount,
            currency: row.currency,
            property: row.property_name,
            title: row.title,
            subtitle: row.subtitle,
            inclusions: row.inclusions,
            cancellation: row.cancellation_policy,
            payment: row.payment_policy,
            season: row.season_code,
          })),
      }),
    )
    .digest("hex");
}

/** The options PDF as it will be drawn, including saved line wording. */
export async function loadOptionsQuoteDocument(detail: TripDetail): Promise<OptionsQuoteDocument> {
  const narrative = detail.options_quote;
  const document = optionsQuoteFromTrip(detail, narrative.notes, narrative.title);
  await fillHotelPolicies(document);
  applyQuoteEdits(document, narrative.line_edits ?? {});
  return document;
}

/** Save the note, title, or rewritten lines printed on the options quote. */
export async function updateOptionsQuote(
  tripId: string,
  input: {
    title?: string | null;
    notes?: string | null;
    line_edits?: { id: string; text: string }[];
  },
  actor: { memberId: string },
): Promise<TripDetail> {
  await requireAssignedTrip(tripId, actor.memberId);
  const detail = await getTripDetail(tripId, actor);
  const existing = await findTripDocument(tripId, OPTIONS_DOC_TYPE);
  const previous = parseQuoteNarrative(existing?.narrative_json);
  const lineEdits = { ...parseLineEdits(existing?.narrative_json) };
  if (input.title !== undefined) delete lineEdits.title;
  if (input.notes !== undefined) delete lineEdits.notes;
  const incoming = input.line_edits ?? [];
  if (incoming.length > 0) {
    if (roomsForOptionsQuote(detail).length === 0) {
      throw new AppError({
        userMessage: tripMessages.error.optionsNotReady,
        code: "trips.options_not_ready",
        status: 409,
      });
    }
    const allowed = new Set(listQuoteLines(await loadOptionsQuoteDocument(detail)).map((line) => line.id));
    for (const id of ["title", "notes", "subtitle", "basis", "notice"]) allowed.add(id);
    let applied = 0;
    for (const row of incoming) {
      if (quoteLineBlocked(row.text)) {
        throw new AppError({
          userMessage: "Team cost, markup, bank details, and booking codes stay off the client quote.",
          code: "trips.options_line_blocked",
          status: 400,
        });
      }
      if (!allowed.has(row.id)) continue;
      lineEdits[row.id] = row.text;
      applied += 1;
    }
    if (applied === 0) {
      throw new AppError({
        userMessage: "That line is not on the options quote.",
        code: "trips.options_line_missing",
        status: 409,
      });
    }
  }
  await upsertTripDocumentDraft({
    trip_id: tripId,
    type: OPTIONS_DOC_TYPE,
    narrative_json: {
      title: input.title !== undefined ? input.title : previous.title,
      intro: previous.intro,
      notes: input.notes !== undefined ? input.notes : previous.notes,
      highlights: previous.highlights,
      line_edits: lineEdits,
    },
    status: existing?.status === "ready" ? "stale" : (existing?.status ?? "generating"),
  });
  const priceEdits = detail.pricing_locked
    ? []
    : incoming.filter(
        (row) => Object.is(lineEdits[row.id], row.text) && /^room:[0-9a-f-]{36}:price$/i.test(row.id),
      );
  for (const row of priceEdits) {
    const price = row.id.match(/^room:([0-9a-f-]{36}):price$/i);
    if (!price) continue;
    const amount = moneyFromQuoteLine(row.text);
    if (amount === undefined) continue;
    await updateStayOption(price[1]!, { sell_amount: amount });
  }
  if (priceEdits.length > 0) await markQuoteStale(tripId);
  clearTripDossier(tripId);
  return getTripDetail(tripId, actor);
}

function moneyFromQuoteLine(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (/^to be confirmed$/i.test(trimmed)) return null;
  const match = trimmed.replace(/,/g, "").match(/^(?:[A-Z]{3}\s*)?(\d+(?:\.\d+)?)(?:\s*[A-Z]{3})?$/i);
  if (!match?.[1]) return undefined;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : undefined;
}

/** Edit the client price, inclusions, or cancellation on a saved option. */
export async function updateSavedStayOption(
  lineItemId: string,
  input: {
    sell_amount?: number | null;
    cancellation_policy?: string | null;
    inclusions?: string[];
  },
  actor: { memberId: string },
): Promise<TripDetail> {
  const row = await findTripLineItemById(lineItemId);
  if (!row || row.category !== "accommodation" || isStayShellLineItem(row) || row.selected) {
    throw new AppError({
      userMessage: tripMessages.error.notFound,
      code: "trips.option_not_found",
      status: 404,
    });
  }
  const trip = await requireAssignedTrip(row.trip_id, actor.memberId);
  if (trip.pricing_locked_at) {
    throw new AppError({
      userMessage: tripMessages.error.pricingLocked,
      code: "trips.pricing_locked",
      status: 409,
    });
  }
  const updated = await updateStayOption(lineItemId, {
    ...(input.sell_amount !== undefined ? { sell_amount: input.sell_amount } : {}),
    ...(input.cancellation_policy !== undefined
      ? { cancellation_policy: input.cancellation_policy }
      : {}),
    ...(input.inclusions !== undefined ? { inclusions: input.inclusions } : {}),
  });
  if (!updated) {
    throw new AppError({
      userMessage: tripMessages.error.notFound,
      code: "trips.option_not_found",
      status: 404,
    });
  }
  if (input.sell_amount !== undefined) await clearPriceLineEdit(row.trip_id, lineItemId);
  await markQuoteStale(row.trip_id);
  clearTripDossier(row.trip_id);
  return getTripDetail(row.trip_id, actor);
}

async function clearPriceLineEdit(tripId: string, lineItemId: string) {
  const existing = await findTripDocument(tripId, OPTIONS_DOC_TYPE);
  const edits = parseLineEdits(existing?.narrative_json);
  const key = `room:${lineItemId}:price`;
  if (!Object.prototype.hasOwnProperty.call(edits, key)) return;
  delete edits[key];
  const previous = parseQuoteNarrative(existing?.narrative_json);
  await upsertTripDocumentDraft({
    trip_id: tripId,
    type: OPTIONS_DOC_TYPE,
    narrative_json: {
      title: previous.title,
      intro: previous.intro,
      notes: previous.notes,
      highlights: previous.highlights,
      line_edits: edits,
    },
    status: existing?.status === "ready" ? "stale" : existing?.status,
  });
}

/** Build the options quote PDF from the rooms saved for the client. */
export async function generateOptionsQuotePdf(
  tripId: string,
  input: { force?: boolean },
  actor: { memberId: string },
): Promise<TripDetail> {
  await requireAssignedTrip(tripId, actor.memberId);
  let detail = await getTripDetail(tripId, actor);
  if (!optionsReady(detail)) {
    throw new AppError({
      userMessage: tripMessages.error.optionsNotReady,
      code: "trips.options_not_ready",
      status: 409,
    });
  }

  const narrative = detail.options_quote;
  const fingerprint = fingerprintFor(detail, narrative.notes, narrative.title, narrative.line_edits ?? {});
  const existing = narrative.document;
  if (
    !input.force &&
    existing?.status === "ready" &&
    existing.source_fingerprint === fingerprint &&
    existing.has_file
  ) {
    return detail;
  }

  const previousStatus = existing?.status;
  await markTripDocumentGenerating(tripId, OPTIONS_DOC_TYPE);

  try {
    const document = await loadOptionsQuoteDocument(detail);
    if (document.stays.length === 0) {
      throw new AppError({
        userMessage: tripMessages.error.optionsNotReady,
        code: "trips.options_not_ready",
        status: 409,
      });
    }
    const pdf = await buildOptionsQuotePdf(document);
    const filePath = buildTripDocumentPath(tripId, OPTIONS_DOC_TYPE);
    await uploadTripDocumentPdf(filePath, pdf);
    await completeTripDocumentReady({
      trip_id: tripId,
      type: OPTIONS_DOC_TYPE,
      file_path: filePath,
      source_fingerprint: fingerprint,
      generated_by_id: actor.memberId,
    });
    detail = await getTripDetail(tripId, actor);
    clearTripDossier(tripId);
    return detail;
  } catch (cause) {
    if (previousStatus === "ready" || previousStatus === "stale") {
      await upsertTripDocumentDraft({
        trip_id: tripId,
        type: OPTIONS_DOC_TYPE,
        status: previousStatus,
      });
    }
    throw new AppError({
      userMessage: tripMessages.error.quoteGenerateFailed,
      code: "trips.quote_generate_failed",
      status: 503,
      cause,
    });
  }
}

/** Short-lived signed URL for the options quote PDF. */
export async function getOptionsQuoteFileUrl(
  tripId: string,
  actor: { memberId: string },
): Promise<{ url: string; expires_in: number }> {
  await requireAssignedTrip(tripId, actor.memberId);
  const document = await findTripDocument(tripId, OPTIONS_DOC_TYPE);
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
