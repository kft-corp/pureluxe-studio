import { requestJson } from "../client";
import type { SabreConfig } from "../config";
import { buildHotelSearchBody } from "../helpers";

export type SearchHotelsByGeoInput = {
  latitude: number;
  longitude: number;
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
 * Discover hotels near a lat/long (open-GDS suggest).
 * Sabre: POST /v2.0.0/hotel/search with GeoSearch.GeoCode — no stay dates.
 * Never writes properties; caller maps codes + names only.
 */
export async function searchHotelsByGeo(
  input: SearchHotelsByGeoInput,
): Promise<unknown> {
  const { body, config } = buildHotelSearchBody({
    geo: {
      kind: "geo",
      latitude: input.latitude,
      longitude: input.longitude,
    },
    radius: input.radius,
    uom: input.uom,
    minSabreRating: input.minSabreRating,
    maxResults: input.maxResults,
    hotelName: input.hotelName,
    sortBy: "SabreRating",
    sortOrder: "DESC",
    config: input.config,
  });

  return requestJson({
    path: "/v2.0.0/hotel/search",
    body,
    config,
  });
}
