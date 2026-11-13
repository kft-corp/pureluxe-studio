import type { HotelPriceTier } from "../schema";

const TIERS = new Set<HotelPriceTier>(["Tier 1", "Tier 2", "Tier 3"]);

const LEGACY_TIER: Record<string, HotelPriceTier> = {
  ultra_luxury: "Tier 1",
  luxury: "Tier 2",
  premium: "Tier 3",
};

/** Map Atlas luxury_band / sheet values onto HotelPriceTier (Tier 1–3). */
export function asHotelPriceTier(
  value: string | null | undefined,
): HotelPriceTier | null {
  if (!value) return null;
  if (TIERS.has(value as HotelPriceTier)) return value as HotelPriceTier;
  return LEGACY_TIER[value] ?? null;
}

export const HOTEL_PRICE_TIER_RANK: Record<HotelPriceTier, number> = {
  "Tier 1": 3,
  "Tier 2": 2,
  "Tier 3": 1,
};
