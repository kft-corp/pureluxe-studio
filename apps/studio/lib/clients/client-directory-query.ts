import type { ClientQuickFilter, ListClientsQuery } from "@pureluxe/shared";
import { CLIENT_QUICK_FILTERS, CLIENT_SOURCES } from "@pureluxe/shared";

import {
  filterAllowed,
  readBoolParam,
  readCsvParam,
  readEnumParam,
  readPageParam,
  readStringParam,
  setBoolParam,
  setCsvParam,
  setPageParam,
  setStringParam,
} from "@/lib/directory";

import {
  EMPTY_ADVANCED_FILTERS,
  type ClientAdvancedFilters,
} from "./client-filters";
import { CLIENT_DIRECTORY_PAGE_SIZE } from "./client-limits";

export type ClientDirectoryUrlState = {
  search: string;
  quickFilters: ClientQuickFilter[];
  advancedFilters: ClientAdvancedFilters;
  page: number;
};

export const DEFAULT_CLIENT_DIRECTORY_URL_STATE: ClientDirectoryUrlState = {
  search: "",
  quickFilters: [],
  advancedFilters: EMPTY_ADVANCED_FILTERS,
  page: 1,
};

const TIER_VALUES = ["any", "standard", "vip", "vvip"] as const;
const REVIEW_VALUES = ["any", "pending", "approved"] as const;
const COMPLETENESS_VALUES = [
  "any",
  "under_25",
  "under_50",
  "under_75",
  "complete",
] as const;

export function parseClientDirectoryUrlState(
  params: URLSearchParams,
): ClientDirectoryUrlState {
  return {
    search: readStringParam(params, "q"),
    quickFilters: filterAllowed(
      readCsvParam(params, "filters"),
      CLIENT_QUICK_FILTERS,
    ),
    advancedFilters: {
      tier: readEnumParam(params, "tier", TIER_VALUES, "any"),
      review_status: readEnumParam(
        params,
        "review_status",
        REVIEW_VALUES,
        "any",
      ),
      has_family: readBoolParam(params, "has_family"),
      missing_contact: readBoolParam(params, "missing_contact"),
      owner: readStringParam(params, "owner", "any") || "any",
      sources: filterAllowed(readCsvParam(params, "sources"), CLIENT_SOURCES),
      completeness: readEnumParam(
        params,
        "completeness",
        COMPLETENESS_VALUES,
        "any",
      ),
      created_from: readStringParam(params, "created_from"),
      created_to: readStringParam(params, "created_to"),
    },
    page: readPageParam(params),
  };
}

export function serializeClientDirectoryUrlState(
  state: ClientDirectoryUrlState,
): string {
  const params = new URLSearchParams();
  setStringParam(params, "q", state.search);
  setCsvParam(params, "filters", state.quickFilters);
  setStringParam(params, "tier", state.advancedFilters.tier, "any");
  setStringParam(
    params,
    "review_status",
    state.advancedFilters.review_status,
    "any",
  );
  setBoolParam(params, "has_family", state.advancedFilters.has_family);
  setBoolParam(
    params,
    "missing_contact",
    state.advancedFilters.missing_contact,
  );
  setStringParam(params, "owner", state.advancedFilters.owner, "any");
  setCsvParam(params, "sources", state.advancedFilters.sources);
  setStringParam(
    params,
    "completeness",
    state.advancedFilters.completeness,
    "any",
  );
  setStringParam(params, "created_from", state.advancedFilters.created_from);
  setStringParam(params, "created_to", state.advancedFilters.created_to);
  setPageParam(params, state.page);
  return params.toString();
}

export function clientDirectoryUrlStateToListQuery(
  state: ClientDirectoryUrlState,
): ListClientsQuery {
  return {
    q: state.search,
    filters: state.quickFilters,
    tier: state.advancedFilters.tier,
    review_status: state.advancedFilters.review_status,
    has_family: state.advancedFilters.has_family,
    missing_contact: state.advancedFilters.missing_contact,
    owner: state.advancedFilters.owner,
    sources: state.advancedFilters.sources,
    completeness: state.advancedFilters.completeness,
    created_from: state.advancedFilters.created_from,
    created_to: state.advancedFilters.created_to,
    sort: "name_asc",
    limit: CLIENT_DIRECTORY_PAGE_SIZE,
    offset: (state.page - 1) * CLIENT_DIRECTORY_PAGE_SIZE,
  };
}

export function isDefaultClientDirectoryUrlState(
  state: ClientDirectoryUrlState,
): boolean {
  return serializeClientDirectoryUrlState(state) === "";
}
