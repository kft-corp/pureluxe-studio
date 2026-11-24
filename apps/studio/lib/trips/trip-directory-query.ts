import type { ListJourneysQuery } from "@pureluxe/shared";
import { JOURNEY_PAYMENT_FILTERS } from "@pureluxe/shared";

import {
  filterAllowed,
  readCsvParam,
  readEnumParam,
  readPageParam,
  readStringParam,
  setPageParam,
  setStringParam,
} from "@/lib/directory";

import {
  directoryStage,
  EMPTY_TRIP_ADVANCED_FILTERS,
  JOURNEY_STAGE_CHIP_IDS,
  TRIP_DETAIL_STAGES,
  type JourneyQuickFilter,
  type TripAdvancedFilters,
  type TripDetailStage,
} from "./journey-filters";
import { JOURNEY_DIRECTORY_PAGE_SIZE } from "./list-journeys";

const CLIENT_TIER_VALUES = ["any", "vip", "standard"] as const;
const PRICE_VALUES = ["any", "locked", "open"] as const;
const QUOTE_VALUES = ["any", "stale", "current"] as const;

export type TripDirectoryUrlState = {
  search: string;
  quickFilters: JourneyQuickFilter[];
  advancedFilters: TripAdvancedFilters;
  page: number;
};

export const DEFAULT_TRIP_DIRECTORY_URL_STATE: TripDirectoryUrlState = {
  search: "",
  quickFilters: ["mine"],
  advancedFilters: EMPTY_TRIP_ADVANCED_FILTERS,
  page: 1,
};

const QUICK_FILTER_VALUES = [
  "mine",
  ...JOURNEY_STAGE_CHIP_IDS,
] as const satisfies readonly JourneyQuickFilter[];

export function parseTripDirectoryUrlState(
  params: URLSearchParams,
): TripDirectoryUrlState {
  const hasFiltersKey = params.has("filters");
  const quickFilters = hasFiltersKey
    ? filterAllowed(readCsvParam(params, "filters"), QUICK_FILTER_VALUES)
    : (["mine"] as JourneyQuickFilter[]);

  const advancedFilters: TripAdvancedFilters = {
    stage: readEnumParam(
      params,
      "stage",
      TRIP_DETAIL_STAGES,
      "any",
    ) as TripDetailStage,
    client_tier: readEnumParam(params, "client_tier", CLIENT_TIER_VALUES, "any"),
    price: readEnumParam(params, "price", PRICE_VALUES, "any"),
    quote: readEnumParam(params, "quote", QUOTE_VALUES, "any"),
    payment: readEnumParam(params, "payment", JOURNEY_PAYMENT_FILTERS, "any"),
    owner: readStringParam(params, "owner", "any") || "any",
    starts_from: readStringParam(params, "starts_from"),
    starts_to: readStringParam(params, "starts_to"),
  };

  return {
    search: readStringParam(params, "q"),
    quickFilters,
    advancedFilters,
    page: readPageParam(params),
  };
}

export function serializeTripDirectoryUrlState(
  state: TripDirectoryUrlState,
): string {
  const params = new URLSearchParams();
  setStringParam(params, "q", state.search);

  const atDefaultChips =
    state.quickFilters.length === 1 && state.quickFilters[0] === "mine";
  if (!atDefaultChips) {
    params.set("filters", state.quickFilters.join(","));
  }

  setStringParam(params, "stage", state.advancedFilters.stage, "any");
  setStringParam(params, "client_tier", state.advancedFilters.client_tier, "any");
  setStringParam(params, "price", state.advancedFilters.price, "any");
  setStringParam(params, "quote", state.advancedFilters.quote, "any");
  setStringParam(params, "payment", state.advancedFilters.payment, "any");
  setStringParam(params, "owner", state.advancedFilters.owner, "any");
  setStringParam(params, "starts_from", state.advancedFilters.starts_from);
  setStringParam(params, "starts_to", state.advancedFilters.starts_to);
  setPageParam(params, state.page);
  return params.toString();
}

export function tripDirectoryUrlStateToListQuery(
  state: TripDirectoryUrlState,
): ListJourneysQuery {
  const stage = directoryStage(state.quickFilters, state.advancedFilters.stage);
  return {
    q: state.search,
    scope: state.quickFilters.includes("mine") ? "mine" : "all",
    stage,
    client_tier: state.advancedFilters.client_tier,
    price: state.advancedFilters.price,
    quote: state.advancedFilters.quote,
    payment: state.advancedFilters.payment,
    owner: state.advancedFilters.owner,
    starts_from: state.advancedFilters.starts_from,
    starts_to: state.advancedFilters.starts_to,
    limit: JOURNEY_DIRECTORY_PAGE_SIZE,
    offset: (state.page - 1) * JOURNEY_DIRECTORY_PAGE_SIZE,
  };
}

/** True when the URL would omit all query params (Mine + empty search/filters). */
export function isDefaultTripDirectoryUrlState(
  state: TripDirectoryUrlState,
): boolean {
  return serializeTripDirectoryUrlState(state) === "";
}
