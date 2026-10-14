import type { PropertyContractedRate } from "../../schema";

/** Nights in [check_in, check_out) as YYYY-MM-DD. */
export function stayNightCount(checkIn: string, checkOut: string): number {
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  const nights = Math.round(
    (Date.UTC(y2!, m2! - 1, d2!) - Date.UTC(y1!, m1! - 1, d1!)) / 86_400_000,
  );
  return nights > 0 ? nights : 0;
}

export type ComputeContractedStayCostInput = {
  rate: PropertyContractedRate;
  check_in: string;
  check_out: string;
  adults?: number;
};

/** Net stay cost for a contracted rate row → quote cost_internal. */
export function computeContractedStayCost(
  input: ComputeContractedStayCostInput,
): number {
  const amount = Number(input.rate.cost_amount);
  if (!Number.isFinite(amount) || amount < 0) return 0;

  const nights = stayNightCount(input.check_in, input.check_out);
  const adults =
    input.adults && input.adults > 0
      ? input.adults
      : input.rate.base_adults > 0
        ? input.rate.base_adults
        : 2;

  if (input.rate.cost_unit === "per_night") {
    return amount * Math.max(nights, 1);
  }
  if (input.rate.cost_unit === "per_person") {
    return amount * adults;
  }
  if (input.rate.cost_unit === "package") {
    const packageNights = input.rate.package_nights;
    const extraRaw = input.rate.extra_night_amount;
    const extra = extraRaw == null ? null : Number(extraRaw);
    if (
      packageNights != null &&
      nights > packageNights &&
      extra != null &&
      Number.isFinite(extra) &&
      extra >= 0
    ) {
      return amount + (nights - packageNights) * extra;
    }
    return amount;
  }

  // per_stay (default)
  return amount;
}

/**
 * A fixed package with no extra-night amount only covers that package length.
 * A package with an extra-night amount covers that length and longer.
 * Nightly and per-stay rates cover any stay that meets the minimum.
 */
export function contractedRateCoversStay(
  rate: PropertyContractedRate,
  nights: number,
): boolean {
  if (nights <= 0) return false;
  if (rate.min_nights != null && nights < rate.min_nights) return false;
  if (rate.cost_unit !== "package") return true;

  const packageNights = rate.package_nights;
  if (packageNights == null || packageNights <= 0) return true;

  const extra =
    rate.extra_night_amount == null ? null : Number(rate.extra_night_amount);
  const hasExtra = extra != null && Number.isFinite(extra) && extra >= 0;
  if (hasExtra) return nights >= packageNights;
  return nights === packageNights;
}
