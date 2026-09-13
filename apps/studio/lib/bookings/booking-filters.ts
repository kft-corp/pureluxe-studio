import type { BookingQuickFilter, ListBookingsQuery } from "@pureluxe/shared";

export type BookingOwnerFilterOption = {
  id: string;
  name: string;
};

export type BookingAdvancedFilters = {
  type: ListBookingsQuery["type"];
  status: ListBookingsQuery["status"];
  work: ListBookingsQuery["work"];
  missing_ref: boolean;
  no_trip: boolean;
  ticket_deadline_soon: boolean;
  owner: string;
  start_from: string;
  start_to: string;
};

export const EMPTY_BOOKING_ADVANCED_FILTERS: BookingAdvancedFilters = {
  type: "any",
  status: "any",
  work: "any",
  missing_ref: false,
  no_trip: false,
  ticket_deadline_soon: false,
  owner: "any",
  start_from: "",
  start_to: "",
};

/** Urgency chips (excludes Mine). Shared by toolbar + directory hook. */
export const BOOKING_WORK_CHIP_IDS = [
  "needs_confirm",
  "cancel_soon",
  "depart_soon",
  "arriving",
  "in_house",
] as const satisfies readonly BookingQuickFilter[];

export const BOOKING_WORK_CHIP_SET = new Set<string>(BOOKING_WORK_CHIP_IDS);

export const BOOKING_QUICK_CHIP_OPTIONS: Array<{
  id: BookingQuickFilter;
  label: string;
}> = [
  { id: "needs_confirm", label: "Needs confirmation" },
  { id: "cancel_soon", label: "Cancel soon" },
  { id: "depart_soon", label: "Starting soon" },
  { id: "arriving", label: "Starts today" },
  { id: "in_house", label: "On trip now" },
  { id: "mine", label: "Mine" },
];

export function workFromQuickFilters(
  filters: BookingQuickFilter[],
): BookingAdvancedFilters["work"] {
  const workChip = filters.find((id) => BOOKING_WORK_CHIP_SET.has(id));
  return (workChip as BookingAdvancedFilters["work"] | undefined) ?? "any";
}

/** Keep Mine / work chips aligned with More filters — do not wipe the toolbar. */
export function syncQuickFiltersWithAdvanced(
  currentChips: BookingQuickFilter[],
  value: BookingAdvancedFilters,
): BookingQuickFilter[] {
  let next = currentChips.filter((id) => !BOOKING_WORK_CHIP_SET.has(id));

  if (value.owner === "me") {
    if (!next.includes("mine")) next = [...next, "mine"];
  } else if (value.owner !== "any") {
    next = next.filter((id) => id !== "mine");
  }

  if (value.work !== "any" && BOOKING_WORK_CHIP_SET.has(value.work)) {
    next = [...next, value.work as BookingQuickFilter];
  }

  return next;
}

export function countBookingAdvancedFilters(
  filters: BookingAdvancedFilters,
): number {
  let count = 0;
  if (filters.type !== "any") count += 1;
  if (filters.status !== "any") count += 1;
  // `work` is mirrored on quick chips — don't double-count in More filters.
  if (filters.missing_ref) count += 1;
  if (filters.no_trip) count += 1;
  if (filters.ticket_deadline_soon) count += 1;
  if (filters.owner !== "any") count += 1;
  if (filters.start_from || filters.start_to) count += 1;
  return count;
}
