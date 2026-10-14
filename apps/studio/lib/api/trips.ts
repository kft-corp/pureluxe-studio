import type { JourneyStatusAction, ListJourneysQuery } from "@pureluxe/shared";

import type { JourneyCard, ListJourneysResult } from "@pureluxe/db";

import { apiRoutes } from "@/lib/routes";

import { fetchApi } from "./client";

export type JourneyCardItem = JourneyCard;

export type JourneyDirectoryData = ListJourneysResult;

const QUERY_DEFAULTS = new Set(["", "any", "mine", "0"]);

function toQueryString(params: Partial<ListJourneysQuery>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const asString = String(value);
    if (QUERY_DEFAULTS.has(asString)) continue;
    search.set(key, asString);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Load trip cards for the board. Defaults to the signed-in advisor's trips. */
export function listJourneyCards(params: Partial<ListJourneysQuery> = {}) {
  return fetchApi<JourneyDirectoryData>(
    `${apiRoutes.trips.root}${toQueryString(params)}`,
    { cache: "no-store" },
  );
}

export function getJourneyQuoteUrl(tripId: string, download = false) {
  const query = download ? "?download=1" : "";
  return fetchApi<{ url: string }>(`${apiRoutes.trips.quote(tripId)}${query}`, {
    cache: "no-store",
  });
}

export function setJourneyStatus(
  tripId: string,
  action: JourneyStatusAction,
) {
  return fetchApi<{ ok: true }>(apiRoutes.trips.status(tripId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}
