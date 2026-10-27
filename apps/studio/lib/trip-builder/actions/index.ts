/**
 * Agent changes to a trip, each with duplicate protection and (where safe) Undo.
 * Every change runs through the trip services, so their rules and side effects apply.
 */
export {
  proposeTripSplit,
  removeTripStay,
  setTripClient,
  setTripDates,
  setTripStays,
  setTripTravellers,
  shiftTrip,
  undoTripChange,
} from "./trip-changes";
export {
  addQuoteLines,
  addQuoteOptions,
  clearQuoteSection,
  editQuoteLines,
  listQuoteLinesForAgent,
  previewQuote,
  removeQuoteOption,
  rewriteQuoteSection,
  selectQuoteFinal,
  sendQuote,
  setQuoteClientPrices,
  setQuoteWording,
  usePastedQuote,
} from "./quote-changes";
export { createTripFromChat, type TripCreateContext } from "./create-trip-from-chat";
export type { TripChangeContext, TripChangeResult } from "./with-trip-change";
