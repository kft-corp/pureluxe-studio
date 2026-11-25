import type {
  QuoteAddLinesInput,
  QuoteAddOptionsInput,
  QuoteClearSectionInput,
  QuoteEditLinesInput,
  QuoteListLinesResult,
  QuotePreviewInput,
  QuotePreviewResult,
  QuoteRemoveOptionInput,
  QuoteRewriteSectionInput,
  QuoteSelectFinalInput,
  QuoteSetClientPriceInput,
  QuoteSetWordingInput,
  RatesUsePastedQuoteInput,
  TripChange,
  ToolCallRef,
} from "@pureluxe/ai";
import {
  clearSelectedAccommodationForLeg,
  deleteTripLineItemsByIds,
  findLatestRateSearch,
  findOpenHotelBookingForTrip,
  pointStayShellAtHotel,
  updateStayOption,
  updateTrip,
} from "@pureluxe/db";
import { AppError, RATE_SHOP_FRESH_MS, rateMessages, tripMessages } from "@pureluxe/shared";

import {
  findStoredRateByHotelRoom,
  loadStoredRateOption,
} from "@/lib/rates/rate-search-store";
import { clientPriceAtMarkup, roundMoney } from "@/lib/rates/price-math";
import { setJourneyStatus } from "@/lib/trips/set-journey-status";

