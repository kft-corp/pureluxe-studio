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
    const extra = Number(input.rate.extra_night_amount);
    if (
      packageNights != null &&
      nights > packageNights &&
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
