import { requestJson } from "../client";
import type { SabreConfig } from "../config";
import {
  buildHotelDiscoverBody,
  type SearchHotelRatesStay,
} from "../helpers";

export type SearchHotelsByAirportInput = SearchHotelRatesStay & {
  /** IATA airport code (e.g. NRT, CDG). */
  airportCode: string;
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
 * Discover hotels near an airport RefPoint (open-GDS path).
 * Sabre: POST /v5/get/hotelavail with GeoSearch.RefPoint Type 6.
 * Never writes properties; caller maps codes + names only.
 */
export async function searchHotelsByAirport(
  input: SearchHotelsByAirportInput,
): Promise<unknown> {
  const { body, config } = buildHotelDiscoverBody({
    ...input,
    geo: {
      kind: "airport",
      airportCode: input.airportCode,
    },
  });

  return requestJson({
    path: "/v5/get/hotelavail",
    body,
    config,
  });
}
