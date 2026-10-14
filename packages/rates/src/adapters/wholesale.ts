import type { AdapterContext, AdapterResult } from "./types";

/**
 * Stub: destination wholesaler partner API. Live API later.
 */
export async function searchWholesale(
  ctx: AdapterContext,
): Promise<AdapterResult> {
  const names =
    ctx.wholesalers?.map((w) => w.wholesaler_name).filter(Boolean) ?? [];
  const who = names.length > 0 ? names.join(", ") : "no partner mapped";

  return {
    source: "wholesale",
    status: "stub",
    quotes: [],
    message: `Wholesale not configured (${who}) — live API comes later.`,
  };
}
