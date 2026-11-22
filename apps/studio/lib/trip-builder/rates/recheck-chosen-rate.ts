import {
  findTripLineItemById,
  patchTripLineItemExtractedRaw,
  updateStayOption,
  type TripLineItem,
} from "@pureluxe/db";
import {
  mapHotelDetailsToQuotes,
  priceCheckSabreRate,
  searchHotelDetailsByCode,
  type RateSourceCode,
} from "@pureluxe/rates";
import { AppError, rateMessages, rateSourceLabel } from "@pureluxe/shared";

import {
  cancelHintBonus,
  hotelNameMatch,
  roomTitleScore,
} from "@/lib/rates/room-match";

import { requireAssignedTrip } from "../access/require-assigned-trip";
import {
  refreshTripAfterRateChange,
  syncClientPriceFromChoices,
} from "../pricing/sync-trip-commercials";
import { syncTripHotelBooking } from "../pricing/sync-trip-booking";
import { comboOccupancySegmentsFromRaw } from "./combo-occupancy-segments";
import { getTripDetail } from "../trip/get-trip-detail";
import type { TripDetail, TripRateSnapshot } from "../trip/trip-detail";

export type PriceRecheckStatus =
  | "unchanged"
  | "changed"
  | "unavailable"
  | "skipped"
  | "error";

export type PriceRecheckCostUpdate = {
  lineItemId: string;
  room: string;
  amount: number;
  currency: string;
};

export type PriceRecheckResult = {
  status: PriceRecheckStatus;
  /** Advisor-facing note for chat. */
  note: string;
  rate_source_code: string | null;
  rate_source_label: string | null;
  hotel: string | null;
  room: string | null;
  cost_on_file: number | null;
  currency_on_file: string | null;
  cost_today: number | null;
  currency_today: string | null;
  /** When cost moved — UI can offer "Use today's cost". */
  update: PriceRecheckCostUpdate | null;
  needs_live_check: boolean;
  /** True when advisor should search rates again for this hotel. */
  requires_reshop: boolean;
};

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function money(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "not set";
  const code = currency?.trim().toUpperCase() || "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: code ? "currency" : "decimal",
      currency: code || undefined,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return code ? `${code} ${amount}` : String(amount);
  }
}

function costsDiffer(a: number, b: number): boolean {
  return Math.abs(a - b) >= 0.01;
}

/** Live GDS sources need a Sabre price recheck before offline book. */
export function needsLivePriceRecheck(
  rateSourceCode: string | null | undefined,
): boolean {
  return rateSourceCode === "gds_public" || rateSourceCode === "gds_negotiated";
}

function rawFromLine(line: TripLineItem | null): Record<string, unknown> | null {
  const extracted = line?.extracted_json;
  if (!extracted || typeof extracted !== "object") return null;
  const raw = (extracted as Record<string, unknown>).raw;
  if (!raw || typeof raw !== "object") return null;
  return raw as Record<string, unknown>;
}

function extractedStayDates(line: TripLineItem | null): {
  checkIn: string | null;
  checkOut: string | null;
} {
  const extracted = line?.extracted_json;
  if (!extracted || typeof extracted !== "object") {
    return { checkIn: null, checkOut: null };
  }
  const rec = extracted as Record<string, unknown>;
  return {
    checkIn: textValue(rec.check_in),
    checkOut: textValue(rec.check_out),
  };
}

function sameHotelRoom(
  row: TripRateSnapshot,
  hotel: string,
  room: string,
): boolean {
  const hotelOk =
    !hotel.trim() ||
    !row.property_name?.trim() ||
    hotelNameMatch(row.property_name, hotel);
  if (!hotelOk) return false;
  const title = row.subtitle?.trim() || row.title;
  return roomTitleScore(title, room) > 0;
}

