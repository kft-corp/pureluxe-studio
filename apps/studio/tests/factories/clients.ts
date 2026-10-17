import type { ClientSearchHit } from "@/lib/api";

export function makeClientHit(
  partial: Partial<ClientSearchHit> & { id: string; display_name: string },
): ClientSearchHit {
  return {
    email: null,
    phone: null,
    tier_id: "tier-standard",
    tier: { id: "tier-standard", slug: "standard", label: "Standard", rank: 1 },
    review_status: "approved",
    family_id: null,
    ...partial,
  };
}
