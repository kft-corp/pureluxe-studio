import type {
  QuoteAddOptionsInput,
  QuoteEditLinesInput,
  QuoteListLinesResult,
  QuotePreviewInput,
  QuotePreviewResult,
  QuoteRemoveOptionInput,
  QuoteRewriteSectionInput,
  QuoteSetClientPriceInput,
  QuoteSetWordingInput,
  RatesUsePastedQuoteInput,
  TripChange,
  ToolCallRef,
} from "@pureluxe/ai";
import {
  deleteTripLineItemsByIds,
  findActivePropertyById,
  findLatestRateSearch,
  updateStayOption,
} from "@pureluxe/db";
import { AppError, tripMessages } from "@pureluxe/shared";

/** Quote send refuses rates older than this (B2B freshness). */
const RATES_STALE_MS = 2 * 60 * 60 * 1000;

import {
  findStoredRateByHotelRoom,
  loadStoredRateOption,
} from "@/lib/rates/rate-search-store";
import { clientPriceAtMarkup, roundMoney } from "@/lib/rates/price-math";
import { setJourneyStatus } from "@/lib/trips/set-journey-status";

import { partyCounts } from "../party/trip-party";
import { attachRateOption } from "../rates/attach-rate-option";
import { pasteTripLineItem } from "../rates/paste-line-item";
import {
  generateOptionsQuotePdf,
  getOptionsQuoteFileUrl,
  loadOptionsQuoteDocument,
  updateOptionsQuote,
} from "../options-quote/options-quote";
import { expandClientWording } from "../options-quote/client-wording";
import type { OptionsQuoteDocument } from "../options-quote/options-quote-document";
import {
  listQuoteLines,
  matchQuoteReplace,
  quoteLineBlocked,
} from "../options-quote/options-quote-lines";
import { setTripStay } from "../stays/set-trip-stay";
import { getTripDetail } from "../trip/get-trip-detail";
import type { TripDetail } from "../trip/trip-detail";
import { defaultRoomCount } from "../trip/resolve-dates";
import { markQuoteStale } from "../stays/stay-side-effects";
import { isQuoteAccepted, isQuoteWithClient } from "@/lib/trips/trip-status";

import { withTripChange, type TripChangeContext } from "./with-trip-change";

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function sameHotelRoom(
  row: { property_name: string | null; subtitle: string | null; title: string },
  hotel: string,
  room: string,
): boolean {
  const rowHotel = norm(row.property_name ?? "");
  const rowRoom = norm(row.subtitle ?? row.title);
  const needleHotel = norm(hotel);
  const needleRoom = norm(room);
  const hotelMatch =
    !needleHotel ||
    !rowHotel ||
    rowHotel === needleHotel ||
    rowHotel.includes(needleHotel) ||
    needleHotel.includes(rowHotel);
  const roomMatch =
    rowRoom === needleRoom || rowRoom.includes(needleRoom) || needleRoom.includes(rowRoom);
  return hotelMatch && roomMatch;
}

/** Prefer hotel+room matches; fall back to a unique room name on the quote. */
function findQuoteRows(
  candidates: TripDetail["rates"]["candidates"],
  hotel: string,
  room: string,
): TripDetail["rates"]["candidates"] {
  const matched = candidates.filter((row) => sameHotelRoom(row, hotel, room));
  if (matched.length > 0) return matched;
  const needleRoom = norm(room);
  const byRoom = candidates.filter((row) => {
    const rowRoom = norm(row.subtitle ?? row.title);
    return rowRoom === needleRoom || rowRoom.includes(needleRoom) || needleRoom.includes(rowRoom);
  });
  return byRoom.length === 1 ? byRoom : [];
}

function listedStays(detail: TripDetail) {
  return detail.stays.length > 0 ? detail.stays : detail.stay ? [detail.stay] : [];
}

function hotelNameMatch(stayHotel: string | null | undefined, hotel: string): boolean {
  const name = norm(stayHotel ?? "");
  const needle = norm(hotel);
  if (!name || !needle) return false;
  return name === needle || name.includes(needle) || needle.includes(name);
}

