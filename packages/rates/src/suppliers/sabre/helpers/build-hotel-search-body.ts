import { getConfig, type SabreConfig } from "../config";

export type HotelSearchGeoRef =
  | {
      kind: "geo";
      latitude: number;
      longitude: number;
    }
  | {
      kind: "airport";
      airportCode: string;
    };

export type BuildHotelSearchBodyInput = {
  geo: HotelSearchGeoRef;
  radius?: number;
  uom?: "MI" | "KM";
  /** SabreRating Min (default 4). */
  minSabreRating?: string;
  /** Cap MaxResults at 5 for open-GDS suggest. */
  maxResults?: number;
  /** Optional name fragment (3–20 chars) under HotelPref.HotelName. */
  hotelName?: string | null;
  /**
   * Default SabreRating DESC (luxury shortlist).
   * DistanceFrom ASC when searching near an airport / “near X”.
   */
  sortBy?: "SabreRating" | "DistanceFrom";
  sortOrder?: "ASC" | "DESC";
  config?: SabreConfig;
};

/**
 * Shared HotelSearchRQ body for open-GDS location discover (no stay dates).
 * Phase 1: geo/airport + radius + rating floor + optional name.
 * Do not put RestrictSearchToCountry on GeoRef — Hotel Search oneOf rejects it.
 */
export function buildHotelSearchBody(
  input: BuildHotelSearchBodyInput,
): { body: Record<string, unknown>; config: SabreConfig } {
  const config = input.config ?? getConfig();
  if (!config) {
    throw new Error("Sabre is not configured");
  }

  const maxResults = Math.min(Math.max(input.maxResults ?? 5, 1), 5);
  const radius = input.radius && input.radius > 0 ? input.radius : 20;
  const uom = input.uom === "KM" ? "KM" : "MI";
  const minRating = (input.minSabreRating ?? "4").trim() || "4";
  const minRatingFormatted = minRating.includes(".")
    ? minRating
    : `${minRating}.0`;

  const sortBy =
    input.sortBy ??
    (input.geo.kind === "airport" ? "DistanceFrom" : "SabreRating");
  const sortOrder =
    input.sortOrder ?? (sortBy === "DistanceFrom" ? "ASC" : "DESC");

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

  const hotelPref: Record<string, unknown> = {
    SabreRating: { Min: minRatingFormatted, Max: "5.0" },
  };

  const hotelName = normalizeHotelNameFilter(input.hotelName);
  if (hotelName) {
    hotelPref.HotelName = hotelName;
  }

  const body = {
    HotelSearchRQ: {
      version: "2.0.0",
      POS: { Source: { PseudoCityCode: config.pcc } },
      SearchCriteria: {
        MaxResults: maxResults,
        SortBy: sortBy,
        SortOrder: sortOrder,
        GeoSearch: { GeoRef: geoRef },
        HotelPref: hotelPref,
      },
    },
  };

  return { body, config };
}

/** Hotel Search HotelName: roughly 3–20 chars; strip junk. */
function normalizeHotelNameFilter(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length < 3) return null;
  return trimmed.slice(0, 20);
}
