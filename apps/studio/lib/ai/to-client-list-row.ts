import type { ClientListRow } from "@pureluxe/ai";

/** Shape of one Clients-directory row, as far as client_list needs it. */
type StudioClientDirectoryRow = {
  id: string;
  display_name: string;
  review_status: string;
  client_since: string | null;
  created_at: string;
  family_name: string | null;
  tier: { slug: string; label: string };
};

/** Map a Clients-directory row → client_list row. */
export function toClientListRow(client: StudioClientDirectoryRow): ClientListRow {
  return {
    id: client.id,
    display_name: client.display_name,
    tier: { slug: client.tier.slug, label: client.tier.label },
    review_status: client.review_status,
    added_on: client.created_at.slice(0, 10),
    client_since: client.client_since,
    household: client.family_name,
  };
}
