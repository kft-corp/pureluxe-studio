/**
 * Sabre supplier — live GDS shop (CERT/PROD).
 *
 * Layout:
 *   config/   — env / PCC
 *   client/   — auth + HTTP
 *   api/      — Sabre REST endpoint calls only
 *   mappers/  — supplier JSON → RawRateInput
 *   helpers/  — stay payload builders, parse helpers, errors
 *   adapter.ts — Rate Layer searchSabre entry
 *
 * Internal names are short (folder scopes Sabre). Prefixed aliases below are
 * for the package public API so Studio can tell suppliers apart.
 */

export { searchSabre } from "./adapter";
export {
  priceCheckSabreRate,
  type PriceCheckSabreInput,
  type PriceCheckSabreResult,
} from "./price-check";

export {
  hotelPriceCheck,
  searchHotelDetailsByCode,
  searchHotelRatesByCode,
  searchHotelsByAirport,
  searchHotelsByGeo,
  type HotelPriceCheckInput,
  type SearchHotelDetailsByCodeInput,
  type SearchHotelRatesByCodeInput,
  type SearchHotelsByAirportInput,
  type SearchHotelsByGeoInput,
} from "./api";

export {
  buildHotelSearchBody,
  buildRateInfoRef,
  defaultDiscoverStayDates,
  buildMatchingRoomOccupancies,
  distributeAdultsAcrossRooms,
  formatOccupancyShopLabel,
  groupRoomOccupanciesForSabreShops,
  hasUniformSabrePax,
  mergeSabreOccupancyShopQuotes,
  needsRoomOccupancySplit,
  sabreLog,
  validateRoomOccupancies,
  type BuildHotelSearchBodyInput,
  type HotelSearchGeoRef,
  type RoomOccupancy,
  type RoomOccupancyValidation,
  type SabreOccupancyShopGroup,
  type SearchHotelRatesStay,
} from "./helpers";

export {
  buildBasicAuthHeader,
  clearAccessTokenCache,
  getAccessToken,
  requestJson,
  SabreHttpError,
  type RequestJsonOptions,
  buildBasicAuthHeader as buildSabreBasicAuth,
  clearAccessTokenCache as clearSabreAccessTokenCache,
  getAccessToken as getSabreAccessToken,
  requestJson as sabreRequest,
  type RequestJsonOptions as SabreRequestOptions,
} from "./client";

export {
  getConfig,
  isConfigured,
  isOpenGdsBrowseEnabled,
  openGdsMinSabreRating,
  type SabreConfig,
  getConfig as getSabreConfig,
  isConfigured as isSabreConfigured,
  isOpenGdsBrowseEnabled as isSabreOpenGdsBrowseEnabled,
} from "./config";

export {
  mapHotelDetailsToQuotes,
  mapHotelDiscoverToCandidates,
  isSabreReshopSignal,
  mapHotelPriceCheckResponse,
  mapHotelRatesToQuotes,
  type MapHotelDetailsToQuotesInput,
  type MapHotelRatesToQuotesInput,
  type SabreDiscoverHotel,
  type SabrePriceCheckFailureReason,
  type SabrePriceCheckMapped,
} from "./mappers";
