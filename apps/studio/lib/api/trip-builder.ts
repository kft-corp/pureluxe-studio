import type {
  AddRateOptionBody,
  CreateTripBody,
  GenerateTripQuoteBody,
  ListTripsQuery,
  PasteLineItemBody,
  SearchRatesBody,
  SetTripStayBody,
  UpdateTripBody,
  UpdateTripQuoteBody,
} from "@pureluxe/shared";
import type { SearchRatesResult } from "@pureluxe/rates";
import type { TripLineItem } from "@pureluxe/db";

import type {
  TripDetail,
  TripListResult,
  TripQuoteSnapshot,
} from "@/lib/trip-builder";
import { apiRoutes } from "@/lib/routes";

import { fetchApi } from "./client";

type TripQuoteResponse = {
  detail: TripDetail;
  quote: TripQuoteSnapshot;
};

function toQueryString(params: Partial<ListTripsQuery>): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status && params.status !== "any") {
    search.set("status", params.status);
  }
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Load assigned trips for Trip Builder home / switcher. */
export function listTripBuilderTrips(params: Partial<ListTripsQuery> = {}) {
  return fetchApi<TripListResult>(
    `${apiRoutes.tripBuilder.trips}${toQueryString(params)}`,
    { cache: "no-store" },
  );
}

/** Load one assigned trip aggregate. */
export function getTripBuilderTrip(tripId: string) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.trip(tripId), {
    cache: "no-store",
  });
}

/** Create a trip assigned to the current member. */
export function createTripBuilderTrip(input: CreateTripBody) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.trips, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Patch trip shell fields. */
export function updateTripBuilderTrip(tripId: string, input: UpdateTripBody) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.trip(tripId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Set Phase 1 fixed stay (hotel + city + dates). */
export function setTripBuilderStay(tripId: string, input: SetTripStayBody) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.stay(tripId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Search rates for the open trip stay. */
export function searchTripBuilderRates(input: SearchRatesBody) {
  return fetchApi<SearchRatesResult>(apiRoutes.tripBuilder.ratesSearch, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Paste a hotel quote onto the trip (pending review). */
export function pasteTripBuilderLineItem(input: PasteLineItemBody) {
  return fetchApi<TripLineItem>(apiRoutes.tripBuilder.lineItemsPaste, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Persist a search option onto the trip (optionally select it). */
export function addTripBuilderRateOption(input: AddRateOptionBody) {
  return fetchApi<TripLineItem>(apiRoutes.tripBuilder.lineItemsFromRate, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Select a priced accommodation rate for the stay. */
export function selectTripBuilderLineItem(lineItemId: string) {
  return fetchApi<TripLineItem>(apiRoutes.tripBuilder.lineItemSelect(lineItemId), {
    method: "POST",
    cache: "no-store",
  });
}

/** Load quote draft + document status. */
export function getTripBuilderQuote(tripId: string) {
  return fetchApi<TripQuoteResponse>(apiRoutes.tripBuilder.quote(tripId), {
    cache: "no-store",
  });
}

/** Edit quote draft (narrative + optional sell fields). */
export function updateTripBuilderQuote(
  tripId: string,
  input: UpdateTripQuoteBody,
) {
  return fetchApi<TripQuoteResponse>(apiRoutes.tripBuilder.quote(tripId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Generate (or regenerate) the quote PDF. */
export function generateTripBuilderQuote(
  tripId: string,
  input: GenerateTripQuoteBody = {},
) {
  return fetchApi<TripQuoteResponse>(
    apiRoutes.tripBuilder.quoteGenerate(tripId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );
}

/** Short-lived signed URL for the ready quote PDF. */
export function getTripBuilderQuoteUrl(tripId: string) {
  return fetchApi<{ url: string; expires_in: number }>(
    apiRoutes.tripBuilder.quoteUrl(tripId),
    { cache: "no-store" },
  );
}
