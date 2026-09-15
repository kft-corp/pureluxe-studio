/** Bookings directory and detail copy. */
export const bookingMessages = {
  success: {
    listed: "Bookings loaded.",
    updated: "Booking details saved.",
    confirmed: "Booking confirmed.",
    cancelled: "Booking cancelled.",
    superseded: "Booking amended — open the new version to continue.",
    assigned: "Account owner updated.",
    tripLinked: "Trip link updated.",
    travellerCreated: "Traveller added.",
    travellerUpdated: "Traveller updated.",
    travellerRemoved: "Traveller removed.",
  },
  error: {
    notFound: "We couldn't find that booking. It may have been superseded.",
    travellerNotFound:
      "We couldn't find that traveller. Refresh and try again.",
    listFailed: "We couldn't load bookings. Refresh and try again.",
    conflict: "Someone else updated this booking. Refresh, then try again.",
    supersededLocked:
      "This booking was superseded by an amend. Edit the current version instead.",
    invalidStatus:
      "That status change isn’t allowed here. Use amend to replace a booking.",
    dateRange: "End date must be after the start date.",
    alreadyConfirmed: "This booking is already confirmed.",
    alreadyCancelled: "This booking is already cancelled.",
    cannotConfirm: "Only pending or on-hold bookings can be confirmed.",
    cannotCancel: "This booking can’t be cancelled in its current status.",
    cannotAmend: "Only active bookings can be amended.",
  },
} as const;
