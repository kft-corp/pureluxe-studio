/**
 * Trip Builder domain — thin services over @pureluxe/db.
 * Same layout as lib/bookings / lib/rates.
 */
export { createTrip } from "./create-trip";
export { listTripBuilderTrips, type TripListItem, type TripListResult } from "./list-trips";
export { requireAssignedTrip } from "./require-assigned-trip";
export { setTripStay } from "./set-trip-stay";
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
