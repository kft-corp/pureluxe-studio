import { parseOfflineQuote } from "../offline";
import type { AdapterContext, AdapterResult } from "./types";

/**
 * Real adapter: advisor paste → structured quote via parseOfflineQuote.
 */
export async function searchOfflineManual(
  ctx: AdapterContext,
): Promise<AdapterResult> {
  const { request } = ctx;
  const paste = request.paste_text?.trim() ?? "";

  if (!paste) {
    return {
      source: "offline_manual",
      status: "needs_paste",
      quotes: [],
      message: "Offline paste required — provide paste_text on the request.",
    };
  }

  const parsed = parseOfflineQuote({
    paste_text: paste,
    check_in: request.check_in,
    check_out: request.check_out,
    currency: request.currency,
    property_id: request.property_id,
    rate_source_code: "offline_manual",
  });

  if (!parsed.fields) {
    return {
      source: "offline_manual",
      status: "empty",
      quotes: [],
      message: parsed.warnings.join(" ") || "Could not parse offline paste.",
    };
  }

  return {
    source: "offline_manual",
    status: "ok",
    quotes: [parsed.fields],
    message:
      parsed.warnings.length > 0 ? parsed.warnings.join(" ") : undefined,
  };
}
