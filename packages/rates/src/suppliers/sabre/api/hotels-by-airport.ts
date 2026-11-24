import { requestJson } from "../client";
import type { SabreConfig } from "../config";
import { buildHotelSearchBody } from "../helpers";

export type SearchHotelsByAirportInput = {
  /** IATA airport code (e.g. NRT, CDG). */
  airportCode: string;
  /** Search radius; default 20. */
  radius?: number;
  /** Miles or kilometers; default MI. */
  uom?: "MI" | "KM";
  /** SabreRating Min (default 4). */
  minSabreRating?: string;
  /** Cap MaxResults at 5 for open-GDS suggest. */
  maxResults?: number;
  /** Optional name fragment under HotelPref.HotelName. */
  hotelName?: string | null;
  config?: SabreConfig;
};

/**
 * Discover hotels near an airport RefPoint (open-GDS suggest).
 * Sabre: POST /v2.0.0/hotel/search with GeoSearch.RefPoint Type 6 — no stay dates.
 * Never writes properties; caller maps codes + names only.
 */
export async function searchHotelsByAirport(
  input: SearchHotelsByAirportInput,
): Promise<unknown> {
  const { body, config } = buildHotelSearchBody({
    geo: {
      kind: "airport",
      airportCode: input.airportCode,
    },
    radius: input.radius,
    uom: input.uom,
    minSabreRating: input.minSabreRating,
    maxResults: input.maxResults,
    hotelName: input.hotelName,
    sortBy: "DistanceFrom",
    sortOrder: "ASC",
    config: input.config,
  });

  return requestJson({
    path: "/v2.0.0/hotel/search",
    body,
    config,
  });
}
