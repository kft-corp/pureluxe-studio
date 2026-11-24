import type { BookingQuickFilter, ListBookingsQuery } from "@pureluxe/shared";
import { BOOKING_QUICK_FILTERS } from "@pureluxe/shared";

import {
  filterAllowed,
  readBoolParam,
  readCsvParam,
  readEnumParam,
  readPageParam,
  readStringParam,
  setBoolParam,
  setPageParam,
  setStringParam,
} from "@/lib/directory";

import {
  EMPTY_BOOKING_ADVANCED_FILTERS,
  workFromQuickFilters,
  type BookingAdvancedFilters,
} from "./booking-filters";
import { BOOKING_DIRECTORY_PAGE_SIZE } from "./booking-limits";

export type BookingDirectoryUrlState = {
  search: string;
  quickFilters: BookingQuickFilter[];
  advancedFilters: BookingAdvancedFilters;
  page: number;
};

export const DEFAULT_BOOKING_DIRECTORY_URL_STATE: BookingDirectoryUrlState = {
  search: "",
  quickFilters: ["mine"],
  advancedFilters: EMPTY_BOOKING_ADVANCED_FILTERS,
  page: 1,
};

const TYPE_VALUES = [
  "any",
  "hotel",
  "flight",
  "transfer",
  "activity",
] as const;
const STATUS_VALUES = [
  "any",
  "pending",
  "on_hold",
  "confirmed",
  "cancelled",
  "completed",
  "superseded",
] as const;

export function parseBookingDirectoryUrlState(
  params: URLSearchParams,
): BookingDirectoryUrlState {
  const hasFiltersKey = params.has("filters");
  const quickFilters = hasFiltersKey
    ? filterAllowed(readCsvParam(params, "filters"), BOOKING_QUICK_FILTERS)
    : (["mine"] as BookingQuickFilter[]);

  const advancedFilters: BookingAdvancedFilters = {
    type: readEnumParam(params, "type", TYPE_VALUES, "any"),
    status: readEnumParam(params, "status", STATUS_VALUES, "any"),
    work: workFromQuickFilters(quickFilters),
    missing_ref: readBoolParam(params, "missing_ref"),
    no_trip: readBoolParam(params, "no_trip"),
    ticket_deadline_soon: readBoolParam(params, "ticket_deadline_soon"),
    owner: readStringParam(params, "owner", "any") || "any",
    start_from: readStringParam(params, "start_from"),
    start_to: readStringParam(params, "start_to"),
  };

  return {
    search: readStringParam(params, "q"),
    quickFilters,
    advancedFilters,
    page: readPageParam(params),
  };
}

export function serializeBookingDirectoryUrlState(
  state: BookingDirectoryUrlState,
): string {
  const params = new URLSearchParams();
  setStringParam(params, "q", state.search);

  const atDefaultChips =
    state.quickFilters.length === 1 && state.quickFilters[0] === "mine";
  if (!atDefaultChips) {
    // Explicit empty filters means "not Mine" / cleared chips.
    params.set("filters", state.quickFilters.join(","));
  }

  setStringParam(params, "type", state.advancedFilters.type, "any");
  setStringParam(params, "status", state.advancedFilters.status, "any");
  setBoolParam(params, "missing_ref", state.advancedFilters.missing_ref);
  setBoolParam(params, "no_trip", state.advancedFilters.no_trip);
  setBoolParam(
    params,
    "ticket_deadline_soon",
    state.advancedFilters.ticket_deadline_soon,
  );
  setStringParam(params, "owner", state.advancedFilters.owner, "any");
  setStringParam(params, "start_from", state.advancedFilters.start_from);
  setStringParam(params, "start_to", state.advancedFilters.start_to);
  setPageParam(params, state.page);
  return params.toString();
}

export function bookingDirectoryUrlStateToListQuery(
  state: BookingDirectoryUrlState,
): ListBookingsQuery {
  const work = workFromQuickFilters(state.quickFilters);
  return {
    q: state.search,
    scope: state.quickFilters.includes("mine") ? "mine" : "all",
    type: state.advancedFilters.type,
    work,
    status: state.advancedFilters.status,
    missing_ref: state.advancedFilters.missing_ref,
    no_trip: state.advancedFilters.no_trip,
    ticket_deadline_soon: state.advancedFilters.ticket_deadline_soon,
    owner: state.advancedFilters.owner,
    start_from: state.advancedFilters.start_from,
    start_to: state.advancedFilters.start_to,
    limit: BOOKING_DIRECTORY_PAGE_SIZE,
    offset: (state.page - 1) * BOOKING_DIRECTORY_PAGE_SIZE,
  };
}

/** True when the URL would omit all query params (Mine + empty search/filters). */
export function isDefaultBookingDirectoryUrlState(
  state: BookingDirectoryUrlState,
): boolean {
  return serializeBookingDirectoryUrlState(state) === "";
}