/** Attach quote rooms to the stay whose hotel (or sole stay) matches. */
function legIdForHotel(detail: TripDetail, hotel: string): string | null {
  const stays = listedStays(detail);
  if (stays.length === 0) return null;
  const byHotel = stays.find((stay) => hotelNameMatch(stay.property_name, hotel));
  if (byHotel?.leg_id) return byHotel.leg_id;
  if (stays.length === 1) return stays[0]?.leg_id ?? null;
  const byCity = stays.find((stay) => {
    const city = norm(stay.city);
    const needle = norm(hotel);
    return city && (needle.includes(city) || city.includes(needle));
  });
  return byCity?.leg_id ?? stays[0]?.leg_id ?? null;
}

/**
 * When quote rooms are added for a hotel that is not on any stay yet, put that hotel
 * on a stay with no hotel (or the only stay). Does not overwrite a different hotel.
 */
async function ensureHotelsOnStays(
  detail: TripDetail,
  hotels: Array<{ hotel: string; propertyId: string | null }>,
  actor: { memberId: string },
): Promise<{ detail: TripDetail; setHotels: string[] }> {
  let next = detail;
  const setHotels: string[] = [];
  const party = partyCounts(next.travellers);
  const adults = Math.max(1, party.adults);

  for (const { hotel, propertyId } of hotels) {
    const stays = listedStays(next);
    if (stays.some((stay) => hotelNameMatch(stay.property_name, hotel))) continue;

    const open =
      stays.find((stay) => !stay.property_name?.trim() && stay.check_in && stay.check_out) ??
      (stays.length === 1 && stays[0]?.check_in && stays[0]?.check_out ? stays[0] : null);
    if (!open?.leg_id || !open.check_in || !open.check_out) continue;
    // Another hotel is already on this stay — leave quote-only options for compare.
    if (open.property_name?.trim() && !hotelNameMatch(open.property_name, hotel)) continue;

    const result = await setTripStay(
      next.trip.id,
      {
        leg_id: open.leg_id,
        city: open.city,
        check_in: open.check_in,
        check_out: open.check_out,
        property_id: propertyId,
        property_name: hotel,
        destination_profile_id: null,
        adults,
        children: party.children,
        rooms: open.rooms ?? defaultRoomCount(adults),
        confirm_overlap: true,
      },
      actor,
    );
    next = result.detail;
    setHotels.push(hotel);
  }
  return { detail: next, setHotels };
}

async function resolveOffer(
  tripId: string,
  option: QuoteAddOptionsInput["options"][number],
): Promise<{
  rateOption: NonNullable<Awaited<ReturnType<typeof loadStoredRateOption>>>["option"];
  resultId: string | null;
  minMarkup: number | null;
} | null> {
  if (option.rateRef) {
    const stored = await loadStoredRateOption(option.rateRef);
    if (stored) {
      const property = stored.option.property_id
        ? await findActivePropertyById(stored.option.property_id)
        : null;
      return {
        rateOption: stored.option,
        resultId: stored.result.id,
        minMarkup: property?.min_markup_percent ?? null,
      };
    }
  }
  const matched = await findStoredRateByHotelRoom(tripId, option.hotel, option.room);
  if (!matched) return null;
  const property = matched.option.property_id
    ? await findActivePropertyById(matched.option.property_id)
    : null;
  return {
    rateOption: matched.option,
    resultId: matched.resultId,
    minMarkup: property?.min_markup_percent ?? null,
  };
}

function sellFor(
  teamCost: number,
  option: QuoteAddOptionsInput["options"][number],
  minMarkup: number | null,
): { sell: number; markup: number | null; belowMin: boolean } {
  if (option.clientPrice != null) {
    const sell = roundMoney(option.clientPrice);
    const markup = teamCost > 0 ? roundMoney(((sell - teamCost) / teamCost) * 100) : null;
    const belowMin = minMarkup != null && markup != null && markup < minMarkup;
    return { sell, markup, belowMin };
  }
  const markup = option.markupPercent ?? minMarkup ?? 30;
  const belowMin = minMarkup != null && markup < minMarkup;
  return { sell: clientPriceAtMarkup(teamCost, markup), markup, belowMin };
}

