/**
 * @pureluxe/rates — shared Rate Layer brain for Studio and (later) Client App.
 * Spec: docs/studio/rate-layer.md
 *
 * Layout:
 *   search/     — public entry
 *   resolve/    — destination + layer + adapter plan
 *   results/    — normalize, rank, margin, guest
 *   pricing/    — contracted math
 *   offline/    — paste + contract policy helpers
 *   adapters/   — plan orchestration + offline adapters
 *   suppliers/  — Sabre / Hotelbeds / wholesale I/O
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
  taxPercentageFromRaw,
  toLineItemFields,
  toLineItemFieldsList,
  type GuestRate,
  type LineItemFields,
  type MarginResult,
  type NormalizeRateDefaults,
  type RawRateInput,
} from "./results";

export {
  cancellationLinesFromPolicies,
  cancellationLinesFromPoliciesV2,
  cancellationSummaryFromPolicies,
  checkOfflineAvailability,
  isPoliciesV2,
  parseOfflineQuote,
  readContractPolicies,
  upgradePoliciesToV2,
  type ContractPoliciesV2,
  type OfflineAvailabilityInput,
  type OfflineAvailabilityResult,
  type ParseOfflineQuoteInput,
  type ParseOfflineQuoteResult,
  type PolicyAudience,
  type PolicyRuleV2,
} from "./offline";

export {
  runAdapterPlan,
  searchOfflineContracted,
  searchOfflineManual,
  type AdapterContext,
  type AdapterResult,
  type AdapterResultStatus,
  type RateAdapter,
  type RunAdapterPlanResult,
} from "./adapters";

export {
  buildSabreBasicAuth,
  clearSabreAccessTokenCache,
  defaultDiscoverStayDates,
  getSabreAccessToken,
  getSabreConfig,
  hotelPriceCheck,
  isSabreConfigured,
  isSabreOpenGdsBrowseEnabled,
  mapHotelDetailsToQuotes,
  mapHotelDiscoverToCandidates,
  isSabreReshopSignal,
  mapHotelPriceCheckResponse,
  mapHotelRatesToQuotes,
  openGdsMinSabreRating,
  priceCheckSabreRate,
  sabreLog,
  sabreRequest,
  SabreHttpError,
  searchHotelbeds,
  searchHotelDetailsByCode,
  searchHotelRatesByCode,
  searchHotelsByAirport,
  searchHotelsByGeo,
  searchSabre,
  searchWholesale,
  type HotelPriceCheckInput,
  type MapHotelDetailsToQuotesInput,
  type MapHotelRatesToQuotesInput,
  type PriceCheckSabreInput,
  type PriceCheckSabreResult,
  type SabreConfig,
  type SabreDiscoverHotel,
  type SabrePriceCheckFailureReason,
  type SabrePriceCheckMapped,
  type SabreRequestOptions,
  type SearchHotelDetailsByCodeInput,
  type SearchHotelRatesByCodeInput,
  type SearchHotelsByAirportInput,
  type SearchHotelsByGeoInput,
  type SearchHotelRatesStay,
  buildMatchingRoomOccupancies,
  distributeAdultsAcrossRooms,
  formatOccupancyShopLabel,
  groupRoomOccupanciesForSabreShops,
  hasUniformSabrePax,
  mergeSabreOccupancyShopQuotes,
  needsRoomOccupancySplit,
  validateRoomOccupancies,
  type RoomOccupancy,
  type RoomOccupancyValidation,
  type SabreOccupancyShopGroup,
} from "./suppliers";

export { resolveRates, searchRatesForLeg } from "./search";

export {
  ASSUMED_CHILD_AGE,
  applyQualifyingOffers,
  applyServiceChargeAndTax,
  applyTransferDiscount,
  childAgesAffectPrice,
  computeRoomStayCost,
  contractAllowedForMarket,
  coversNight,
  listPricableRoomCategories,
  mandatoryExtraCharges,
  occupancyExtraCharges,
  overlapsStay,
  partyFitsRate,
  priceContractedRoom,
  previousCalendarDay,
  rateForNight,
  roomFitsOccupancy,
  roundMoney,
  occupancyLimitsUnknown,
  partyRoomsFromOccupancies,
  splitPartyAcrossRooms,
  stayNights,
  type AppliedExtra,
  type AppliedOffer,
  type ContractedAllInPrice,
  type PartyRoom,
  type PriceContractedRoomInput,
  type PriceContractedRoomResult,
  type PriceScope,
} from "./pricing";

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
