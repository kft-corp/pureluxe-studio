import type { ClientSearchHit } from "@pureluxe/ai";

/** Shape returned by Studio `searchClients` directory helper. */
type StudioClientSearchRow = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  review_status: string;
  family_id: string | null;
  tier: { slug: string; label: string };
};

/** Map a Studio search row → AI tool hit (same fields every time). */
export function toClientSearchHit(client: StudioClientSearchRow): ClientSearchHit {
  return {
    id: client.id,
    display_name: client.display_name,
    email: client.email,
    phone: client.phone,
    tier: {
      slug: client.tier.slug,
      label: client.tier.label,
    },
    review_status: client.review_status,
    household_id: client.family_id,
  };
}