/** Add many rooms/hotels to the quote in one change (Stage 3d). */
export function addQuoteOptions(
  context: TripChangeContext,
  input: QuoteAddOptionsInput,
): Promise<TripChange> {
  return withTripChange(context, async (before) => {
    if (before.pricing_locked) {
      throw new AppError({
        userMessage: tripMessages.error.pricingLocked,
        code: "trips.pricing_locked",
        status: 409,
      });
    }

    const added: string[] = [];
    const belowMin: string[] = [];
    const missing: string[] = [];
    let rankByHotel = new Map<string, number>();

    // Resolve first so we know which hotels will actually be added, then put them on stays.
    const resolvedOptions: Array<{
      option: QuoteAddOptionsInput["options"][number];
      resolved: NonNullable<Awaited<ReturnType<typeof resolveOffer>>>;
    }> = [];
    for (const option of input.options) {
      const resolved = await resolveOffer(context.tripId, option);
      if (!resolved) {
        missing.push(`${option.hotel} · ${option.room}`);
        continue;
      }
      resolvedOptions.push({ option, resolved });
    }

    const { detail: withHotels, setHotels } = await ensureHotelsOnStays(
      before,
      [
        ...new Map(
          resolvedOptions.map(({ option, resolved }) => [
            norm(option.hotel),
            { hotel: option.hotel, propertyId: resolved.rateOption.property_id },
          ]),
        ).values(),
      ],
      context.actor,
    );
    const detail = withHotels;

    for (const { option, resolved } of resolvedOptions) {
      const { sell, markup, belowMin: flagged } = sellFor(
        resolved.rateOption.cost_internal,
        option,
        resolved.minMarkup,
      );
      if (flagged && markup != null) {
        belowMin.push(`${option.hotel} ${option.room} at ${markup}%`);
      }
      const hotelKey = norm(option.hotel);
      const nextRank = option.rank ?? (rankByHotel.get(hotelKey) ?? 0) + 1;
      rankByHotel.set(hotelKey, nextRank);

      await attachRateOption(
        {
          trip_id: context.tripId,
          leg_id: legIdForHotel(detail, option.hotel),
          option: {
            ...resolved.rateOption,
            raw: {
              ...resolved.rateOption.raw,
              quote_meta: {
                markup_percent: markup,
                option_rank: nextRank,
                rate_search_result_id: resolved.resultId,
                added_via: "agent",
                sell_amount: sell,
              },
            },
          },
          select: false,
        },
        context.actor,
      );
      added.push(`${option.room} · ${option.hotel}`);
    }

    if (added.length === 0) {
      return {
        summary:
          missing.length > 0
            ? `Couldn't find rates for: ${missing.join("; ")}. Search rates first.`
            : "No rooms were added.",
        undoable: false,
        after: null,
      };
    }

    // Re-apply quote columns — attachRateOption may not write them yet.
    const afterAttach = await getTripDetail(context.tripId, context.actor);
    for (const option of input.options) {
      const row = afterAttach.rates.candidates.find((candidate) =>
        sameHotelRoom(candidate, option.hotel, option.room),
      );
      if (!row) continue;
      const resolved = await resolveOffer(context.tripId, option);
      if (!resolved) continue;
      const { sell, markup } = sellFor(resolved.rateOption.cost_internal, option, resolved.minMarkup);
      await updateStayOption(row.id, {
        sell_amount: sell,
        markup_percent: markup,
        option_rank: option.rank ?? null,
        rate_search_result_id: resolved.resultId,
        added_via: "agent",
      });
    }

    await markQuoteStale(context.tripId);
    const after = await getTripDetail(context.tripId, context.actor);
    const flag =
      belowMin.length > 0
        ? ` Below the hotel minimum once: ${belowMin[0]}${belowMin.length > 1 ? ` (+${belowMin.length - 1} more)` : ""}.`
        : "";
    const hotelNote =
      setHotels.length > 0
        ? ` Set ${setHotels.join(", ")} on the stay.`
        : "";
    return {
      summary: `Added ${added.length} option${added.length === 1 ? "" : "s"} to the quote.${hotelNote}${flag}`,
      undoable: true,
      after,
    };
  });
}

