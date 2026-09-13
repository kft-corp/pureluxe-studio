/** Bookings directory and detail copy. */
export const bookingMessages = {
  success: {
    listed: "Bookings loaded.",
  },
  error: {
    notFound: "We couldn't find that booking. It may have been superseded.",
    listFailed: "We couldn't load bookings. Refresh and try again.",
  },
} as const;
