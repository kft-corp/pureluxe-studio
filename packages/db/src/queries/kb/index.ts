/**
 * Atlas KB DB queries.
 *
 * Naming:
 *   find*   — one row or null
 *   list*   — many rows
 *   load*   — bundled parallel read for resolve / detail APIs
 *   search* — keyword / typeahead
 *   insert* / update* / upsert* / verify* / replace* / apply* — writes
 *
 * Files:
 *   places.ts         — regions, countries, cities, facts, visa
 *   entities.ts       — kb_entities (resolve + typeahead + identity)
 *   entity-details.ts — hotel/restaurant/activity/vendor children
 *   entity-bundle.ts  — GET entity parallel load (studio vs client staff)
 *   facts.ts          — approved facts + R1 search
 *   itineraries.ts    — templates (not live trips)
 *   sources.ts        — Sources Tracker
 *   staff.ts          — internal notes + customer feedback (studio only)
 *   scrape.ts         — scrape jobs / runs
 *   trip-selection.ts — kb_selection_status + draft candidate replace
 *
 * Product rules (cap, studio vs guest, invent-nothing) live in @pureluxe/kb.
 */
export {
  countActiveKbEntitiesByTypeForCity,
  findActiveKbCityByCountryAndName,
  findActiveKbCityById,
  findActiveKbCountryByCode,
  findActiveKbCountryById,
  findActiveKbDestinationAudienceNote,
  findActiveKbRegionById,
  findActiveKbVisaRule,
  findKbCountryFacts,
  findKbDestinationFacts,
  listActiveKbCitiesForCountry,
  listActiveKbCountries,
  listActiveKbRegions,
  loadKbCityPlaceBundle,
  loadKbCountryPlaceBundle,
  upsertKbVisaRule,
  type KbCityPlaceBundle,
  type KbCountryPlaceBundle,
  type UpsertKbVisaRuleInput,
} from "./places";
export {
  compareKbEntitiesForResolve,
  deactivateKbEntities,
  findActiveKbEntityByExternalId,
  findActiveKbEntityById,
  findActiveKbEntityByIdentity,
  findActiveKbEntityByPropertyId,
  findKbEntityById,
  insertKbEntity,
  listActiveKbEntities,
  listExpiredLlmGeneralKbEntities,
  listKbHotelCandidatesForCity,
  updateKbEntity,
  verifyKbEntity,
  type InsertKbEntityInput,
  type ListKbEntitiesInput,
  type UpdateKbEntityInput,
} from "./entities";
export {
  findKbActivityDetails,
  findKbHotelDetails,
  findKbRestaurantDetails,
  findKbVendorDetails,
  listActiveKbHotelRoomCategories,
  listKbHotelConsortia,
  loadKbHotelDetailBundle,
  type KbHotelDetailBundle,
} from "./entity-details";
export {
  loadKbEntityDetailBundle,
  type KbEntityDetailBundle,
} from "./entity-bundle";
export {
  listApprovedKbFactsForEntity,
  listKbFactChunksForFact,
  searchApprovedKbFacts,
  searchKbContent,
  type SearchKbContentInput,
  type SearchKbContentResult,
  type SearchKbFactsInput,
} from "./facts";
export {
  findKbItineraryById,
  findPreferredKbItineraryForCountry,
  listKbItineraries,
  listKbItineraryItems,
  loadKbItineraryBundle,
  type KbItineraryBundle,
  type ListKbItinerariesInput,
} from "./itineraries";
export {
  findKbSourceById,
  insertKbSource,
  listKbSources,
  updateKbSource,
  type InsertKbSourceInput,
  type UpdateKbSourceInput,
} from "./sources";
export {
  insertKbCustomerFeedback,
  insertKbInternalNote,
  listKbCustomerFeedbackForEntity,
  listKbInternalNotesForEntity,
  markKbFeedbackUsedInAdvisorTake,
  type InsertKbCustomerFeedbackInput,
  type InsertKbInternalNoteInput,
} from "./staff";
export {
  findKbScrapeJobById,
  findKbScrapeJobBySourceId,
  finishKbScrapeRun,
  insertKbScrapeRun,
  listKbScrapeJobs,
  listKbScrapeRunsForJob,
  updateKbScrapeJobAfterRun,
  upsertKbScrapeJob,
  type InsertKbScrapeRunInput,
  type UpsertKbScrapeJobInput,
} from "./scrape";
export {
  applyKbResolveCandidatesForLeg,
  deleteTripLineItemsByIds,
  insertKbDraftCandidatesForLeg,
  listReplaceableKbDraftLineItems,
  replaceKbDraftCandidatesForLeg,
  updateTripLegKbSelectionStatus,
  type InsertKbDraftCandidateInput,
} from "./trip-selection";