export function setQuoteClientPrices(
  context: TripChangeContext,
  input: QuoteSetClientPriceInput,
): Promise<TripChange> {
  return withTripChange(context, async (before) => {
    if (before.pricing_locked) {
      throw new AppError({
        userMessage: tripMessages.error.pricingLocked,
        code: "trips.pricing_locked",
        status: 409,
      });
    }
    let count = 0;
    for (const price of input.prices) {
      const row = before.rates.candidates.find((candidate) =>
        sameHotelRoom(candidate, price.hotel, price.room),
      );
      if (!row) continue;
      const cost = row.cost_internal ?? 0;
      const sell = roundMoney(price.clientPrice);
      const markup = cost > 0 ? roundMoney(((sell - cost) / cost) * 100) : null;
      await updateStayOption(row.id, { sell_amount: sell, markup_percent: markup });
      count += 1;
    }
    if (count === 0) {
      return { summary: "No matching rooms on the quote to update.", undoable: false, after: null };
    }
    await markQuoteStale(context.tripId);
    return {
      summary: `Updated ${count} client price${count === 1 ? "" : "s"}.`,
      undoable: true,
      after: await getTripDetail(context.tripId, context.actor),
    };
  });
}

export function removeQuoteOption(
  context: TripChangeContext,
  input: QuoteRemoveOptionInput,
): Promise<TripChange> {
  return withTripChange(context, async (before) => {
    if (before.pricing_locked) {
      throw new AppError({
        userMessage: tripMessages.error.pricingLocked,
        code: "trips.pricing_locked",
        status: 409,
      });
    }

    const targets: Array<{ hotel: string; room: string }> = input.clearAll
      ? before.rates.candidates.map((row) => ({
          hotel: row.property_name?.trim() || row.title,
          room: row.subtitle?.trim() || row.title,
        }))
      : [
          ...(input.options ?? []),
          ...(input.hotel && input.room ? [{ hotel: input.hotel, room: input.room }] : []),
        ];

    if (targets.length === 0 && !input.clearAll) {
      return { summary: "No rooms named to remove.", undoable: false, after: null };
    }

    if (input.clearAll) {
      const ids = before.rates.candidates.map((row) => row.id);
      if (ids.length === 0) {
        return { summary: "The options quote already has no rooms.", undoable: false, after: null };
      }
      await deleteTripLineItemsByIds(ids);
      await markQuoteStale(context.tripId);
      return {
        summary: `Removed all ${ids.length} room${ids.length === 1 ? "" : "s"} from the quote.`,
        undoable: true,
        after: await getTripDetail(context.tripId, context.actor),
      };
    }

    const ids = new Set<string>();
    const removed: string[] = [];
    const missing: string[] = [];
    for (const target of targets) {
      const rows = findQuoteRows(before.rates.candidates, target.hotel, target.room);
      if (rows.length === 0) {
        missing.push(`${target.room} · ${target.hotel}`);
        continue;
      }
      for (const row of rows) {
        if (ids.has(row.id)) continue;
        ids.add(row.id);
        removed.push(`${row.subtitle?.trim() || row.title} · ${row.property_name?.trim() || target.hotel}`);
      }
    }

    if (ids.size === 0) {
      return {
        summary:
          missing.length > 0
            ? `Those rooms are not on the quote: ${missing.join("; ")}.`
            : "No matching rooms on the quote to remove.",
        undoable: false,
        after: null,
      };
    }

    await deleteTripLineItemsByIds([...ids]);
    await markQuoteStale(context.tripId);
    const miss =
      missing.length > 0 ? ` Not found: ${missing.join("; ")}.` : "";
    return {
      summary: `Removed ${removed.length} room${removed.length === 1 ? "" : "s"} from the quote.${miss}`,
      undoable: true,
      after: await getTripDetail(context.tripId, context.actor),
    };
  });
}

