import type { DestinationWholesaler, PropertyContractedRate } from "@pureluxe/db";

import type { RawRateInput } from "../results";
import type { RateSourceCode, SearchRatesRequest } from "../types";

/** Shared input every adapter receives (ids come from the request, not invented). */
export type AdapterContext = {
  request: SearchRatesRequest;
  /** Set when resolve already found a Layer 1 contracted rate. */
  contracted_rate?: PropertyContractedRate | null;
  wholesalers?: DestinationWholesaler[];
};

export type AdapterResultStatus = "ok" | "empty" | "stub" | "needs_paste";

/** One adapter call — raw quotes before normalizeRate. */
export type AdapterResult = {
  source: RateSourceCode;
  status: AdapterResultStatus;
  quotes: RawRateInput[];
  message?: string;
};

export type RateAdapter = {
  source: RateSourceCode;
  search(ctx: AdapterContext): Promise<AdapterResult>;
};
