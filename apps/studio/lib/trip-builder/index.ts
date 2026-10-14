/**
 * Trip Builder domain — thin services over @pureluxe/db.
 * Same layout as lib/bookings / lib/rates.
 */
export { answerAtlasStay, type AtlasHotelChoice, type AtlasStayAnswer } from "./atlas-stay";
export { createTrip } from "./create-trip";
export { listTripBuilderTrips, type TripListItem, type TripListResult } from "./list-trips";
export {
  requireAssignedTrip,
  requireEditableTrip,
  requireOpenQuoteTrip,
} from "./require-assigned-trip";
export { addTripLeg } from "./add-trip-leg";
export { removeTripLeg } from "./remove-trip-leg";
export { reviseTripLeg } from "./revise-trip-leg";
export { setTripStay, type StayPropertyMatch } from "./set-trip-stay";
export {
  addTripTraveller,
  changeTripLead,
  confirmTripTravellers,
  partyCounts,
  removeTripTraveller,
  removeTripTravellerByName,
} from "./trip-party";
export {
  NEW_TRIP_TITLE,
  buildTripAutoTitle,
  displayTripSubtitle,
  displayTripTitle,
  nextTripTitle,
  tripTitleInitial,
  type TripTitleParts,
} from "./trip-title";
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
} from "./trip-detail";
export { updateTrip } from "./update-trip";
export { getTripDetail } from "./get-trip-detail";
export {
  generateTripQuotePdf,
  getTripQuote,
  getTripQuoteFileUrl,
  updateTripQuote,
} from "./quote";
export {
  listChatMessages,
  prepareChatTurn,
  saveTripChatLines,
  type PreparedChatTurn,
  type ChatMessage,
  type ChatMessagePage,
  type ChatStreamEvent,
} from "./chat";
export { createChatStream, encodeChatStreamEvent } from "./chat-stream";
export { getTripReadiness } from "./trip-dossier";
export { shiftTripDates } from "./shift-trip-dates";
export { createPreTripChatStream } from "./pre-trip-chat";