export function setQuoteWording(
  context: TripChangeContext,
  input: QuoteSetWordingInput,
): Promise<TripChange> {
  return withTripChange(context, async () => {
    await updateOptionsQuote(context.tripId, {
      title: input.title,
      notes: input.notes,
    }, context.actor);
    const parts = [
      input.title != null ? "title" : null,
      input.notes != null ? "note" : null,
    ].filter(Boolean);
    return {
      summary: `Updated the quote ${parts.join(" and ")}.`,
      undoable: true,
      after: await getTripDetail(context.tripId, context.actor),
    };
  });
}

/** Rewrite printable lines on the options quote (find/replace or full line ids). */
export function editQuoteLines(
  context: TripChangeContext,
  input: QuoteEditLinesInput,
): Promise<TripChange> {
  return withTripChange(context, async (before) => {
    const document = await loadOptionsQuoteDocument(before);
    const catalog = listQuoteLines(document);
    const allowed = new Set(catalog.map((line) => line.id));
    const edits: { id: string; text: string }[] = [];

    if (input.find != null && input.replace != null) {
      const matches = matchQuoteReplace(catalog, input.find, input.replace);
      for (const row of matches) edits.push({ id: row.id, text: row.after });
    }
    if (input.lines) {
      for (const row of input.lines) {
        const text = row.text.trim();
        if (!text) {
          throw new AppError({
            userMessage:
              "Each rewritten line needs both id and text. Call quote_list_lines first, then pass the full new wording.",
            code: "trips.options_line_text_required",
            status: 400,
          });
        }
        if (!allowed.has(row.id)) {
          throw new AppError({
            userMessage: `Line “${row.id}” is not on the options quote. Call quote_list_lines and use an id from that list.`,
            code: "trips.options_line_missing",
            status: 409,
          });
        }
        if (quoteLineBlocked(text)) {
          throw new AppError({
            userMessage: "Team cost, markup, bank details, and booking codes stay off the client quote.",
            code: "trips.options_line_blocked",
            status: 400,
          });
        }
        edits.push({ id: row.id, text });
      }
    }

    const byId = new Map<string, string>();
    for (const row of edits) byId.set(row.id, row.text);
    const lineEdits = [...byId.entries()].map(([id, text]) => ({ id, text }));

    if (lineEdits.length === 0) {
      throw new AppError({
        userMessage:
          input.find != null
            ? `“${input.find}” is not on the options quote. Call quote_list_lines, or use quote_rewrite_section for plain-English inclusions.`
            : "No matching lines on the options quote to change. Pass lines with id and text from quote_list_lines, or find and replace.",
        code: "trips.options_line_missing",
        status: 409,
      });
    }

    await updateOptionsQuote(context.tripId, { line_edits: lineEdits }, context.actor);
    const count = lineEdits.length;
    return {
      summary:
        count === 1
          ? "Updated 1 line on the options quote."
          : `Updated ${count} lines on the options quote.`,
      undoable: true,
      after: await getTripDetail(context.tripId, context.actor),
    };
  });
}

function nameMatches(value: string, needle: string | undefined): boolean {
  if (!needle) return true;
  const left = norm(value);
  const right = norm(needle);
  return left === right || left.includes(right) || right.includes(left);
}

function pushExpanded(
  edits: { id: string; text: string }[],
  id: string,
  text: string | null | undefined,
) {
  const raw = text?.trim() ?? "";
  if (!raw) return;
  const next = expandClientWording(raw);
  if (!next || next === raw || quoteLineBlocked(next)) return;
  edits.push({ id, text: next });
}

