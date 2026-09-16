/**
 * Studio bookings business rules.
 * Same layout as lib/clients — feature folder, kebab-case files.
 */
export {
  BOOKING_DIRECTORY_PAGE_SIZE,
  listBookingDirectory,
} from "./booking-directory";
export {
  getBookingDetail,
  buildBookingDetail,
  type BookingDetail,
} from "./booking-detail";
export {
  listRecentBookingActivity,
  type BookingAuditEntry,
} from "./booking-activity";
export { BOOKING_DETAIL_LIST_LIMITS } from "./booking-limits";
export { nightsBetween } from "./booking-dates";
export {
  BOOKING_QUICK_CHIP_OPTIONS,
  BOOKING_WORK_CHIP_IDS,
  BOOKING_WORK_CHIP_SET,
  countBookingAdvancedFilters,
  EMPTY_BOOKING_ADVANCED_FILTERS,
  syncQuickFiltersWithAdvanced,
  workFromQuickFilters,
  type BookingAdvancedFilters,
  type BookingOwnerFilterOption,
} from "./booking-filters";
export {
  displayOrDash,
  bookingDurationLabel,
  BOOKING_CHANNEL_PRESETS,
  formatBookingAuditAction,
  formatBookingChannel,
  formatBookingCount,
  formatBookingDate,
  formatBookingDateTime,
  formatBookingMoney,
  formatBookingNights,
  formatBookingServiceType,
  formatBookingSource,
  formatBookingStatus,
  formatFlightRoute,
  formatTravellerGender,
  formatTravellerRole,
  formatTripLinked,
  isLeadTravellerRole,
  resolveBookingDeadline,
  type BookingDeadlineDisplay,
  type BookingDeadlineKind,
} from "./booking-format";
export {
  listServiceDetailFields,
  resolveServiceTimingCards,
  type ServiceDetailField,
  type ServiceTimingCard,
  type ServiceTimingIconKey,
} from "./booking-service-details";
export {
  BOARD_BASIS_PRESETS,
  boardBasisFormStateFromDetails,
  findBoardBasisPreset,
  formatBoardBasisDisplay,
  resolveBoardBasisFields,
  type BoardBasisPresetCode,
} from "./booking-board-basis";
export { createBooking } from "./create-booking";
export { updateBooking } from "./update-booking";
export {
  confirmBooking,
  cancelBooking,
  supersedeBooking,
} from "./booking-lifecycle";
export { assignBookingOwner, linkBookingTrip } from "./booking-ownership";
export {
  createBookingTraveller,
  updateBookingTraveller,
  deleteBookingTraveller,
} from "./booking-travellers";
export { softDeleteBooking } from "./soft-delete-booking";
export {
  getBookingConfirmConfig,
  type BookingConfirmAction,
} from "./confirm-dialog-config";
