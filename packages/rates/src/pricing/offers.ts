import type { PropertyContractOffer } from "@pureluxe/db";

import { previousCalendarDay, stayNights, roundMoney } from "./dates";

export type AppliedOffer = {
  name: string;
  offer_type: string;
  villa_discount: number;
  transfer_discount_percent: number;
  free_board: string | null;
};

function excludedRoom(
  excluded: unknown,
  roomCategory: string | null,
): boolean {
  if (!Array.isArray(excluded) || excluded.length === 0) return false;
  if (!roomCategory) return false;
  const names = excluded
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase());
  return names.includes(roomCategory.trim().toLowerCase());
}

function blackoutHits(blackouts: unknown, nights: string[]): boolean {
  if (!Array.isArray(blackouts) || blackouts.length === 0) return false;
  const dates = new Set(
    blackouts
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim()),
  );
  return nights.some((night) => dates.has(night));
}

/** Villa % offers must cover the whole stay so a cross-season trip is not under-discounted. */
function coversWholeStay(
  validFrom: string | null,
  validTo: string | null,
  checkIn: string,
  checkOut: string,
): boolean {
  const lastNight = previousCalendarDay(checkOut);
  const fromOk = validFrom == null || validFrom <= checkIn;
  const toOk = validTo == null || validTo >= lastNight;
  return fromOk && toOk;
}

function offerQualifies(
  offer: PropertyContractOffer,
  input: {
    check_in: string;
    check_out: string;
    room_category: string | null;
    nights: number;
    book_as_of: string;
  },
): boolean {
  const nights = stayNights(input.check_in, input.check_out);
  if (
    !coversWholeStay(
      offer.valid_from,
      offer.valid_to,
      input.check_in,
      input.check_out,
    )
  ) {
    return false;
  }
  if (offer.min_nights != null && input.nights < offer.min_nights) return false;
  if (offer.book_by != null && input.book_as_of > offer.book_by) return false;
  if (excludedRoom(offer.excluded_room_categories, input.room_category)) {
    return false;
  }
  if (blackoutHits(offer.blackout_dates, nights)) return false;
  return true;
}

/**
 * Apply qualifying offers inside the all-in price (R9).
 * percent_off_villa reduces room cost; transfer_discount_percent is returned
 * for callers to apply to transfer extras; free_board is recorded only.
 */
export function applyQualifyingOffers(input: {
  offers: PropertyContractOffer[];
  room_cost: number;
  room_category: string | null;
  check_in: string;
  check_out: string;
  contract_id: string | null;
  /** YYYY-MM-DD; defaults to today UTC when omitted. */
  book_as_of?: string;
}): { room_after_offers: number; applied: AppliedOffer[] } {
  const nights = stayNights(input.check_in, input.check_out).length;
  const bookAsOf =
    input.book_as_of ?? new Date().toISOString().slice(0, 10);

  const candidates = input.offers.filter(
    (offer) =>
      (input.contract_id == null ||
        offer.contract_id == null ||
        offer.contract_id === input.contract_id) &&
      offerQualifies(offer, {
        check_in: input.check_in,
        check_out: input.check_out,
        room_category: input.room_category,
        nights,
        book_as_of: bookAsOf,
      }),
  );

  if (candidates.length === 0) {
    return { room_after_offers: input.room_cost, applied: [] };
  }

  // Prefer the best villa percent (not stacked unless flagged combinable).
  const withPercent = candidates
    .filter(
      (offer) =>
        offer.offer_type === "percent_off_villa" &&
        offer.percent_off_villa != null &&
        Number(offer.percent_off_villa) > 0,
    )
    .sort(
      (a, b) => Number(b.percent_off_villa) - Number(a.percent_off_villa),
    );

  const applied: AppliedOffer[] = [];
  let roomCost = input.room_cost;
  let transferDiscount = 0;
  let freeBoard: string | null = null;

  const primary = withPercent[0];
  if (primary) {
    const pct = Number(primary.percent_off_villa);
    const discount = roundMoney(roomCost * (pct / 100));
    roomCost = roundMoney(roomCost - discount);
    transferDiscount = Math.max(
      transferDiscount,
      Number(primary.transfer_discount_percent ?? 0) || 0,
    );
    if (primary.free_board) freeBoard = primary.free_board;
    applied.push({
      name: primary.name,
      offer_type: primary.offer_type,
      villa_discount: discount,
      transfer_discount_percent: Number(primary.transfer_discount_percent ?? 0) || 0,
      free_board: primary.free_board,
    });

    const combinable = primary.combinable_flags?.combinable_with_family === true;
    if (combinable) {
      for (const next of withPercent.slice(1)) {
        if (next.combinable_flags?.combinable_with_family !== true) continue;
        const nextPct = Number(next.percent_off_villa);
        const nextDiscount = roundMoney(roomCost * (nextPct / 100));
        roomCost = roundMoney(roomCost - nextDiscount);
        applied.push({
          name: next.name,
          offer_type: next.offer_type,
          villa_discount: nextDiscount,
          transfer_discount_percent:
            Number(next.transfer_discount_percent ?? 0) || 0,
          free_board: next.free_board,
        });
        transferDiscount = Math.max(
          transferDiscount,
          Number(next.transfer_discount_percent ?? 0) || 0,
        );
        if (next.free_board) freeBoard = next.free_board;
      }
    }
  }

  for (const offer of candidates) {
    if (applied.some((row) => row.name === offer.name)) continue;
    if (
      offer.offer_type === "free_board_upgrade" ||
      offer.offer_type === "transfer_discount" ||
      offer.offer_type === "family" ||
      (offer.free_board && !freeBoard) ||
      (offer.transfer_discount_percent != null &&
        Number(offer.transfer_discount_percent) > transferDiscount)
    ) {
      const xfer = Number(offer.transfer_discount_percent ?? 0) || 0;
      transferDiscount = Math.max(transferDiscount, xfer);
      if (offer.free_board) freeBoard = offer.free_board;
      applied.push({
        name: offer.name,
        offer_type: offer.offer_type,
        villa_discount: 0,
        transfer_discount_percent: xfer,
        free_board: offer.free_board,
      });
    }
  }

  if (transferDiscount > 0 && applied.length > 0) {
    for (const row of applied) {
      row.transfer_discount_percent = Math.max(
        row.transfer_discount_percent,
        transferDiscount,
      );
    }
  }

  return { room_after_offers: roomCost, applied };
}

/** Apply transfer discount percent to transfer-type extras. */
export function applyTransferDiscount(
  extras: { name: string; amount: number; addon_type: string }[],
  transferDiscountPercent: number,
): { name: string; amount: number; addon_type: string }[] {
  if (!(transferDiscountPercent > 0)) return extras;
  return extras.map((extra) => {
    if (extra.addon_type !== "transfer") return extra;
    const discounted = roundMoney(
      extra.amount * (1 - transferDiscountPercent / 100),
    );
    return { ...extra, amount: discounted };
  });
}
