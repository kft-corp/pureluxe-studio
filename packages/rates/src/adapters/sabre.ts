import type { RateSourceCode } from "../types";
import type { AdapterContext, AdapterResult } from "./types";

/**
 * Stub: Sabre GDS (public or negotiated). Live API later.
 */
export async function searchSabre(
  ctx: AdapterContext,
  source: Extract<RateSourceCode, "gds_public" | "gds_negotiated">,
): Promise<AdapterResult> {
  void ctx;
  return {
    source,
    status: "stub",
    quotes: [],
    message: `Sabre (${source}) not configured — live API comes later.`,
  };
}