function disambiguateRecheckRows(
  rows: TripRateSnapshot[],
  room: string,
): TripRateSnapshot[] {
  if (rows.length <= 1) return rows;
  const scored = rows
    .map((row) => {
      const title = row.subtitle?.trim() || row.title;
      return {
        row,
        score:
          roomTitleScore(title, room) +
          cancelHintBonus(row.cancellation_policy, room, title),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return rows;
  const top = scored[0]!.score;
  return scored.filter((entry) => entry.score === top).map((entry) => entry.row);
}

function matchRoomQuote(
  roomName: string,
  quotes: Array<{
    room_name?: string | null;
    cost_internal: number;
    currency: string;
    raw?: Record<string, unknown> | null;
  }>,
) {
  const want = norm(roomName);
  if (!want) return null;
  return (
    quotes.find((q) => norm(q.room_name ?? "") === want) ??
    quotes.find((q) => {
      const name = norm(q.room_name ?? "");
      return Boolean(name) && (name.includes(want) || want.includes(name));
    }) ??
    null
  );
}

function resolveTargets(
  detail: TripDetail,
  input: { lineItemId?: string | null; hotel?: string | null; room?: string | null },
): TripRateSnapshot[] {
  if (input.lineItemId) {
    const row = detail.rates.candidates.find((c) => c.id === input.lineItemId);
    return row ? [row] : [];
  }

  const hotel = input.hotel?.trim() ?? "";
  const room = input.room?.trim() ?? "";
  if (hotel && room) {
    const matched = detail.rates.candidates.filter((row) =>
      sameHotelRoom(row, hotel, room),
    );
    if (matched.length > 0) return disambiguateRecheckRows(matched, room);
    const needleRoom = norm(room);
    const byRoom = detail.rates.candidates.filter((row) => {
      const title = row.subtitle?.trim() || row.title;
      const rowRoom = norm(title);
      return (
        roomTitleScore(title, room) > 0 ||
        rowRoom === needleRoom ||
        rowRoom.includes(needleRoom) ||
        needleRoom.includes(rowRoom)
      );
    });
    return disambiguateRecheckRows(byRoom, room);
  }

  const selected = detail.rates.candidates.filter((row) => row.selected);
  if (selected.length > 0) return selected;
  if (detail.rates.selected) return [detail.rates.selected];
  return [];
}

function headerFor(row: TripRateSnapshot): {
  room: string;
  hotel: string | null;
  label: string;
  header: string;
} {
  const room = row.subtitle?.trim() || row.title;
  const hotel = row.property_name?.trim() || null;
  const label = rateSourceLabel(row.rate_source_code);
  const onFile = money(row.cost_internal, row.currency);
  const sell = money(row.sell_amount, row.currency);
  const header = `**Price check · ${room}**${hotel ? ` · ${hotel}` : ""}\n\nCost on file **${onFile}**${row.sell_amount != null ? `. Sell **${sell}**` : ""}.`;
  return { room, hotel, label, header };
}

function skippedResult(
  row: TripRateSnapshot,
  kind: "contracted" | "pasted" | "other",
): PriceRecheckResult {
  const { room, hotel, label, header } = headerFor(row);

  let note: string;
  if (kind === "contracted") {
    note = `${header}\n\nThis is a **contracted** rate — no live GDS recheck is needed. Cost stays as on file. Book with the hotel, then confirm in **Bookings**.`;
  } else if (kind === "pasted") {
    note = `${header}\n\nThis is a **pasted** supplier quote — there is no live GDS recheck. Confirm the supplier still honors this price if the quote is old, then book offline.`;
  } else {
    note = `${header}\n\nThis rate source (${label}) does not support live price recheck yet. Confirm the price with the supplier before you book.`;
  }

  return {
    status: "skipped",
    note,
    rate_source_code: row.rate_source_code,
    rate_source_label: label,
    hotel,
    room,
    cost_on_file: row.cost_internal,
    currency_on_file: row.currency,
    cost_today: null,
    currency_today: null,
    update: null,
    needs_live_check: false,
    requires_reshop: false,
  };
}

async function persistGdsKeys(
  lineItemId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  try {
    await patchTripLineItemExtractedRaw(lineItemId, patch);
  } catch {
    // Price check result still useful if persist fails.
  }
}

function compareTodayCost(
  row: TripRateSnapshot,
  header: string,
  label: string,
  hotel: string | null,
  room: string,
  todayCost: number,
  todayCurrency: string | null,
  priceChangedFlag: boolean,
): PriceRecheckResult {
  const onFileCost = row.cost_internal;
  const onFileCurrency = row.currency?.trim().toUpperCase() || null;
  const sameCurrency =
    !onFileCurrency ||
    !todayCurrency ||
    onFileCurrency === todayCurrency;
  const todayLabel = money(todayCost, todayCurrency);

  if (!sameCurrency) {
    return {
      status: "changed",
      note: `${header}\n\nToday: cost **${todayLabel}**. Currency differs from the rate on file — compare with the hotel before you book.`,
      rate_source_code: row.rate_source_code,
      rate_source_label: label,
      hotel,
      room,
      cost_on_file: onFileCost,
      currency_on_file: row.currency,
      cost_today: todayCost,
      currency_today: todayCurrency,
      update: null,
      needs_live_check: true,
      requires_reshop: false,
    };
  }

  const moved =
    onFileCost == null ||
    costsDiffer(todayCost, onFileCost) ||
    priceChangedFlag;

  if (!moved) {
    return {
      status: "unchanged",
      note: `${header}\n\nToday: cost **${todayLabel}** — unchanged. Book with the hotel, then confirm in **Bookings**.`,
      rate_source_code: row.rate_source_code,
      rate_source_label: label,
      hotel,
      room,
      cost_on_file: onFileCost,
      currency_on_file: row.currency,
      cost_today: todayCost,
      currency_today: todayCurrency,
      update: null,
      needs_live_check: true,
      requires_reshop: false,
    };
  }

  return {
    status: "changed",
    note: `${header}\n\nToday: cost **${todayLabel}**. The cost has changed. Tap **Use today's cost** to update the room and the pending booking, then set the sell if it needs to change.`,
    rate_source_code: row.rate_source_code,
    rate_source_label: label,
    hotel,
    room,
    cost_on_file: onFileCost,
    currency_on_file: row.currency,
    cost_today: todayCost,
    currency_today: todayCurrency,
    update: {
      lineItemId: row.id,
      room,
      amount: todayCost,
      currency: todayCurrency || row.currency || "USD",
    },
    needs_live_check: true,
    requires_reshop: false,
  };
}

/**
 * When Price Check says re-shop / rate gone, try GetHotelDetails for the same
 * hotel code and match the chosen room name.
 */
async function fallbackReshop(
  detail: TripDetail,
  row: TripRateSnapshot,
  line: TripLineItem | null,
  header: string,
  label: string,
  hotel: string | null,
  room: string,
): Promise<PriceRecheckResult | null> {
  const raw = rawFromLine(line);
  const hotelCode = textValue(raw?.sabre_hotel_code);
  if (!hotelCode) return null;

  const stay = detail.stays.find((s) => s.leg_id === row.leg_id) ?? detail.stay;
  const fromExtracted = extractedStayDates(line);
  const checkIn = fromExtracted.checkIn ?? stay?.check_in ?? null;
  const checkOut = fromExtracted.checkOut ?? stay?.check_out ?? null;
  if (!checkIn || !checkOut) return null;

  const source = (
    row.rate_source_code === "gds_negotiated" ? "gds_negotiated" : "gds_public"
  ) as Extract<RateSourceCode, "gds_public" | "gds_negotiated">;

  try {
    // Always re-shop in USD so today's cost matches quote / pending booking currency.
    const response = await searchHotelDetailsByCode({
      hotelCode,
      checkIn,
      checkOut,
      adults: stay?.adults ?? 2,
      children: stay?.children ?? 0,
      rooms: stay?.rooms ?? 1,
      currency: "USD",
    });
    const quotes = mapHotelDetailsToQuotes({
      response,
      source,
      propertyId: row.property_id,
      checkIn,
      checkOut,
      currency: "USD",
      hotelCode,
    });
    const matched = matchRoomQuote(room, quotes);
    if (!matched) {
      return {
        status: "unavailable",
        note: `${header}\n\n${rateMessages.error.sabrePriceCheckRateGone}`,
        rate_source_code: row.rate_source_code,
        rate_source_label: label,
        hotel,
        room,
        cost_on_file: row.cost_internal,
        currency_on_file: row.currency,
        cost_today: null,
        currency_today: null,
        update: null,
        needs_live_check: true,
        requires_reshop: true,
      };
    }

    const newKey =
      typeof matched.raw?.rate_key === "string" ? matched.raw.rate_key.trim() : "";
    if (newKey) {
      await persistGdsKeys(row.id, {
        rate_key: newKey,
        sabre_hotel_code: hotelCode,
        price_check_via: "reshop_details",
        price_checked_at: new Date().toISOString(),
      });
    }

    return compareTodayCost(
      row,
      header,
      label,
      hotel,
      room,
      matched.cost_internal,
      matched.currency?.trim().toUpperCase() || "USD",
      true,
    );
  } catch {
    return null;
  }
}

async function recheckComboGds(
  detail: TripDetail,
  row: TripRateSnapshot,
  line: TripLineItem | null,
  header: string,
  label: string,
  hotel: string | null,
  room: string,
  raw: Record<string, unknown>,
): Promise<PriceRecheckResult | null> {
  const segments = comboOccupancySegmentsFromRaw(raw);
  if (!segments) return null;

  const keys = segments
    .map((segment) => segment.rate_key)
    .filter((key): key is string => Boolean(key));
  if (keys.length < 2) {
    const fallback = await fallbackReshop(
      detail,
      row,
      line,
      header,
      label,
      hotel,
      room,
    );
    if (fallback) return fallback;
    return {
      status: "unavailable",
      note: `${header}\n\n${rateMessages.error.sabrePriceCheckNoRateKey} This option needs a live key per room — search rates again for both rooms.`,
      rate_source_code: row.rate_source_code,
      rate_source_label: label,
      hotel,
      room,
      cost_on_file: row.cost_internal,
      currency_on_file: row.currency,
      cost_today: null,
      currency_today: null,
      update: null,
      needs_live_check: true,
      requires_reshop: true,
    };
  }

  let totalToday = 0;
  let todayCurrency: string | null = row.currency?.trim().toUpperCase() || "USD";
  let anyChanged = false;
  const segmentNotes: string[] = [];
  const nextSegmentRows = Array.isArray(raw.sabre_occupancy_segments)
    ? [...(raw.sabre_occupancy_segments as unknown[])]
    : [];

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]!;
    const rateKey = segment.rate_key!;
    const result = await priceCheckSabreRate({ rateKey, currency: "USD" });
    if (result.status !== "ok") {
      if (result.requiresReshop || result.reason === "rate_gone") {
        const fallback = await fallbackReshop(
          detail,
          row,
          line,
          header,
          label,
          hotel,
          room,
        );
        if (fallback) return fallback;
        return {
          status: "unavailable",
          note: `${header}\n\n${segment.label}: ${rateMessages.error.sabrePriceCheckRateGone}`,
          rate_source_code: row.rate_source_code,
          rate_source_label: label,
          hotel,
          room,
          cost_on_file: row.cost_internal,
          currency_on_file: row.currency,
          cost_today: null,
          currency_today: null,
          update: null,
          needs_live_check: true,
          requires_reshop: true,
        };
      }
      return {
        status: result.status === "error" ? "error" : "unavailable",
        note: `${header}\n\n${segment.label}: ${result.message}`,
        rate_source_code: row.rate_source_code,
        rate_source_label: label,
        hotel,
        room,
        cost_on_file: row.cost_internal,
        currency_on_file: row.currency,
        cost_today: null,
        currency_today: null,
        update: null,
        needs_live_check: true,
        requires_reshop: false,
      };
    }

    const { check } = result;
    const segmentCost = check.costInternal;
    if (segmentCost == null || !Number.isFinite(segmentCost)) {
      return {
        status: "unavailable",
        note: `${header}\n\n${segment.label}: today's cost was not returned. Search rates again before you book.`,
        rate_source_code: row.rate_source_code,
        rate_source_label: label,
        hotel,
        room,
        cost_on_file: row.cost_internal,
        currency_on_file: row.currency,
        cost_today: null,
        currency_today: null,
        update: null,
        needs_live_check: true,
        requires_reshop: true,
      };
    }
    totalToday += segmentCost;
    todayCurrency =
      check.currency?.trim().toUpperCase() || todayCurrency;
    if (check.priceChanged) anyChanged = true;
    segmentNotes.push(
      `${segment.label}: ${money(segmentCost, todayCurrency)}${check.priceChanged ? " (moved)" : ""}`,
    );

    const priorRow = nextSegmentRows[i];
    if (priorRow && typeof priorRow === "object") {
      nextSegmentRows[i] = {
        ...(priorRow as Record<string, unknown>),
        rate_key: check.rateKey || rateKey,
        cost_internal: segmentCost,
        ...(check.bookingKey ? { booking_key: check.bookingKey } : {}),
      };
    }
  }

  await persistGdsKeys(row.id, {
    sabre_occupancy_segments: nextSegmentRows,
    rate_key: null,
    price_checked_at: new Date().toISOString(),
    price_check_price_changed: anyChanged,
    price_check_cost: totalToday,
    price_check_currency: todayCurrency,
  });

  const compared = compareTodayCost(
    row,
    header,
    label,
    hotel,
    room,
    totalToday,
    todayCurrency,
    anyChanged,
  );
  return {
    ...compared,
    note: `${compared.note}\n\nPer room today:\n${segmentNotes.map((line) => `• ${line}`).join("\n")}`,
  };
}

async function recheckOneGds(
  detail: TripDetail,
  row: TripRateSnapshot,
  line: TripLineItem | null,
): Promise<PriceRecheckResult> {
  const { room, hotel, label, header } = headerFor(row);

  const raw = rawFromLine(line);
  const comboResult = raw
    ? await recheckComboGds(
        detail,
        row,
        line,
        header,
        label,
        hotel,
        room,
        raw,
      )
    : null;
  if (comboResult) return comboResult;

  const rateKey = textValue(raw?.rate_key);
  if (!rateKey) {
    const fallback = await fallbackReshop(detail, row, line, header, label, hotel, room);
    if (fallback) return fallback;
    return {
      status: "unavailable",
      note: `${header}\n\n${rateMessages.error.sabrePriceCheckNoRateKey}`,
      rate_source_code: row.rate_source_code,
      rate_source_label: label,
      hotel,
      room,
      cost_on_file: row.cost_internal,
      currency_on_file: row.currency,
      cost_today: null,
      currency_today: null,
      update: null,
      needs_live_check: true,
      requires_reshop: true,
    };
  }

  const result = await priceCheckSabreRate({ rateKey, currency: "USD" });
  if (result.status !== "ok") {
    if (result.requiresReshop || result.reason === "rate_gone") {
      const fallback = await fallbackReshop(
        detail,
        row,
        line,
        header,
        label,
        hotel,
        room,
      );
      if (fallback) return fallback;
      return {
        status: "unavailable",
        note: `${header}\n\n${rateMessages.error.sabrePriceCheckRateGone}`,
        rate_source_code: row.rate_source_code,
        rate_source_label: label,
        hotel,
        room,
        cost_on_file: row.cost_internal,
        currency_on_file: row.currency,
        cost_today: null,
        currency_today: null,
        update: null,
        needs_live_check: true,
        requires_reshop: true,
      };
    }
    return {
      status: result.status === "error" ? "error" : "unavailable",
      note: `${header}\n\n${result.message}`,
      rate_source_code: row.rate_source_code,
      rate_source_label: label,
      hotel,
      room,
      cost_on_file: row.cost_internal,
      currency_on_file: row.currency,
      cost_today: null,
      currency_today: null,
      update: null,
      needs_live_check: true,
      requires_reshop: false,
    };
  }

  const { check } = result;
  await persistGdsKeys(row.id, {
    ...(check.bookingKey ? { booking_key: check.bookingKey } : {}),
    rate_key: check.rateKey || rateKey,
    price_checked_at: new Date().toISOString(),
    price_check_price_changed: check.priceChanged,
    ...(check.costInternal != null
      ? { price_check_cost: check.costInternal }
      : {}),
    ...(check.currency ? { price_check_currency: check.currency } : {}),
  });

  const todayCost = check.costInternal;
  const todayCurrency =
    check.currency?.trim().toUpperCase() || row.currency?.trim().toUpperCase() || null;

  if (todayCost == null) {
    if (!check.priceChanged) {
      return {
        status: "unchanged",
        note: `${header}\n\nToday's GDS check: cost has **not** changed. Book with the hotel, then confirm in **Bookings**.`,
        rate_source_code: row.rate_source_code,
        rate_source_label: label,
        hotel,
        room,
        cost_on_file: row.cost_internal,
        currency_on_file: row.currency,
        cost_today: null,
        currency_today: todayCurrency,
        update: null,
        needs_live_check: true,
        requires_reshop: false,
      };
    }
    const fallback = await fallbackReshop(detail, row, line, header, label, hotel, room);
    if (fallback) return fallback;
    return {
      status: "unavailable",
      note: `${header}\n\nGDS signaled the price moved, but today's amount wasn't returned. ${rateMessages.error.sabrePriceCheckRateGone}`,
      rate_source_code: row.rate_source_code,
      rate_source_label: label,
      hotel,
      room,
      cost_on_file: row.cost_internal,
      currency_on_file: row.currency,
      cost_today: null,
      currency_today: todayCurrency,
      update: null,
      needs_live_check: true,
      requires_reshop: true,
    };
  }

  return compareTodayCost(
    row,
    header,
    label,
    hotel,
    room,
    todayCost,
    todayCurrency,
    check.priceChanged,
  );
}

async function recheckOne(
  detail: TripDetail,
  row: TripRateSnapshot,
): Promise<PriceRecheckResult> {
  const code = row.rate_source_code;
  if (code === "offline_contracted") return skippedResult(row, "contracted");
  if (code === "offline_manual") return skippedResult(row, "pasted");
  if (!needsLivePriceRecheck(code)) return skippedResult(row, "other");

  const line = await findTripLineItemById(row.id);
  return recheckOneGds(detail, row, line);
}

export type RecheckChosenRateInput = {
  tripId: string;
  lineItemId?: string | null;
  hotel?: string | null;
  room?: string | null;
};

/**
 * Recheck today's price for a chosen (or named) room.
 * GDS → Sabre Price Check (+ Details re-shop fallback). Contracted/pasted → skip.
 */
export async function recheckChosenRate(
  input: RecheckChosenRateInput,
  actor: { memberId: string },
): Promise<PriceRecheckResult | { results: PriceRecheckResult[]; note: string }> {
  await requireAssignedTrip(input.tripId, actor.memberId);
  const detail = await getTripDetail(input.tripId, actor);
  const targets = resolveTargets(detail, {
    lineItemId: input.lineItemId,
    hotel: input.hotel,
    room: input.room,
  });

  if (targets.length === 0) {
    throw new AppError({
      userMessage: rateMessages.error.priceCheckRoomNotFound,
      code: "rates.price_check_room_not_found",
      status: 404,
    });
  }

  if (
    input.hotel?.trim() &&
    input.room?.trim() &&
    targets.length > 1 &&
    !input.lineItemId
  ) {
    throw new AppError({
      userMessage: rateMessages.error.priceCheckAmbiguous,
      code: "rates.price_check_ambiguous",
      status: 409,
    });
  }

  const results: PriceRecheckResult[] = [];
  for (const row of targets) {
    results.push(await recheckOne(detail, row));
  }

  // Refresh pending booking handoff fields (BookingKey / rate key) when GDS check ran.
  if (results.some((row) => row.needs_live_check)) {
    try {
      const fresh = await getTripDetail(input.tripId, actor);
      await syncTripHotelBooking(fresh, actor);
    } catch {
      // Recheck note already delivered — booking sync is best-effort.
    }
  }

  if (results.length === 1) return results[0]!;
  const note = results.map((item) => item.note).join("\n\n---\n\n");
  return { results, note };
}

/** Short select-summary note when the chosen room is not live GDS. */
function selectSkipRecheckNote(
  rateSourceCode: string | null | undefined,
): string {
  if (rateSourceCode === "offline_contracted") {
    return "Contracted rate — no live price recheck needed. Cost stays as on file.";
  }
  if (rateSourceCode === "offline_manual") {
    return "Pasted supplier quote — no live price recheck. Confirm the supplier still honors this price if the quote is old.";
  }
  return "This rate source does not support live price recheck — confirm the price with the supplier before booking.";
}

/**
 * After quote_select_final / quote_accept_and_select:
 * - Live GDS → recheck today's Sabre price, auto-apply cost when it moved.
 * - Contracted / pasted / other → short note that no live recheck is needed.
 * Always returns a short agent summary line.
 */
export async function recheckLiveGdsOnSelect(
  tripId: string,
  lineItemId: string,
  rateSourceCode: string | null | undefined,
  actor: { memberId: string },
): Promise<string | null> {
  if (!needsLivePriceRecheck(rateSourceCode)) {
    return selectSkipRecheckNote(rateSourceCode);
  }

  let result: PriceRecheckResult;
  try {
    const raw = await recheckChosenRate({ tripId, lineItemId }, actor);
    if ("results" in raw) {
      const first = raw.results[0];
      if (!first) {
        return "Live GDS price recheck could not be completed — verify today's price before booking with the hotel.";
      }
      result = first;
    } else {
      result = raw;
    }
  } catch {
    return "Live GDS price recheck could not be completed — verify today's price before booking with the hotel.";
  }

  if (result.update) {
    try {
      await updateStayOption(lineItemId, {
        cost_internal: result.update.amount,
      });
      await syncClientPriceFromChoices(tripId);
      await refreshTripAfterRateChange(tripId, actor);
    } catch {
      return `Live GDS price recheck: today's cost is ${money(result.cost_today, result.currency_today)}, but the room cost could not be updated automatically — use today's cost before booking.`;
    }
    const today = money(result.cost_today, result.currency_today);
    const prior = money(result.cost_on_file, result.currency_on_file);
    return `Live GDS price recheck: cost moved from ${prior} to ${today}. Room and pending booking now use today's cost. Sell is unchanged — adjust if needed.`;
  }

  if (result.status === "unchanged") {
    const amount = money(
      result.cost_today ?? result.cost_on_file,
      result.currency_today ?? result.currency_on_file,
    );
    return `Live GDS price recheck: today's cost matches the quote (${amount}).`;
  }

  if (result.status === "unavailable" || result.requires_reshop) {
    return "Live GDS price recheck: this rate may no longer be bookable — search rates again for that hotel before confirming.";
  }

  if (result.status === "changed") {
    return `Live GDS price recheck: today's cost is ${money(result.cost_today, result.currency_today)} — compare with the hotel before booking (currency or amount differs).`;
  }

  if (result.status === "error") {
    return "Live GDS price recheck failed — verify today's price before booking with the hotel.";
  }

  return null;
}
