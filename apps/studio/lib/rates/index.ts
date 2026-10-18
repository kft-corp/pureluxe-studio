/**
 * Rate helpers any module can use, and the rate source settings.
 * Actions on a trip's rooms live in lib/trip-builder/rates.
 */
export {
  getDestinationsSettings,
  getNegotiatedCodesSettings,
  getRateSources,
  patchRateSourcesSetting,
  type DestinationsSettingsData,
  type NegotiatedCodesSettingsData,
  type RateSourcesData,
} from "./rate-sources-settings";
