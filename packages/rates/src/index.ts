/**
 * @pureluxe/rates — shared Rate Layer brain for Studio and (later) Client App.
 * Spec: docs/studio/rate-layer.md
 *
 * Layout (MVP, mirrors @pureluxe/auth use-case folders):
 *   search/   — public entry
 *   resolve/  — destination + layer + adapter plan
 *   results/  — normalize, rank, margin, guest
 *   offline/  — paste path
 *   adapters/ — supplier I/O (next slice)
 *   types/ + errors/
 */

export { ratesError, ratesNotWiredError } from "./errors";

export {
  buildAdapterPlan,
  LAYER4_DEFAULT_PATTERN,
  resolveDestinationProfile,
  resolveRoutingLayer,
  type AdapterPlan,
  type AdapterStep,
  type AdapterStepRole,
  type ResolveRoutingInput,
  type ResolvedDestination,
  type ResolvedRouting,
} from "./resolve";

export {
  buildSearchRatesResult,
  computeMargin,
  EMPTY_ROUTING,
  normalizeRate,
  rankAndRecommend,
  toGuestRate,
  toGuestRates,
  toLineItemFields,
  toLineItemFieldsList,
  type GuestRate,
  type LineItemFields,
  type MarginResult,
  type NormalizeRateDefaults,
  type RawRateInput,
} from "./results";

export {
  checkOfflineAvailability,
  parseOfflineQuote,
  type OfflineAvailabilityInput,
  type OfflineAvailabilityResult,
  type ParseOfflineQuoteInput,
  type ParseOfflineQuoteResult,
} from "./offline";

export {
  runAdapterPlan,
  searchHotelbeds,
  searchOfflineContracted,
  searchOfflineManual,
  searchSabre,
  searchWholesale,
  type AdapterContext,
  type AdapterResult,
  type AdapterResultStatus,
  type RateAdapter,
  type RunAdapterPlanResult,
} from "./adapters";

export { resolveRates, searchRatesForLeg } from "./search";

export {
  RATE_SOURCE_CODES,
  type AdapterRunSummary,
  type DestinationRoutingPattern,
  type DestinationType,
  type Layer2Pattern,
  type NormalizedRateOption,
  type RateRoutingMeta,
  type RateSearchChannel,
  type RateSourceCode,
  type RoutingLayer,
  type RoutingPattern,
  type SearchRatesRequest,
  type SearchRatesResult,
  type SearchRatesStatus,
} from "./types";
