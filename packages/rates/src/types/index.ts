/**
 * Rate Layer domain types.
 * Spec: docs/studio/rate-layer.md
 *
 * Config row shapes stay in @pureluxe/db. These types are the request/result
 * language for searchRatesForLeg / resolveRates.
 */

export {
  RATE_SOURCE_CODES,
  type RateSourceCode,
} from "./source-codes";

export type {
  DestinationRoutingPattern,
  DestinationType,
  Layer2Pattern,
  RateRoutingMeta,
  RoutingLayer,
  RoutingPattern,
} from "./routing";

export type {
  AdapterRunSummary,
  NormalizedRateOption,
  RateSearchChannel,
  SearchRatesRequest,
  SearchRatesResult,
  SearchRatesStatus,
} from "./search";
