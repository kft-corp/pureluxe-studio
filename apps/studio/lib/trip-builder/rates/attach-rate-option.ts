import {
  findFirstTripLeg,
  findStayShellLineItem,
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
import { defaultRoomCount } from "../trip/resolve-dates";

import { selectAccommodationRate } from "./select-accommodation-rate";

function partyCount(value: unknown, allowZero = false): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  if (!allowZero && value <= 0) return null;
  return Math.floor(value);
}

/**
 * Freeze stay party onto the option raw so pending booking sync does not
 * depend on an open rate search (contracted, Sabre, or future suppliers).
 */
async function withFrozenParty(
  tripId: string,
  legId: string | null,
  option: NormalizedRateOption,
): Promise<NormalizedRateOption> {
  const raw = { ...(option.raw ?? {}) };
  if (typeof raw.rooms === "number" && raw.rooms > 0) return { ...option, raw };

  let rooms: number | null = null;
  let adults: number | null = null;
  let children: number | null = null;
  if (legId) {
    const shell = await findStayShellLineItem(tripId, legId);
    const extracted = shell?.extracted_json;
    if (extracted && typeof extracted === "object") {
      rooms = partyCount(extracted.rooms);
      adults = partyCount(extracted.adults);
      children = partyCount(extracted.children, true);
    }
  }
  const resolvedRooms = rooms ?? defaultRoomCount(adults ?? 2);
  return {
    ...option,
    raw: {
      ...raw,
      rooms: resolvedRooms,
      ...(adults != null ? { adults } : {}),
      ...(children != null ? { children } : {}),
    },
  };
}

function readQuoteMeta(raw: Record<string, unknown> | null | undefined): {
  sell_amount?: number | null;
  markup_percent?: number | null;
  option_rank?: number | null;
  rate_search_result_id?: string | null;
  added_via?: "agent" | "button" | "paste" | "manual" | null;
} {
  const meta = raw?.quote_meta;
  if (!meta || typeof meta !== "object") return {};
  const row = meta as Record<string, unknown>;
  return {
    sell_amount: typeof row.sell_amount === "number" ? row.sell_amount : undefined,
    markup_percent: typeof row.markup_percent === "number" ? row.markup_percent : null,
    option_rank: typeof row.option_rank === "number" ? row.option_rank : null,
    rate_search_result_id:
      typeof row.rate_search_result_id === "string" ? row.rate_search_result_id : null,
    added_via:
      row.added_via === "agent" ||
      row.added_via === "button" ||
      row.added_via === "paste" ||
      row.added_via === "manual"
        ? row.added_via
        : null,
  };
}

function cancelFamilyKey(summary: string | null | undefined): string {
  const text = summary?.toLowerCase() ?? "";
  if (/non[\s-]?refundable|no refund/.test(text)) return "non_refundable";
  if (/free cancel|refundable/.test(text)) return "refundable";
  return "other";
}

/**
 * Attach a search option as a trip line item.
 * When select=true, marks it as the selected accommodation for the leg.
 *
 * Uniqueness: prefer rate_search_result_id so two "Twin" rates (non-refund vs
 * free cancel) can both sit on the quote. Name-only dedupe is last resort.
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

  const optionWithParty = await withFrozenParty(
    input.trip_id,
    legId,
    input.option as NormalizedRateOption,
  );
  const draft = toLineItemFields(optionWithParty);
  const quoteMeta = readQuoteMeta(optionWithParty.raw);
  const resultId = quoteMeta.rate_search_result_id?.trim() || null;

  if (legId) {
    const saved = await listPricedAccommodationLineItems(input.trip_id, legId);
    const duplicate = saved.find((row) => {
      if (resultId && row.rate_search_result_id) {
        return row.rate_search_result_id === resultId;
      }
      if (resultId) return false;

      const sameHotel =
        (row.property_name ?? "").trim().toLowerCase() ===
        (draft.property_name ?? "").trim().toLowerCase();
      if (!sameHotel) return false;

      const sameRoom =
        (row.subtitle ?? row.title).trim().toLowerCase() ===
        (draft.subtitle ?? draft.title).trim().toLowerCase();
      if (!sameRoom) return false;

      const costClose =
        Math.abs(Number(row.cost_internal) - Number(draft.cost_internal)) <= 0.05;
      if (!costClose) return false;

      return (
        cancelFamilyKey(row.cancellation_policy) ===
        cancelFamilyKey(draft.cancellation_policy)
      );
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
    sell_amount: quoteMeta.sell_amount,
    markup_percent: quoteMeta.markup_percent,
    option_rank: quoteMeta.option_rank,
    rate_search_result_id: quoteMeta.rate_search_result_id,
    added_via: quoteMeta.added_via,
  });

  if (!input.select || !legId) {
    await markQuoteStale(input.trip_id);
    return created;
  }

  return selectAccommodationRate(created.id, actor);
}