import { partyCounts } from "../party/trip-party";
import { attachRateOption } from "../rates/attach-rate-option";
import { recheckLiveGdsOnSelect } from "../rates/recheck-chosen-rate";
import { selectAccommodationRate } from "../rates/select-accommodation-rate";
import { pasteTripLineItem } from "../rates/paste-line-item";
import { syncTripHotelBooking } from "../pricing/sync-trip-booking";
import { cancelStayBooking } from "../stays/stay-side-effects";
import {
  generateOptionsQuotePdf,
  getOptionsQuoteFileUrl,
  loadOptionsQuoteDocument,
  refreshOptionsQuotePdfAfterChange,
  updateOptionsQuote,
} from "../options-quote/options-quote";
import { expandClientWording } from "../options-quote/client-wording";
import type { OptionsQuoteDocument } from "../options-quote/options-quote-document";
import {
  appendSectionLineEdits,
  clearSectionLineEdits,
  isDeletableQuoteLineId,
  isProtectedQuoteLineId,
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
import {
  baseRoomName,
  cancelHintBonus,
  hotelNameMatch as hotelNamesMatch,
  normRoomKey,
  roomTitleScore,
} from "@/lib/rates/room-match";

function norm(value: string): string {
  return normRoomKey(value);
}

type QuoteRow = TripDetail["rates"]["candidates"][number];

type QuoteRowLookup = {
  hotel: string;
  room: string;
  /** trip_line_items.id — preferred when two Twins share a name. */
  optionId?: string;
  /** rate_search_result_id from the rates table / trip facts. */
  rateRef?: string;
  /** option_rank on the quote (1, 2, …) at that hotel. */
  optionRank?: number;
};

function rowRoomTitle(row: QuoteRow): string {
  return row.subtitle?.trim() || row.title;
}

function sameHotelRoom(row: QuoteRow, hotel: string, room: string): boolean {
  const needleHotel = norm(hotel);
  const hotelMatch =
    !needleHotel ||
    !row.property_name?.trim() ||
    hotelNamesMatch(row.property_name, hotel);
  if (!hotelMatch) return false;
  return roomTitleScore(rowRoomTitle(row), room) > 0;
}

function scoreQuoteRow(row: QuoteRow, room: string): number {
  const title = rowRoomTitle(row);
  return (
    roomTitleScore(title, room) +
    cancelHintBonus(row.cancellation_policy, room, title)
  );
}

/** Prefer id / rate_ref / rank; else hotel+room with cancel-hint tie-break. */
function findQuoteRows(
  candidates: TripDetail["rates"]["candidates"],
  lookup: QuoteRowLookup,
): TripDetail["rates"]["candidates"] {
  const optionId = lookup.optionId?.trim();
  if (optionId) {
    const byId = candidates.filter((row) => row.id === optionId);
    if (byId.length > 0) return byId;
  }

  const rateRef = lookup.rateRef?.trim();
  if (rateRef) {
    const byRef = candidates.filter((row) => row.rate_search_result_id === rateRef);
    if (byRef.length === 1) return byRef;
    if (byRef.length > 1) {
      const atHotel = byRef.filter((row) =>
        hotelNamesMatch(row.property_name ?? "", lookup.hotel),
      );
      if (atHotel.length === 1) return atHotel;
      if (atHotel.length > 1) return disambiguateQuoteRows(atHotel, lookup.room);
      return disambiguateQuoteRows(byRef, lookup.room);
    }
  }

  if (lookup.optionRank != null && lookup.optionRank > 0) {
    const atHotel = candidates.filter((row) =>
      hotelNamesMatch(row.property_name ?? "", lookup.hotel),
    );
    const byRank = atHotel.filter((row) => row.option_rank === lookup.optionRank);
    if (byRank.length === 1) return byRank;
  }

  const matched = candidates.filter((row) =>
    sameHotelRoom(row, lookup.hotel, lookup.room),
  );
  if (matched.length > 0) return disambiguateQuoteRows(matched, lookup.room);

  const needleRoom = norm(lookup.room);
  const needleBase = norm(baseRoomName(lookup.room));
  const byRoom = candidates.filter((row) => {
    const title = rowRoomTitle(row);
    const rowRoom = norm(title);
    const rowBase = norm(baseRoomName(title));
    return (
      roomTitleScore(title, lookup.room) > 0 ||
      rowRoom === needleRoom ||
      rowBase === needleBase ||
      rowRoom.includes(needleRoom) ||
      needleRoom.includes(rowRoom)
    );
  });
  return disambiguateQuoteRows(byRoom, lookup.room);
}

/** One clear winner after cancel hints; else all tied rows (caller reports ambiguous). */
function disambiguateQuoteRows(
  rows: QuoteRow[],
  room: string,
): QuoteRow[] {
  if (rows.length <= 1) return rows;
  const scored = rows
    .map((row) => ({ row, score: scoreQuoteRow(row, room) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return rows;
  const top = scored[0]!.score;
  return scored.filter((entry) => entry.score === top).map((entry) => entry.row);
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

type QuoteLegHint = {
  legId?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  destinationText?: string | null;
};

/**
 * Attach quote rooms to the correct stay on multi-stay trips.
 * Prefer rate-search leg / dates / destination — never fall back to stay #1 when ambiguous
 * (that put India options on the Maldives leg).
 */
function legIdForHotel(
  detail: TripDetail,
  hotel: string,
  hint: QuoteLegHint = {},
): string | null {
  const stays = listedStays(detail);
  if (stays.length === 0) return null;

  if (hint.legId) {
    const byLeg = stays.find((stay) => stay.leg_id === hint.legId);
    if (byLeg?.leg_id) return byLeg.leg_id;
  }

  const byHotel = stays.find((stay) => hotelNameMatch(stay.property_name, hotel));
  if (byHotel?.leg_id) return byHotel.leg_id;

  const checkIn = hint.checkIn?.trim() || null;
  const checkOut = hint.checkOut?.trim() || null;
  if (checkIn && checkOut) {
    const byDates = stays.filter(
      (stay) => stay.check_in === checkIn && stay.check_out === checkOut,
    );
    if (byDates.length === 1 && byDates[0]?.leg_id) return byDates[0].leg_id;
    const byCheckIn = stays.filter((stay) => stay.check_in === checkIn);
    if (byCheckIn.length === 1 && byCheckIn[0]?.leg_id) return byCheckIn[0].leg_id;
  } else if (checkIn) {
    const byCheckIn = stays.filter((stay) => stay.check_in === checkIn);
    if (byCheckIn.length === 1 && byCheckIn[0]?.leg_id) return byCheckIn[0].leg_id;
  }

  const place = norm(hint.destinationText ?? "");
  const hotelNorm = norm(hotel);
  const byPlace = stays.filter((stay) => {
    const city = norm(stay.city);
    if (!city) return false;
    return (
      (place && (place.includes(city) || city.includes(place))) ||
      hotelNorm.includes(city) ||
      city.includes(hotelNorm)
    );
  });
  if (byPlace.length === 1 && byPlace[0]?.leg_id) return byPlace[0].leg_id;

  if (stays.length === 1) return stays[0]?.leg_id ?? null;

  throw new AppError({
    userMessage: `Which stay is ${hotel} for? Name the city or dates (this trip has more than one stay).`,
    code: "trips.quote_stay_ambiguous",
    status: 409,
  });
}

/**
 * Pasted quotes still need a hotel name on the stay so the room attaches to a leg.
 * Multi-option shopping must NOT set the stay hotel (Issue #13) — leave blank until
 * the client’s room is recorded.
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
  resolveOpts?: { excludeResultIds?: string[] },
): Promise<{
  rateOption: NonNullable<Awaited<ReturnType<typeof loadStoredRateOption>>>["option"];
  resultId: string | null;
  legId: string | null;
  destinationText: string | null;
} | null> {
  if (option.rateRef) {
    const stored = await loadStoredRateOption(option.rateRef);
    if (stored) {
      return {
        rateOption: stored.option,
        resultId: stored.result.id,
        legId: stored.legId,
        destinationText: stored.destinationText,
      };
    }
  }
  const matched = await findStoredRateByHotelRoom(
    tripId,
    option.hotel,
    option.room,
    { excludeResultIds: resolveOpts?.excludeResultIds },
  );
  if (!matched) return null;
  return {
    rateOption: matched.option,
    resultId: matched.resultId,
    legId: matched.legId,
    destinationText: matched.destinationText,
  };
}

/**
 * Stay team cost for quote sell. Package rows must include extra nights when the
 * stay is longer than the package (never markup the package sheet amount alone).
 */
function stayTeamCostForQuote(rateOption: {
  cost_internal: number;
  raw?: Record<string, unknown> | null;
}): number {
  const base = Number(rateOption.cost_internal);
  if (!Number.isFinite(base) || base < 0) return 0;
  const raw = rateOption.raw;
  if (!raw || raw.rate_basis !== "package") return base;

  const packageNights =
    typeof raw.package_nights === "number" && Number.isFinite(raw.package_nights)
      ? raw.package_nights
      : null;
  const nights =
    typeof raw.nights === "number" && Number.isFinite(raw.nights) ? raw.nights : null;
  const extra =
    typeof raw.extra_night_amount === "number" && Number.isFinite(raw.extra_night_amount)
      ? raw.extra_night_amount
      : null;
  const packageAmount =
    typeof raw.package_amount === "number" && Number.isFinite(raw.package_amount)
      ? raw.package_amount
      : null;

  if (
    packageNights == null ||
    nights == null ||
    nights <= packageNights ||
    extra == null ||
    extra < 0
  ) {
    return base;
  }

  const extraCount = nights - packageNights;
  const expectedFromPackage =
    packageAmount != null
      ? roundMoney(packageAmount + extraCount * extra)
      : null;

  // cost_internal already includes extras (usual path).
  if (expectedFromPackage != null && Math.abs(base - expectedFromPackage) <= 0.05) {
    return base;
  }
  // cost_internal looks like the package sheet only — fold in extras.
  if (
    packageAmount != null &&
    Math.abs(base - packageAmount) <= 0.05 &&
    expectedFromPackage != null
  ) {
    return expectedFromPackage;
  }
  if (expectedFromPackage != null && base + 0.05 < expectedFromPackage) {
    return expectedFromPackage;
  }
  return base;
}

/**
 * Client price = team cost + the markup the advisor stated.
 * Hotel minimum commission is not used (MVP). Absolute clientPrice wins over %.
 */
function sellFor(
  teamCost: number,
  option: QuoteAddOptionsInput["options"][number],
): { sell: number; markup: number | null } | { missingMarkup: true } {
  if (option.clientPrice != null) {
    const sell = roundMoney(option.clientPrice);
    const markup = teamCost > 0 ? roundMoney(((sell - teamCost) / teamCost) * 100) : null;
    return { sell, markup };
  }
  if (option.markupPercent == null) {
    return { missingMarkup: true };
  }
  return {
    sell: clientPriceAtMarkup(teamCost, option.markupPercent),
    markup: option.markupPercent,
  };
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
    const missing: string[] = [];
    const needMarkup: string[] = [];
    let rankByHotel = new Map<string, number>();

    const resolvedOptions: Array<{
      option: QuoteAddOptionsInput["options"][number];
      resolved: NonNullable<Awaited<ReturnType<typeof resolveOffer>>>;
      sell: number;
      markup: number | null;
    }> = [];
    const usedResultIds: string[] = [];
    for (const option of input.options) {
      const resolved = await resolveOffer(context.tripId, option, {
        excludeResultIds: usedResultIds,
      });
      if (!resolved) {
        missing.push(`${option.hotel} · ${option.room}`);
        continue;
      }
      const teamCost = stayTeamCostForQuote(resolved.rateOption);
      const priced = sellFor(teamCost, option);
      if ("missingMarkup" in priced) {
        needMarkup.push(`${option.room} · ${option.hotel}`);
        continue;
      }
      const rateOption =
        Math.abs(teamCost - resolved.rateOption.cost_internal) > 0.05
          ? { ...resolved.rateOption, cost_internal: teamCost }
          : resolved.rateOption;
      if (resolved.resultId) usedResultIds.push(resolved.resultId);
      resolvedOptions.push({
        option,
        resolved: { ...resolved, rateOption },
        sell: priced.sell,
        markup: priced.markup,
      });
    }

    if (resolvedOptions.length === 0) {
      if (needMarkup.length > 0) {
        return {
          summary: `Say the markup percent or client price before adding: ${needMarkup.join("; ")}.`,
          undoable: false,
          after: null,
        };
      }
      return {
        summary:
          missing.length > 0
            ? `Couldn't find stored rates for: ${missing.join("; ")}. Call rates_search once for those hotels, then quote_add_options once with rate_ref + markup_percent (0% allowed). Do not retry the same add.`
            : "No rooms were added.",
        undoable: false,
        after: null,
      };
    }

    // Attach by stay dates only — do not set the stay hotel until the client chooses (#13).
    const detail = before;

    const attachedRows: Array<{
      lineItemId: string;
      sell: number;
      markup: number | null;
      rank: number | null;
      resultId: string | null;
    }> = [];

    for (const { option, resolved, sell, markup } of resolvedOptions) {
      const hotelKey = norm(option.hotel);
      const nextRank = option.rank ?? (rankByHotel.get(hotelKey) ?? 0) + 1;
      rankByHotel.set(hotelKey, nextRank);

      const legId = legIdForHotel(detail, option.hotel, {
        legId: resolved.legId,
        checkIn: resolved.rateOption.check_in,
        checkOut: resolved.rateOption.check_out,
        destinationText: resolved.destinationText,
      });
      const stayForLeg = listedStays(detail).find((stay) => stay.leg_id === legId);
      const partyRooms =
        stayForLeg?.rooms != null && stayForLeg.rooms > 0
          ? stayForLeg.rooms
          : defaultRoomCount(
              stayForLeg?.adults != null && stayForLeg.adults > 0 ? stayForLeg.adults : 2,
            );
      const partyAdults =
        stayForLeg?.adults != null && stayForLeg.adults > 0 ? stayForLeg.adults : null;
      const partyChildren =
        stayForLeg?.children != null && stayForLeg.children >= 0 ? stayForLeg.children : null;

      const attached = await attachRateOption(
        {
          trip_id: context.tripId,
          leg_id: legId,
          option: {
            ...resolved.rateOption,
            raw: {
              ...resolved.rateOption.raw,
              // Freeze party on the quote line so pending booking sync does not
              // depend on an open rate search after client confirm.
              rooms: partyRooms,
              ...(partyAdults != null ? { adults: partyAdults } : {}),
              ...(partyChildren != null ? { children: partyChildren } : {}),
              quote_meta: {
                markup_percent: markup,
                option_rank: nextRank,
                rate_search_result_id: resolved.resultId,
                added_via: "agent",
                sell_amount: sell,
                rooms: partyRooms,
                ...(partyAdults != null ? { adults: partyAdults } : {}),
                ...(partyChildren != null ? { children: partyChildren } : {}),
              },
            },
          },
          select: false,
        },
        context.actor,
      );
      attachedRows.push({
        lineItemId: attached.id,
        sell,
        markup,
        rank: option.rank ?? nextRank,
        resultId: resolved.resultId,
      });
      added.push(`${option.room} · ${option.hotel}`);
    }

    // Re-apply quote columns by attached line-item id (not hotel+room name —
    // two "Twin" rates would otherwise overwrite each other).
    for (const row of attachedRows) {
      await updateStayOption(row.lineItemId, {
        sell_amount: row.sell,
        markup_percent: row.markup,
        option_rank: row.rank,
        rate_search_result_id: row.resultId,
        added_via: "agent",
      });
    }

    await refreshOptionsQuotePdfAfterChange(context.tripId, context.actor);
    const after = await getTripDetail(context.tripId, context.actor);
    const needNote =
      needMarkup.length > 0
        ? ` Still need markup or client price for: ${needMarkup.join("; ")}.`
        : "";
    const missNote =
      missing.length > 0 ? ` Not found: ${missing.join("; ")}.` : "";
    return {
      summary: `Added ${added.length} option${added.length === 1 ? "" : "s"} to the quote.${needNote}${missNote}`,
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
      const rows = findQuoteRows(before.rates.candidates, {
        hotel: price.hotel,
        room: price.room,
      });
      const row = rows.length === 1 ? rows[0] : null;
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
    await refreshOptionsQuotePdfAfterChange(context.tripId, context.actor);
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
      await refreshOptionsQuotePdfAfterChange(context.tripId, context.actor);
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
      const rows = findQuoteRows(before.rates.candidates, {
        hotel: target.hotel,
        room: target.room,
      });
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
    await refreshOptionsQuotePdfAfterChange(context.tripId, context.actor);
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

/** Rewrite, delete, or find/replace printable lines on the options quote. */
export function editQuoteLines(
  context: TripChangeContext,
  input: QuoteEditLinesInput,
): Promise<TripChange> {
  return withTripChange(context, async (before) => {
    const document = await loadOptionsQuoteDocument(before);
    const catalog = listQuoteLines(document);
    const allowed = new Set(catalog.map((line) => line.id));
    for (const id of ["title", "notes", "subtitle", "basis", "notice"]) allowed.add(id);
    const edits: { id: string; text: string }[] = [];

    if (input.find != null && input.replace != null) {
      const matches = matchQuoteReplace(catalog, input.find, input.replace);
      for (const row of matches) edits.push({ id: row.id, text: row.after });
    }
    for (const id of input.delete_ids ?? []) {
      if (!allowed.has(id)) {
        throw new AppError({
          userMessage: `Line “${id}” is not on the options quote. Call quote_list_lines and use an id from that list.`,
          code: "trips.options_line_missing",
          status: 409,
        });
      }
      if (isProtectedQuoteLineId(id)) {
        throw new AppError({
          userMessage:
            "That line can’t be removed. Delete inclusions, transfers, arrival, shared, notice, notes, board, or terms — not titles, hotel names, or prices.",
          code: "trips.options_line_protected",
          status: 400,
        });
      }
      edits.push({ id, text: "" });
    }
    if (input.lines) {
      for (const row of input.lines) {
        const text = row.text.trim();
        if (!allowed.has(row.id)) {
          throw new AppError({
            userMessage: `Line “${row.id}” is not on the options quote. Call quote_list_lines and use an id from that list.`,
            code: "trips.options_line_missing",
            status: 409,
          });
        }
        if (!text) {
          if (!isDeletableQuoteLineId(row.id)) {
            throw new AppError({
              userMessage:
                "That line can’t be removed. Pass the full new wording, or delete an inclusion / transfer / arrival / shared / notice / notes / board / terms line.",
              code: "trips.options_line_protected",
              status: 400,
            });
          }
          edits.push({ id: row.id, text: "" });
          continue;
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
            : "No matching lines on the options quote to change. Pass lines with id and text from quote_list_lines, delete_ids, or find and replace.",
        code: "trips.options_line_missing",
        status: 409,
      });
    }

    await updateOptionsQuote(context.tripId, { line_edits: lineEdits }, context.actor);
    const deleted = lineEdits.filter((row) => !row.text.trim()).length;
    const updated = lineEdits.length - deleted;
    const parts = [
      updated === 1 ? "updated 1 line" : updated > 1 ? `updated ${updated} lines` : null,
      deleted === 1 ? "removed 1 line" : deleted > 1 ? `removed ${deleted} lines` : null,
    ].filter(Boolean);
    const body = parts.join(" and ");
    return {
      summary: `${body.charAt(0).toUpperCase()}${body.slice(1)} on the options quote.`,
      undoable: true,
      after: await getTripDetail(context.tripId, context.actor),
    };
  });
}

/** Add bullets to What's included, transfers, arrival, shared, or room extras. */
export function addQuoteLines(
  context: TripChangeContext,
  input: QuoteAddLinesInput,
): Promise<TripChange> {
  return withTripChange(context, async (before) => {
    const document = await loadOptionsQuoteDocument(before);
    for (const row of input.lines) {
      if (quoteLineBlocked(row.text)) {
        throw new AppError({
          userMessage: "Team cost, markup, bank details, and booking codes stay off the client quote.",
          code: "trips.options_line_blocked",
          status: 400,
        });
      }
    }
    const { edits, missing } = appendSectionLineEdits(document, input.lines);
    if (missing) {
      throw new AppError({
        userMessage:
          "Couldn’t find that hotel or room on the options quote. Name the hotel (and room for inclusions) that already appears on the PDF.",
        code: "trips.options_section_missing",
        status: 409,
      });
    }
    if (edits.length === 0) {
      throw new AppError({
        userMessage: "Add at least one line with section and text.",
        code: "trips.options_line_text_required",
        status: 400,
      });
    }
    await updateOptionsQuote(context.tripId, { line_edits: edits }, context.actor);
    const count = edits.length;
    return {
      summary:
        count === 1
          ? "Added 1 line on the options quote."
          : `Added ${count} lines on the options quote.`,
      undoable: true,
      after: await getTripDetail(context.tripId, context.actor),
    };
  });
}

/** Remove every line in a clearable PDF section (letterhead stays fixed). */
export function clearQuoteSection(
  context: TripChangeContext,
  input: QuoteClearSectionInput,
): Promise<TripChange> {
  return withTripChange(context, async (before) => {
    const document = await loadOptionsQuoteDocument(before);
    const lineEdits = clearSectionLineEdits(document, input.section, input.hotel, input.room);
    if (lineEdits.length === 0) {
      return {
        summary: "That section is already empty on the options quote.",
        undoable: false,
        after: null,
      };
    }
    await updateOptionsQuote(context.tripId, { line_edits: lineEdits }, context.actor);
    const count = lineEdits.length;
    return {
      summary:
        count === 1
          ? "Cleared 1 line from that section on the options quote."
          : `Cleared ${count} lines from that section on the options quote.`,
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
        property_id: stay?.property_id ?? null,
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
      if (Number.isFinite(ageMs) && ageMs > RATE_SHOP_FRESH_MS) {
        throw new AppError({
          userMessage: rateMessages.error.shopTooOldToSend,
          code: "trips.rates_stale",
          status: 409,
        });
      }
    }
    await generateOptionsQuotePdf(context.tripId, { force: false }, context.actor);
    await setJourneyStatus(context.tripId, "send", context.actor);
    const name = before.client?.display_name?.trim() || "the client";
    return {
      summary: `Marked the quote as sent to ${name} (${options.length} option${options.length === 1 ? "" : "s"}). Studio does not send WhatsApp or email — the advisor delivers the PDF.`,
      undoable: false,
      after: await getTripDetail(context.tripId, context.actor),
    };
  });
}

/** Undo payload for quote_select_final (shape alone cannot reverse a booking). */
export const QUOTE_SELECT_FINAL_UNDO = "quote_select_final" as const;

export type QuoteSelectFinalUndoPayload = {
  kind: typeof QUOTE_SELECT_FINAL_UNDO;
  leg_id: string;
  line_item_id: string;
  /** Previously selected room on this stay, if any. */
  previous_selected_id: string | null;
  /** Trip status before accept → booking (for Undo). */
  previous_status?: string | null;
};

export function isQuoteSelectFinalUndo(
  payload: Record<string, unknown> | null | undefined,
): payload is QuoteSelectFinalUndoPayload {
  return (
    payload != null &&
    payload.kind === QUOTE_SELECT_FINAL_UNDO &&
    typeof payload.leg_id === "string" &&
    typeof payload.line_item_id === "string"
  );
}

/**
 * Mark Client said yes (accept) and record the room in one step (Issue #7).
 * Used behind a Confirm card from chat so advisors need not open the trip page.
 * Works from Building when options exist (verbal yes / sent outside Studio).
 */
export function acceptAndSelectQuoteFinal(
  context: TripChangeContext,
  input: QuoteSelectFinalInput,
): Promise<TripChange> {
  return withTripChange(context, async (before) => {
    if (!isQuoteAccepted(before.trip.status) && !before.pricing_locked) {
      const hasOptions = before.rates.candidates.some((row) => !row.selected);
      if (!hasOptions && before.rates.candidates.length === 0) {
        throw new AppError({
          userMessage: "Add at least one room to the options quote before recording acceptance.",
          code: "trips.options_not_ready",
          status: 409,
        });
      }
      try {
        await setJourneyStatus(context.tripId, "accept", context.actor);
      } catch (error) {
        // Quote may still be Building (sent outside Studio). Lock pricing directly.
        if (
          error instanceof AppError &&
          error.code === "trips.quote_accept_blocked" &&
          before.trip.status === "building"
        ) {
          const now = new Date().toISOString();
          await updateTrip(context.tripId, {
            status: "booking",
            pricing_locked_at: now,
            pricing_locked_by_id: context.actor.memberId,
          });
        } else {
          throw error;
        }
      }
    }
    return selectQuoteFinalInner(context, input, await getTripDetail(context.tripId, context.actor));
  });
}

/**
 * Record the client's final room: select it, create/update the pending booking.
 * Other quote options stay on the trip so Undo can clear the choice cleanly.
 * Requires Client accepted first (pricing locked / booking stage), unless
 * acceptAndSelectQuoteFinal already locked pricing.
 */
export function selectQuoteFinal(
  context: TripChangeContext,
  input: QuoteSelectFinalInput,
): Promise<TripChange> {
  return withTripChange(context, async (before) => {
    if (!isQuoteAccepted(before.trip.status) && !before.pricing_locked) {
      throw new AppError({
        userMessage:
          "The client has not accepted yet. Ask to confirm: mark accepted and book this room.",
        code: "trips.quote_accept_required",
        status: 409,
      });
    }
    return selectQuoteFinalInner(context, input, before);
  });
}

async function selectQuoteFinalInner(
  context: TripChangeContext,
  input: QuoteSelectFinalInput,
  before: TripDetail,
): Promise<{
  summary: string;
  undoable: boolean;
  after: TripDetail | null;
  undoBefore?: QuoteSelectFinalUndoPayload;
  undoAfter?: { kind: typeof QUOTE_SELECT_FINAL_UNDO; leg_id: string; line_item_id: string };
}> {
  // Standard path: advisor names a room in chat; agent resolves to option_id; select by id only.
  const optionId = input.optionId?.trim();
  if (!optionId) {
    throw new AppError({
      userMessage:
        "Pass option_id from trip facts for the room the client chose. Hotel and room names alone are not enough when options can share a name.",
      code: "trips.quote_option_id_required",
      status: 400,
    });
  }
  const row = before.rates.candidates.find((candidate) => candidate.id === optionId);
  if (!row) {
    throw new AppError({
      userMessage: `No quote option matches that option_id for ${input.room} at ${input.hotel}. Use option_id from the current trip facts.`,
      code: "trips.quote_option_not_found",
      status: 404,
    });
  }
  const legId = row.leg_id;
  if (!legId) {
    throw new AppError({
      userMessage: "That room is not attached to a stay, so it cannot become the booking.",
      code: "trips.quote_option_no_stay",
      status: 409,
    });
  }
  if (before.pricing_locked && row.sell_amount == null) {
    throw new AppError({
      userMessage: tripMessages.error.pricingLocked,
      code: "trips.pricing_locked",
      status: 409,
    });
  }

  const hotelLabel = () =>
    row.property_name?.trim() || input.hotel;
  const roomLabel = () => row.subtitle?.trim() || row.title || input.room;

  // Already selected: still refresh the pending booking snapshot (times, party, channel).
  if (row.selected) {
    const existingBooking = await findOpenHotelBookingForTrip(context.tripId, legId);
    if (existingBooking && existingBooking.status !== "pending") {
      return {
        summary: `${roomLabel()} at ${hotelLabel()} is already the client's room.`,
        undoable: false,
        after: null,
      };
    }
    const refreshed = await syncTripHotelBooking(before, context.actor);
    const pending = await findOpenHotelBookingForTrip(context.tripId, legId);
    if (!pending || pending.status !== "pending") {
      throw new AppError({
        userMessage: `Could not refresh the pending booking for ${roomLabel()} at ${hotelLabel()}. Check the client is on the trip and try again.`,
        code: "trips.pending_booking_missing",
        status: 409,
      });
    }
    const recheckNote = await recheckLiveGdsOnSelect(
      context.tripId,
      row.id,
      row.rate_source_code,
      context.actor,
    );
    const base = refreshed
      ? `${roomLabel()} at ${hotelLabel()} is already the client's room. Pending booking details were refreshed.`
      : `${roomLabel()} at ${hotelLabel()} is already the client's room.`;
    return {
      summary: recheckNote ? `${base} ${recheckNote}` : base,
      undoable: false,
      after: await getTripDetail(context.tripId, context.actor),
    };
  }

  const previousSelectedId =
    before.rates.candidates.find((candidate) => candidate.selected && candidate.leg_id === legId)
      ?.id ?? null;
  const previousStatus = before.trip.status;

  // Set stay hotel for the chosen room without setTripStay (that refuses when pricing is locked).
  // pointStayShellAtHotel is the same path selectAccommodationRate uses after lock (Issues #7 / #13).
  const hotelName = hotelLabel();
  const stay = listedStays(before).find((s) => s.leg_id === legId);
  if (stay && hotelName && !hotelNameMatch(stay.property_name, hotelName)) {
    await pointStayShellAtHotel({
      trip_id: context.tripId,
      leg_id: legId,
      property_id: row.property_id,
      property_name: hotelName,
    });
  }

  await selectAccommodationRate(row.id, context.actor, { keepOtherOptions: true });
  const after = await getTripDetail(context.tripId, context.actor);
  // selectAccommodationRate → refreshTripAfterRateChange should have synced; verify.
  let pending = await findOpenHotelBookingForTrip(context.tripId, legId);
  if (!pending || pending.status !== "pending") {
    await syncTripHotelBooking(after, context.actor);
    pending = await findOpenHotelBookingForTrip(context.tripId, legId);
  }
  if (!pending || pending.status !== "pending") {
    throw new AppError({
      userMessage: `Recorded ${roomLabel()} at ${hotelLabel()}, but the pending booking was not created. Ensure the trip has a client and try again.`,
      code: "trips.pending_booking_missing",
      status: 409,
    });
  }

  const hotel = after.rates.selected?.property_name?.trim() || input.hotel;
  const room = after.rates.selected?.subtitle?.trim() || input.room;
  // Live GDS: recheck Sabre before the advisor books offline; auto-apply cost if it moved.
  const recheckNote = await recheckLiveGdsOnSelect(
    context.tripId,
    row.id,
    row.rate_source_code,
    context.actor,
  );
  const undoBefore: QuoteSelectFinalUndoPayload = {
    kind: QUOTE_SELECT_FINAL_UNDO,
    leg_id: legId,
    line_item_id: row.id,
    previous_selected_id: previousSelectedId,
    previous_status: previousStatus,
  };
  const base = `Recorded ${room} at ${hotel} as the client's choice. A pending booking is ready.`;
  return {
    summary: recheckNote ? `${base} ${recheckNote}` : base,
    undoable: true,
    after: await getTripDetail(context.tripId, context.actor),
    undoBefore,
    undoAfter: { kind: QUOTE_SELECT_FINAL_UNDO, leg_id: legId, line_item_id: row.id },
  };
}

/** Undo quote_select_final: clear the choice and cancel the pending booking (or restore the prior room). */
export async function undoQuoteSelectFinal(
  tripId: string,
  payload: QuoteSelectFinalUndoPayload,
  actor: { memberId: string },
): Promise<TripDetail> {
  await clearSelectedAccommodationForLeg(tripId, payload.leg_id);

  if (payload.previous_selected_id) {
    await selectAccommodationRate(payload.previous_selected_id, actor, { keepOtherOptions: true });
  } else {
    await cancelStayBooking(tripId, payload.leg_id, actor, {
      pendingOnly: true,
      reason: "Client room choice undone in Trip Builder",
    });
    const detail = await getTripDetail(tripId, actor);
    await syncTripHotelBooking(detail, actor);
  }

  await markQuoteStale(tripId, { clientChoice: true });

  // Put the trip back to waiting on the client when this step had moved it to booking.
  if (
    payload.previous_status === "quote_sent" ||
    payload.previous_status === "waiting_on_client"
  ) {
    await updateTrip(tripId, {
      status: payload.previous_status,
      pricing_locked_at: null,
      pricing_locked_by_id: null,
    });
  }

  return getTripDetail(tripId, actor);
}

/** Compatibility wrapper when call ref is passed separately. */
export type QuoteToolCall = ToolCallRef;
