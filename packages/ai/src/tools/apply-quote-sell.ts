import type { TripFacts, TripRateFact } from "../types";

import type { RateCompareCard, RateCompareRoom } from "./rate-compare";

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function roomTitleScore(candidateTitle: string, needle: string): number {
  const title = norm(candidateTitle);
  const want = norm(needle);
  if (!title || !want) return 0;
  if (title === want) return 10_000;
  const lengthGap = Math.abs(title.length - want.length);
  const near = lengthGap <= 24;
  if (near && (title.startsWith(want) || want.startsWith(title))) return 5_000 - lengthGap;
  if (near && title.includes(want)) return 3_000 - lengthGap;
  if (near && want.includes(title)) return 1_000 - lengthGap;
  return 0;
}

function quoteRoomTitle(rate: TripRateFact): string {
  return rate.subtitle?.trim() || rate.title;
}

function bestQuoteRate(candidates: TripRateFact[], roomName: string): TripRateFact | null {
  let best: TripRateFact | null = null;
  let bestScore = 0;
  let tied = false;
  for (const rate of candidates) {
    const score = roomTitleScore(quoteRoomTitle(rate), roomName);
    if (score === 0) continue;
    if (score > bestScore) {
      best = rate;
      bestScore = score;
      tied = false;
    } else if (score === bestScore) {
      tied = true;
    }
  }
  if (!best || bestScore === 0 || (tied && bestScore < 10_000)) return null;
  return best;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * When rooms are already on the options quote with a sell, paint Sell on the
 * rates table instead of "Set markup" (shopping table after a re-search).
 */
export function applyQuoteSellToCompare(
  compare: RateCompareCard,
  trip: TripFacts | null,
): RateCompareCard {
  const priced = (trip?.rates.candidates ?? []).filter((rate) => rate.sell_amount != null);
  if (priced.length === 0) return compare;

  const nights = compare.nights != null && compare.nights > 0 ? compare.nights : null;

  return {
    ...compare,
    hotels: compare.hotels.map((hotel) => ({
      ...hotel,
      rooms: hotel.rooms.map((room) => paintRoomSell(room, priced, nights)),
    })),
  };
}

function paintRoomSell(
  room: RateCompareRoom,
  priced: TripRateFact[],
  nights: number | null,
): RateCompareRoom {
  if (room.client_total != null && room.markup_percent != null) return room;
  const hit = bestQuoteRate(priced, room.room_name);
  const sell = hit?.sell_amount;
  if (sell == null || !Number.isFinite(sell)) return room;
  const cost = room.team_cost;
  const markup =
    cost > 0 ? roundMoney(((sell - cost) / cost) * 100) : room.markup_percent;
  const nightCount = nights != null && nights > 0 ? nights : 1;
  const extraTeam = room.extra_night_team;
  return {
    ...room,
    client_total: sell,
    client_per_night: roundMoney(sell / nightCount),
    markup_percent: markup,
    extra_night_client:
      extraTeam != null && markup != null
        ? roundMoney(extraTeam * (1 + markup / 100))
        : room.extra_night_client,
  };
}
