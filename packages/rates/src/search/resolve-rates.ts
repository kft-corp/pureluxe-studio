import type { SearchRatesRequest, SearchRatesResult } from "../types";

import { searchRatesForLeg } from "./search-rates-for-leg";

/**
 * Alias for searchRatesForLeg — same brain, name used in product docs.
 */
export async function resolveRates(
  request: SearchRatesRequest,
): Promise<SearchRatesResult> {
  return searchRatesForLeg(request);
}
