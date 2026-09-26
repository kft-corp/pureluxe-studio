import type { AdapterResult } from "../adapters/types";
import type {
  AdapterRunSummary,
  NormalizedRateOption,
  RateRoutingMeta,
  SearchRatesResult,
  SearchRatesStatus,
} from "../types";

export const EMPTY_ROUTING: RateRoutingMeta = {
  layer: null,
  pattern: null,
  destination_type: null,
  destination_profile_id: null,
  sources_tried: [],
};

/** Always-complete search envelope — no missing keys. */
export function buildSearchRatesResult(input: {
  status: SearchRatesStatus;
  options?: NormalizedRateOption[];
  routing?: RateRoutingMeta;
  message?: string | null;
  adapterResults?: AdapterResult[];
}): SearchRatesResult {
  const adapters: AdapterRunSummary[] = (input.adapterResults ?? []).map(
    (result) => ({
      source: result.source,
      status: result.status,
      quote_count: result.quotes.length,
      message: result.message?.trim() || null,
    }),
  );

  const message =
    typeof input.message === "string" && input.message.trim()
      ? input.message.trim()
      : null;

  return {
    status: input.status,
    options: input.options ?? [],
    routing: {
      layer: input.routing?.layer ?? null,
      pattern: input.routing?.pattern ?? null,
      destination_type: input.routing?.destination_type ?? null,
      destination_profile_id: input.routing?.destination_profile_id ?? null,
      sources_tried: [...(input.routing?.sources_tried ?? [])],
    },
    message,
    adapters,
  };
}
