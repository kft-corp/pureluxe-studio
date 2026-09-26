import { cache } from "react";
import { unstable_cache } from "next/cache";
import {
  findClientTierById,
  findClientTierBySlug,
  findDefaultClientTier,
  listActiveClientTiers,
} from "@pureluxe/db";
import { AppError, clientMessages } from "@pureluxe/shared";

/** Active client tier for pickers (register, filters). */
export type ClientTierOption = {
  id: string;
  slug: string;
  label: string;
  isDefault: boolean;
};

/** Resolve tier_id from explicit id, slug, or DB default (Standard). */
export async function resolveClientTierId(input: {
  tier_id?: string | null;
  tier_slug?: string | null;
}): Promise<string> {
  if (input.tier_id) {
    const byId = await findClientTierById(input.tier_id);
    if (!byId || !byId.active) {
      throw new AppError({
        userMessage: clientMessages.error.invalidTier,
        code: "clients.invalid_tier",
        status: 400,
      });
    }
    return byId.id;
  }

  if (input.tier_slug) {
    const bySlug = await findClientTierBySlug(input.tier_slug);
    if (!bySlug || !bySlug.active) {
      throw new AppError({
        userMessage: clientMessages.error.invalidTier,
        code: "clients.invalid_tier",
        status: 400,
      });
    }
    return bySlug.id;
  }

  const fallback = await findDefaultClientTier();
  if (!fallback) {
    throw new AppError({
      userMessage: clientMessages.error.tierNotConfigured,
      code: "clients.tier_not_configured",
      status: 500,
    });
  }

  return fallback.id;
}

async function loadActiveClientTiers(): Promise<ClientTierOption[]> {
  const tiers = await listActiveClientTiers();
  return tiers.map((tier) => ({
    id: tier.id,
    slug: tier.slug,
    label: tier.label,
    isDefault: tier.is_default,
  }));
}

/**
 * Cross-navigation cache — warmed when Clients list loads filters,
 * reused when Register opens (no browser API call).
 */
const getCachedActiveClientTiers = unstable_cache(
  loadActiveClientTiers,
  ["active-client-tiers"],
  { revalidate: 300 },
);

/** Request-deduped + short-lived Next cache for active client tiers. */
export const getActiveClientTiers = cache(getCachedActiveClientTiers);

/** Default tier id for new clients (is_default, else first by rank). */
export function pickDefaultClientTierId(
  tiers: ClientTierOption[],
): string | null {
  if (tiers.length === 0) return null;
  return (tiers.find((tier) => tier.isDefault) ?? tiers[0]).id;
}