/** Collect expandable lines from the quote document for one section. */
function collectSectionEdits(
  document: OptionsQuoteDocument,
  input: QuoteRewriteSectionInput,
): { id: string; text: string }[] {
  const section = input.section;
  const edits: { id: string; text: string }[] = [];
  const want = (key: QuoteRewriteSectionInput["section"]) =>
    section === key || section === "client_wording";

  if (want("notice")) pushExpanded(edits, "notice", document.notice);

  document.stays.forEach((stay, stayIndex) => {
    stay.hotels.forEach((hotel, hotelIndex) => {
      if (!nameMatches(hotel.name, input.hotel)) return;
      const hotelId = `stay:${stayIndex}:hotel:${hotelIndex}`;
      if (want("arrival")) {
        hotel.arrival.forEach((item, index) =>
          pushExpanded(edits, `${hotelId}:arrival:${index}`, item),
        );
      }
      if (want("transfers")) {
        hotel.transfers.forEach((item, index) =>
          pushExpanded(edits, `${hotelId}:transfer:${index}`, item),
        );
      }
      if (want("shared")) {
        hotel.shared.forEach((item, index) =>
          pushExpanded(edits, `${hotelId}:shared:${index}`, item),
        );
      }
      for (const room of hotel.rooms) {
        if (!nameMatches(room.name, input.room)) continue;
        if (want("board")) pushExpanded(edits, `room:${room.id}:detail`, room.detail);
        if (want("inclusions")) {
          room.inclusions.forEach((item, index) =>
            pushExpanded(edits, `room:${room.id}:inclusion:${index}`, item),
          );
        }
        if (want("shared")) {
          room.extras.forEach((item, index) =>
            pushExpanded(edits, `room:${room.id}:extra:${index}`, item),
          );
        }
        if (want("terms")) {
          const term =
            room.terms?.trim() ||
            [room.cancellation, room.payment].filter(Boolean).join(" ");
          pushExpanded(edits, `room:${room.id}:terms`, term);
        }
      }
    });
  });
  return edits;
}

/**
 * Expand supplier shorthand on a quote section into client plain English.
 * Letterhead stays fixed. Use when the advisor asks to make inclusions / board clear.
 */
export function rewriteQuoteSection(
  context: TripChangeContext,
  input: QuoteRewriteSectionInput,
): Promise<TripChange> {
  return withTripChange(context, async (before) => {
    const document = await loadOptionsQuoteDocument(before);
    const lineEdits = collectSectionEdits(document, input);

    if (lineEdits.length === 0) {
      return {
        summary:
          "Those lines are already in clear client wording, or none matched that section.",
        undoable: false,
        after: null,
      };
    }

    await updateOptionsQuote(context.tripId, { line_edits: lineEdits }, context.actor);
    const count = lineEdits.length;
    return {
      summary:
        count === 1
          ? "Rewrote 1 line in clear client wording on the options quote."
          : `Rewrote ${count} lines in clear client wording on the options quote.`,
      undoable: true,
      after: await getTripDetail(context.tripId, context.actor),
    };
  });
}

/** Printable lines the advisor can rewrite (for the agent). */
export async function listQuoteLinesForAgent(
  tripId: string,
  actor: { memberId: string },
): Promise<QuoteListLinesResult> {
  const detail = await getTripDetail(tripId, actor);
  const document = await loadOptionsQuoteDocument(detail);
  return {
    lines: listQuoteLines(document).map((row) => ({
      id: row.id,
      label: row.label,
      text: row.text,
    })),
  };
}

/**
 * Build the options quote PDF when needed and return a short-lived URL.
 * Does not mark the quote sent. When the quote is with the client, opens the
 * file as sent unless force is true (which rebuilds and moves the trip back).
 */
export async function previewQuote(
  tripId: string,
  input: QuotePreviewInput,
  actor: { memberId: string },
): Promise<QuotePreviewResult> {
  const detail = await getTripDetail(tripId, actor);
  const doc = detail.options_quote.document;
  const hasFile = Boolean(doc?.has_file);
  const ready = doc?.status === "ready" && hasFile;
  const withClient = isQuoteWithClient(detail.trip.status);
  const accepted = isQuoteAccepted(detail.trip.status);
  const canRebuild = detail.rates.candidates.length > 0 && !accepted;

  if (!canRebuild && !hasFile) {
    throw new AppError({
      userMessage: tripMessages.error.optionsNotReady,
      code: "trips.options_not_ready",
      status: 409,
    });
  }

  const force = input.force === true;
  if (force && accepted) {
    throw new AppError({
      userMessage:
        "The client accepted this quote, so the PDF stays as sent. Reopen the quote on the trip page under Update status to change it.",
      code: "trips.quote_accepted",
      status: 409,
    });
  }

  if (canRebuild && (!ready || force) && !(withClient && !force)) {
    await generateOptionsQuotePdf(tripId, { force: force || !ready }, actor);
  } else if (!hasFile) {
    throw new AppError({
      userMessage: tripMessages.error.quoteFileMissing,
      code: "trips.quote_file_missing",
      status: 404,
    });
  }

  const file = await getOptionsQuoteFileUrl(tripId, actor);
  const rebuilt = canRebuild && (!ready || force) && !(withClient && !force);
  return {
    ok: true,
    summary: rebuilt
      ? withClient
        ? "The options quote is rebuilt and open. The client has the old one, so the trip is back to Building."
        : "The options quote is open."
      : withClient || accepted
        ? "This is the options quote the client has."
        : "The options quote is open.",
    url: file.url,
    expires_in: file.expires_in,
  };
}

