import type { SearchRatesRequest, SearchRatesResult } from "../types";

import { searchRatesForLeg } from "./search-rates-for-leg";

/**
 * Product-facing name (docs/rate-layer.md).
 * Implementation lives in searchRatesForLeg — prefer that for new Studio code.
 */
export async function resolveRates(
  request: SearchRatesRequest,
): Promise<SearchRatesResult> {
  return searchRatesForLeg(request);
}
