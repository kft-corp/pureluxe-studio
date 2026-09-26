import type { AdapterContext, AdapterResult } from "./types";

/**
 * Stub: Hotelbeds / OTA bedbank. Live API later.
 */
export async function searchHotelbeds(
  ctx: AdapterContext,
): Promise<AdapterResult> {
  void ctx;
  return {
    source: "ota_bedbank",
    status: "stub",
    quotes: [],
    message: "Hotelbeds not configured — live API comes later.",
  };
}
