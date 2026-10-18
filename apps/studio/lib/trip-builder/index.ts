/**
 * Trip Builder domain — thin services over @pureluxe/db, grouped by area:
 * access, trip, stays, party, rates, pricing, options-quote, chat, intents.
 * Routes import from here; files inside the module import each other directly.
 */
export { answerAtlasStay, type AtlasHotelChoice, type AtlasStayAnswer } from "./stays/atlas-stay";
export { createTrip } from "./trip/create-trip";
export { listTripBuilderTrips, type TripListItem, type TripListResult } from "./trip/list-trips";
export {
  requireAssignedTrip,
  requireEditableTrip,
  requireOpenQuoteTrip,
} from "./access/require-assigned-trip";
export { addTripLeg } from "./stays/add-trip-leg";
export { removeTripLeg } from "./stays/remove-trip-leg";
export { reviseTripLeg } from "./stays/revise-trip-leg";
export { setTripStay, type StayPropertyMatch } from "./stays/set-trip-stay";
export {
  addTripTraveller,
  changeTripLead,
  confirmTripTravellers,
  partyCounts,
  removeTripTraveller,
  removeTripTravellerByName,
} from "./party/trip-party";
export {
  NEW_TRIP_TITLE,
  buildTripAutoTitle,
  displayTripSubtitle,
  displayTripTitle,
  nextTripTitle,
  tripTitleInitial,
  type TripTitleParts,
} from "./trip/trip-title";
export {
  buildTripDetail,
  loadTripStay,
  type TripClientSnapshot,
  type TripFamilySuggestion,
  type TripTravellerSnapshot,
  type TripDetail,
  type TripQuoteDocumentSnapshot,
  type TripQuoteSnapshot,
  type TripOptionsQuoteSnapshot,
  type TripRateSnapshot,
  type TripRatesSnapshot,
  type TripStaySnapshot,
} from "./trip/trip-detail";
export { updateTrip } from "./trip/update-trip";
export { getTripDetail } from "./trip/get-trip-detail";
export { getTripQuote, updateTripQuote } from "./pricing/quote";
export {
  generateOptionsQuotePdf,
  getOptionsQuoteFileUrl,
  updateOptionsQuote,
  updateSavedStayOption,
} from "./options-quote/options-quote";
export { proposeOptionsQuoteEdit } from "./options-quote/options-quote-edit";
export {
  listChatMessages,
  prepareChatTurn,
  saveTripChatLines,
  type PreparedChatTurn,
  type ChatMessage,
  type ChatMessagePage,
  type ChatStreamEvent,
} from "./chat/chat";
export { createChatStream, encodeChatStreamEvent } from "./chat/chat-stream";
export { getTripReadiness } from "./chat/trip-dossier";
export { shiftTripDates } from "./trip/shift-trip-dates";
export { createPreTripChatStream } from "./chat/pre-trip-chat";
export { attachRateOption } from "./rates/attach-rate-option";
export { pasteTripLineItem } from "./rates/paste-line-item";
export { approveTripLineItem, rejectTripLineItem } from "./rates/review-line-item";
export { searchTripRates } from "./rates/search-rates";
export { selectAccommodationRate } from "./rates/select-accommodation-rate";
