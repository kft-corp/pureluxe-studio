import {
  computeContractedStayCost,
  contractedRateCoversStay,
  stayNightCount,
  type PropertyContractedRate,
} from "@pureluxe/db";

import { coversNight, roundMoney, stayNights } from "./dates";

/**
 * Pick the rate row that covers a night for a room category.
 * Prefer the tightest season window, then lower sort_order.
 */
export function rateForNight(
  rates: PropertyContractedRate[],
  roomCategory: string | null,
  night: string,
): PropertyContractedRate | null {
  const covering = rates.filter(
    (rate) =>
      (rate.room_category ?? null) === (roomCategory ?? null) &&
      rate.rate_basis !== "package" &&
      coversNight(rate.valid_from, rate.valid_to, night),
  );
  if (covering.length === 0) return null;

  covering.sort((a, b) => {
    const aSpan = spanDays(a.valid_from, a.valid_to);
    const bSpan = spanDays(b.valid_from, b.valid_to);
    if (aSpan !== bSpan) return aSpan - bSpan;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return covering[0] ?? null;
}

function spanDays(from: string | null, to: string | null): number {
  if (from == null || to == null) return Number.MAX_SAFE_INTEGER;
  return stayNightCount(from, addOneDay(to));
}

function addOneDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

/** Stay cost for ranking package rows without needing real calendar dates. */
function packageStayCostForNights(
  rate: PropertyContractedRate,
  stayNightsCount: number,
): number | null {
  const amount = Number(rate.cost_amount);
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (rate.cost_unit !== "package") return amount;

  const packageNights = rate.package_nights;
  const extraRaw = rate.extra_night_amount;
  const extra = extraRaw == null ? null : Number(extraRaw);
  if (
    packageNights != null &&
    stayNightsCount > packageNights &&
    extra != null &&
    Number.isFinite(extra) &&
    extra >= 0
  ) {
    return amount + (stayNightsCount - packageNights) * extra;
  }
  return amount;
}

/**
 * Prefer an exact package length for the stay; otherwise the cheapest covering
 * package (package + extra nights). Avoids 3N+extra when a 4N package exists.
 */
function pickPackageRate(
  categoryRates: PropertyContractedRate[],
  stayNightsCount: number,
): PropertyContractedRate | null {
  const covering = categoryRates.filter(
    (rate) =>
      rate.rate_basis === "package" &&
      contractedRateCoversStay(rate, stayNightsCount),
  );
  if (covering.length === 0) return null;

  const exact = covering.filter(
    (rate) => rate.package_nights != null && rate.package_nights === stayNightsCount,
  );
  const pool = exact.length > 0 ? exact : covering;

  let best: PropertyContractedRate | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  for (const rate of pool) {
    const cost = packageStayCostForNights(rate, stayNightsCount);
    if (cost == null) continue;
    const sort = rate.sort_order ?? 0;
    const bestSort = best?.sort_order ?? 0;
    if (
      best == null ||
      cost < bestCost - 0.001 ||
      (Math.abs(cost - bestCost) <= 0.001 && sort < bestSort)
    ) {
      best = rate;
      bestCost = cost;
    }
  }
  return best;
}

/**
 * Base room cost for one room (no extras / tax / offers).
 * Nightly rates are summed night-by-night across seasons (R1).
 * Package rates keep the whole-stay rule.
 */
export function computeRoomStayCost(input: {
  rates: PropertyContractedRate[];
  room_category: string | null;
  check_in: string;
  check_out: string;
  adults: number;
}): { cost: number; rate_ids: string[]; seasons: string[] } | null {
  const nights = stayNights(input.check_in, input.check_out);
  if (nights.length === 0) return null;

  const categoryRates = input.rates.filter(
    (rate) => (rate.room_category ?? null) === (input.room_category ?? null),
  );
  if (categoryRates.length === 0) return null;

  const packageRate = pickPackageRate(categoryRates, nights.length);
  if (packageRate) {
    return {
      cost: roundMoney(
        computeContractedStayCost({
          rate: packageRate,
          check_in: input.check_in,
          check_out: input.check_out,
          adults: input.adults,
        }),
      ),
      rate_ids: [packageRate.id],
      seasons: packageRate.season_code ? [packageRate.season_code] : [],
    };
  }

  let cost = 0;
  const rateIds = new Set<string>();
  const seasons = new Set<string>();

  for (const night of nights) {
    const rate = rateForNight(categoryRates, input.room_category, night);
    if (!rate) return null;

    rateIds.add(rate.id);
    if (rate.season_code) seasons.add(rate.season_code);

    const amount = Number(rate.cost_amount);
    if (!Number.isFinite(amount) || amount < 0) return null;

    if (rate.cost_unit === "per_person") {
      cost += amount * Math.max(input.adults, 1);
    } else if (rate.cost_unit === "per_stay") {
      // Unusual for nightly rows; spread evenly so a cross-season stay still prices.
      cost += amount / nights.length;
    } else {
      // per_night (default for nightly basis)
      cost += amount;
    }
  }

  return {
    cost: roundMoney(cost),
    rate_ids: [...rateIds],
    seasons: [...seasons],
  };
}

/** Room categories that can be priced for every night of the stay (or as a package). */
export function listPricableRoomCategories(
  rates: PropertyContractedRate[],
  checkIn: string,
  checkOut: string,
): string[] {
  const nights = stayNights(checkIn, checkOut);
  if (nights.length === 0) return [];

  const categories = [
    ...new Set(rates.map((rate) => rate.room_category ?? "")),
  ];

  return categories.filter((category) => {
    const key = category || null;
    const sample = computeRoomStayCost({
      rates,
      room_category: key,
      check_in: checkIn,
      check_out: checkOut,
      adults: 2,
    });
    return sample != null;
  });
}
