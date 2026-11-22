import { requestJson } from "../client";
import type { SabreConfig } from "../config";
import {
  buildHotelDiscoverBody,
  type SearchHotelRatesStay,
} from "../helpers";

export type SearchHotelsByGeoInput = SearchHotelRatesStay & {
  latitude: number;
  longitude: number;
  /** Search radius; default 20. */
  radius?: number;
  /** Miles or kilometers; default MI. */
  uom?: "MI" | "KM";
  /** SabreRating Min (default 4). */
  minSabreRating?: string;
  /** Cap PageSize at 5 for open-GDS discover. */
  pageSize?: number;
  config?: SabreConfig;
};

/**
 * Discover hotels near a lat/long (open-GDS path).
 * Sabre: POST /v5/get/hotelavail with GeoSearch.GeoCode — no HotelRefs.
 * Never writes properties; caller maps codes + names only.
 */
export async function searchHotelsByGeo(
  input: SearchHotelsByGeoInput,
): Promise<unknown> {
  const { body, config } = buildHotelDiscoverBody({
    ...input,
    geo: {
      kind: "geo",
      latitude: input.latitude,
      longitude: input.longitude,
    },
  });

  return requestJson({
    path: "/v5/get/hotelavail",
    body,
    config,
  });
}