export function usePastedQuote(
  context: TripChangeContext,
  input: RatesUsePastedQuoteInput,
): Promise<TripChange> {
  return withTripChange(context, async (before) => {
    if (before.pricing_locked) {
      throw new AppError({
        userMessage: tripMessages.error.pricingLocked,
        code: "trips.pricing_locked",
        status: 409,
      });
    }
    const { detail: withHotel, setHotels } = await ensureHotelsOnStays(
      before,
      [{ hotel: input.hotel, propertyId: null }],
      context.actor,
    );
    const stay =
      listedStays(withHotel).find((row) => hotelNameMatch(row.property_name, input.hotel)) ??
      listedStays(withHotel)[0] ??
      withHotel.stays[0];
    const checkIn = stay?.check_in ?? withHotel.trip.starts_on;
    const checkOut = stay?.check_out ?? withHotel.trip.ends_on;
    if (!checkIn || !checkOut) {
      throw new AppError({
        userMessage: "Set the trip dates before pasting a supplier quote.",
        code: "trips.dates_required",
        status: 409,
      });
    }
    await pasteTripLineItem(
      {
        trip_id: context.tripId,
        leg_id: stay?.leg_id ?? null,
        property_name: input.hotel,
        title: input.room,
        paste_text: input.pasteText,
        check_in: checkIn,
        check_out: checkOut,
        currency: input.currency ?? "USD",
      },
      context.actor,
    );
    if (input.clientPrice != null) {
      const afterPaste = await getTripDetail(context.tripId, context.actor);
      const row = afterPaste.rates.candidates.find((candidate) =>
        sameHotelRoom(candidate, input.hotel, input.room),
      );
      if (row) {
        await updateStayOption(row.id, {
          sell_amount: roundMoney(input.clientPrice),
          added_via: "paste",
        });
      }
    }
    const hotelNote = setHotels.length > 0 ? ` Set ${setHotels[0]} on the stay.` : "";
    return {
      summary: `Added ${input.room} · ${input.hotel} from the pasted quote.${hotelNote}`,
      undoable: true,
      after: await getTripDetail(context.tripId, context.actor),
    };
  });
}

/** Generate the PDF if needed and mark the quote sent. */
export function sendQuote(context: TripChangeContext): Promise<TripChange> {
  return withTripChange(context, async (before) => {
    const options = before.rates.candidates.filter((row) => !row.selected);
    if (options.length === 0) {
      throw new AppError({
        userMessage: "Add at least one room to the options quote before sending.",
        code: "trips.options_not_ready",
        status: 409,
      });
    }
    const search = await findLatestRateSearch(context.tripId);
    if (search?.event.created_at) {
      const ageMs = Date.now() - new Date(search.event.created_at).getTime();
      if (Number.isFinite(ageMs) && ageMs > RATES_STALE_MS) {
        throw new AppError({
          userMessage:
            "These rates are more than 2 hours old. Search rates again before sending the quote.",
          code: "trips.rates_stale",
          status: 409,
        });
      }
    }
    await generateOptionsQuotePdf(context.tripId, { force: false }, context.actor);
    await setJourneyStatus(context.tripId, "send", context.actor);
    const name = before.client?.display_name?.trim() || "the client";
    return {
      summary: `Sent ${options.length} option${options.length === 1 ? "" : "s"} to ${name}.`,
      undoable: false,
      after: await getTripDetail(context.tripId, context.actor),
    };
  });
}

/** Compatibility wrapper when call ref is passed separately. */
export type QuoteToolCall = ToolCallRef;
