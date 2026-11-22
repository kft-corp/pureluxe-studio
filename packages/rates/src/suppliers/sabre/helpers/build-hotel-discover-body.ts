import { getConfig, type SabreConfig } from "../config";
import { buildRateInfoRef, type SearchHotelRatesStay } from "./build-rate-info-ref";

export type HotelDiscoverGeoRef =
  | {
      kind: "geo";
      latitude: number;
      longitude: number;
    }
  | {
      kind: "airport";
      airportCode: string;
    };

export type BuildHotelDiscoverBodyInput = SearchHotelRatesStay & {
  geo: HotelDiscoverGeoRef;
  radius?: number;
  uom?: "MI" | "KM";
  minSabreRating?: string;
  pageSize?: number;
  config?: SabreConfig;
};

/**
 * Shared GetHotelAvailRQ body for open-GDS geo / airport discover.
 * PageSize capped at 5; BestOnly defaults to "1".
 */
export function buildHotelDiscoverBody(
  input: BuildHotelDiscoverBodyInput,
): { body: Record<string, unknown>; config: SabreConfig } {
  const config = input.config ?? getConfig();
  if (!config) {
    throw new Error("Sabre is not configured");
  }

  const pageSize = Math.min(Math.max(input.pageSize ?? 5, 1), 5);
  const radius = input.radius && input.radius > 0 ? input.radius : 20;
  const uom = input.uom === "KM" ? "KM" : "MI";
  const minRating = (input.minSabreRating ?? "4").trim() || "4";

  let geoRef: Record<string, unknown>;
  if (input.geo.kind === "geo") {
    if (
      !Number.isFinite(input.geo.latitude) ||
      !Number.isFinite(input.geo.longitude)
    ) {
      throw new Error("Valid latitude and longitude are required");
    }
    geoRef = {
      Radius: radius,
      UOM: uom,
      GeoCode: {
        Latitude: input.geo.latitude,
        Longitude: input.geo.longitude,
      },
    };
  } else {
    const airportCode = input.geo.airportCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(airportCode)) {
      throw new Error("A 3-letter IATA airport code is required");
    }
    geoRef = {
      Radius: radius,
      UOM: uom,
      RefPoint: {
        Value: airportCode,
        ValueContext: "CODE",
        RefPointType: "6",
      },
    };
  }

  const body = {
    GetHotelAvailRQ: {
      version: "5.0.0",
      POS: { Source: { PseudoCityCode: config.pcc } },
      SearchCriteria: {
        OffSet: 1,
        SortBy: "SabreRating",
        SortOrder: "DESC",
        PageSize: pageSize,
        GeoSearch: { GeoRef: geoRef },
        HotelPref: {
          SabreRating: { Min: minRating, Max: "5" },
        },
        RateInfoRef: buildRateInfoRef(
          { ...input, bestOnly: input.bestOnly ?? "1", pageSize },
          { includeBestOnly: true },
        ),
      },
    },
  };

  return { body, config };
}
