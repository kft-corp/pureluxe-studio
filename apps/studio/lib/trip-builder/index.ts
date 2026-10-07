/**
 * Trip Builder domain — thin services over @pureluxe/db.
 * Same layout as lib/bookings / lib/rates.
 */
export { createTrip } from "./create-trip";
export { listTripBuilderTrips, type TripListItem, type TripListResult } from "./list-trips";
export { requireAssignedTrip } from "./require-assigned-trip";
export { setTripStay } from "./set-trip-stay";
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
  type TripDetail,
  type TripQuoteDocumentSnapshot,
  type TripQuoteSnapshot,
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
  type PreparedChatTurn,
  type ChatMessage,
  type ChatMessagePage,
  type ChatStreamEvent,
} from "./chat";
export { createChatStream, encodeChatStreamEvent } from "./chat-stream";
export { createPreTripChatStream } from "./pre-trip-chat";
