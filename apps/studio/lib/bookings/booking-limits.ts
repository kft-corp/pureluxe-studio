/** Caps for nested lists on the Studio booking detail aggregate. */
export const BOOKING_DETAIL_LIST_LIMITS = {
  travellers: 50,
  /** Recent activity rows shown on the booking detail Activity tab. */
  audit: 5,
} as const;

/** Directory default page size (UI + API alignment). */
export const BOOKING_DIRECTORY_PAGE_SIZE = 10;
