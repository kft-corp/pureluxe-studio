/**
 * Stage 5 — open-GDS discover fill for hotel_find.
 * Thin DB coverage → Sabre geo-first (airport only if no coords) Avail →
 * code+name only (no properties write). Trip stay dates when known.
 * Occupancy probe is always 2 adults / 1 room (suggestion names only).
 */
import {
  findActiveKbAirportById,
  findActiveKbCitiesByName,
  findActiveKbCountryById,
  listActiveSabreCodesForPropertyIds,
  type KbAirport,
  type KbCity,
} from "@pureluxe/db";
import {
  defaultDiscoverStayDates,
  isSabreOpenGdsBrowseEnabled,
  mapHotelDiscoverToCandidates,
  openGdsMinSabreRating,
  sabreLog,
  searchHotelsByAirport,
  searchHotelsByGeo,
  type SabreDiscoverHotel,
} from "@pureluxe/rates";

import type { FoundHotel } from "./find-hotels-types";

/** Call Sabre discover only when PureLuxe shortlist is thinner than this. */
const OPEN_GDS_THIN_THRESHOLD = 3;
/** Hard cap of open-GDS hotels appended per turn. */
const OPEN_GDS_MAX = 5;

type DiscoverPlace = {
  city: KbCity;
  countryName: string | null;
  airport: KbAirport | null;
};

type DiscoverSkipReason =
  | "not_thin"
  | "browse_off"
  | "no_place"
  | "no_geo"
  | "sabre_empty"
  | "all_deduped"
  | "error";

function discoverLog(
  level: "warn" | "info",
  message: string,
  meta?: Record<string, unknown>,
): void {
  const line = `open-GDS discover: ${message}`;
  if (level === "warn") {
    sabreLog.warn(line, meta);
    return;
  }
  // sabreLog has no info — use warn for visibility in Studio terminal during CERT smoke.
  sabreLog.warn(line, meta);
}

/** Prefer city-center geo over airport (airport near HND pulled Tokyo for Yokohama). */
function cityDiscoverScore(city: KbCity): number {
  let score = 0;
  if (placeHasGeo(city)) score += 2;
  if (city.preferred_airport_id) score += 1;
  return score;
}

function placeHasGeo(city: KbCity): boolean {
  return (
    city.latitude != null &&
    city.longitude != null &&
    Number.isFinite(city.latitude) &&
    Number.isFinite(city.longitude)
  );
}

function placeCandidates(place: string): string[] {
  const trimmed = place.trim();
  if (!trimmed) return [];
  const out = [trimmed];
  const beforeComma = trimmed.split(",")[0]?.trim();
  if (beforeComma && beforeComma.toLowerCase() !== trimmed.toLowerCase()) {
    out.push(beforeComma);
  }
  return out;
}

/** Resolve destination text → kb_cities geo or preferred airport. */
export async function resolveDiscoverPlace(
  place: string,
): Promise<DiscoverPlace | null> {
  for (const candidate of placeCandidates(place)) {
    const cities = await findActiveKbCitiesByName(candidate, 8);
    if (cities.length === 0) {
      discoverLog("info", "resolve: no kb_cities name match", { candidate });
      continue;
    }

    const ranked = [...cities].sort(
      (a, b) => cityDiscoverScore(b) - cityDiscoverScore(a),
    );
    const withScore = ranked.filter((c) => cityDiscoverScore(c) > 0);
    if (withScore.length === 0) {
      discoverLog("warn", "resolve: city found but no lat/long or airport", {
        candidate,
        cityNames: ranked.map((c) => c.name),
        cityIds: ranked.map((c) => c.id),
      });
      continue;
    }

    const city = withScore[0]!;
    const country = await findActiveKbCountryById(city.country_id);
    let airport: KbAirport | null = null;
    if (city.preferred_airport_id) {
      airport = await findActiveKbAirportById(city.preferred_airport_id);
      if (airport && !/^[A-Za-z]{3}$/.test(airport.iata_code.trim())) {
        discoverLog("warn", "resolve: preferred airport IATA invalid", {
          city: city.name,
          airportId: city.preferred_airport_id,
          iata: airport.iata_code,
        });
        airport = null;
      }
    }

    const hasGeo = placeHasGeo(city);
    if (!airport && !hasGeo) {
      discoverLog("warn", "resolve: no usable airport or geo", {
        city: city.name,
        cityId: city.id,
      });
      continue;
    }

    // Geo-first: only use airport when city has no lat/long.
    const useAirport = !hasGeo ? airport : null;

    discoverLog("info", "resolve: ok", {
      candidate,
      city: city.name,
      cityId: city.id,
      path: useAirport ? "airport" : "geo",
      latitude: city.latitude,
      longitude: city.longitude,
      airport: useAirport?.iata_code ?? null,
      radius: city.default_search_radius ?? 20,
      uom: city.default_search_uom ?? "MI",
    });

    return {
      city,
      countryName: country?.name ?? null,
      airport: useAirport,
    };
  }
  return null;
}

/** Collapse punctuation / hotel fluff so "The Ritz, Paris" ≈ "Ritz Paris". */
function normName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|hotel|hotels|resort|resorts|spa|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip Sabre amenity noise so why/choose_if read like Atlas prose. */
function cleanAmenityLabel(label: string): string | null {
  const text = label
    .replace(/\s*\(generic\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  // Skip ultra-generic hotel tags that add no suggest value.
  if (/^non-?smoking/i.test(text)) return null;
  return text;
}

function samePlace(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

/**
 * Atlas-shaped decision fields from Sabre discover facts.
 * Same keys advisors already weave (area / why / choose_if) — no Rating stamp.
 */
function openGdsDecisionFields(
  hit: SabreDiscoverHotel,
  askedPlace: string,
): Pick<FoundHotel, "area" | "why" | "choose_if" | "style_tags"> {
  const city = hit.city?.trim() || null;
  const quality = hit.quality?.trim() || null;
  const amenities = hit.amenities
    .map(cleanAmenityLabel)
    .filter((label): label is string => Boolean(label))
    .slice(0, 3);

  const area = city;

  const whyBits: string[] = [];
  if (quality) {
    whyBits.push(
      city
        ? `${quality} hotel in ${city}`
        : `${quality} hotel`,
    );
  } else if (city) {
    whyBits.push(`Hotel in ${city}`);
  }
  if (amenities.length === 1) {
    whyBits.push(`with ${amenities[0]!.toLowerCase()}`);
  } else if (amenities.length > 1) {
    const head = amenities.slice(0, -1).map((a) => a.toLowerCase()).join(", ");
    const tail = amenities[amenities.length - 1]!.toLowerCase();
    whyBits.push(`with ${head} and ${tail}`);
  }
  const why =
    whyBits.length > 0
      ? `${whyBits.join(" ")}.`.replace(/\s+\./g, ".")
      : null;

  let choose_if: string | null = null;
  if (city && askedPlace.trim() && !samePlace(city, askedPlace)) {
    choose_if = `Choose if a stay in ${city} works — it sits outside ${askedPlace.trim()}.`;
  } else if (quality && city) {
    choose_if = `Choose if a ${quality.toLowerCase()} base in ${city} fits this party.`;
  } else if (city) {
    choose_if = `Choose if a stay in ${city} fits this party.`;
  } else if (quality) {
    choose_if = `Choose if a ${quality.toLowerCase()} option fits this party.`;
  }

  return {
    area,
    why,
    choose_if,
    style_tags: quality ? [quality] : [],
  };
}

function toOpenFound(
  hit: SabreDiscoverHotel,
  place: DiscoverPlace,
): FoundHotel {
  const askedPlace = place.city.name;
  const decision = openGdsDecisionFields(hit, askedPlace);
  return {
    name: hit.hotelName,
    destination: place.city.name,
    city: hit.city ?? place.city.name,
    country: place.countryName,
    tier: null,
    style_tags: decision.style_tags,
    score: 0,
    contracted: false,
    source: "open_gds",
    badge: "Open",
    property_id: null,
    sabre_hotel_code: hit.hotelCode,
    area: decision.area,
    partner: null,
    why: decision.why,
    choose_if: decision.choose_if,
    guide_rating: null,
    guide_score_factors: {},
  };
}

function mapDiscoverResponse(
  response: unknown,
  minRatingNum: number,
): SabreDiscoverHotel[] {
  return mapHotelDiscoverToCandidates(response, {
    max: OPEN_GDS_MAX,
    minSabreRating: Number.isFinite(minRatingNum) ? minRatingNum : 4,
  });
}

function resolveDiscoverStay(input: {
  checkIn?: string | null;
  checkOut?: string | null;
}): { checkIn: string; checkOut: string; source: "trip" | "probe" } {
  const checkIn = input.checkIn?.trim() ?? "";
  const checkOut = input.checkOut?.trim() ?? "";
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(checkIn) &&
    /^\d{4}-\d{2}-\d{2}$/.test(checkOut) &&
    checkOut > checkIn
  ) {
    return { checkIn, checkOut, source: "trip" };
  }
  const probe = defaultDiscoverStayDates();
  return { ...probe, source: "probe" };
}

/**
 * Discover is for hotel names only — always probe with a standard twin occupancy.
 * Real party / rooms / child splits belong on rates_search, not suggest.
 */
const DISCOVER_PROBE = { adults: 2, children: 0, rooms: 1 } as const;

async function callDiscover(
  place: DiscoverPlace,
  stayDates?: { checkIn?: string | null; checkOut?: string | null },
): Promise<SabreDiscoverHotel[]> {
  const stay = resolveDiscoverStay(stayDates ?? {});
  const radius = place.city.default_search_radius ?? 20;
  const uom = place.city.default_search_uom === "KM" ? "KM" : "MI";
  const minRating = openGdsMinSabreRating();
  const minRatingNum = Number.parseFloat(minRating);

  const shared = {
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    adults: DISCOVER_PROBE.adults,
    children: DISCOVER_PROBE.children,
    rooms: DISCOVER_PROBE.rooms,
    pageSize: OPEN_GDS_MAX,
    minSabreRating: minRating,
    radius,
    uom: uom as "MI" | "KM",
    bestOnly: "1",
  };

  discoverLog("info", "sabre call starting", {
    city: place.city.name,
    path: place.airport ? "airport" : "geo",
    airport: place.airport?.iata_code ?? null,
    latitude: place.city.latitude,
    longitude: place.city.longitude,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    staySource: stay.source,
    adults: DISCOVER_PROBE.adults,
    children: DISCOVER_PROBE.children,
    rooms: DISCOVER_PROBE.rooms,
    occupancyProbe: "standard_twin",
    radius,
    uom,
    minRating,
    pageSize: OPEN_GDS_MAX,
  });

  // Airport only when city has no lat/long (geo-first resolve).
  if (place.airport) {
    const airportResponse = await searchHotelsByAirport({
      ...shared,
      airportCode: place.airport.iata_code,
    });
    const fromAirport = mapDiscoverResponse(airportResponse, minRatingNum);
    discoverLog("info", "airport path result", {
      city: place.city.name,
      airport: place.airport.iata_code,
      candidates: fromAirport.length,
      names: fromAirport.map((h) => h.hotelName),
    });
    return fromAirport;
  }

  const geoResponse = await searchHotelsByGeo({
    ...shared,
    latitude: place.city.latitude as number,
    longitude: place.city.longitude as number,
  });
  const fromGeo = mapDiscoverResponse(geoResponse, minRatingNum);
  discoverLog("info", "geo path result", {
    city: place.city.name,
    candidates: fromGeo.length,
    names: fromGeo.map((h) => h.hotelName),
  });
  return fromGeo;
}

/** Collect Sabre codes already on the shortlist (open rows + mapped properties). */
async function knownSabreCodes(hotels: FoundHotel[]): Promise<Set<string>> {
  const codes = new Set<string>();
  for (const hotel of hotels) {
    const openCode = hotel.sabre_hotel_code?.trim().toUpperCase();
    if (openCode) codes.add(openCode);
  }

  const propertyIds = hotels
    .map((h) => h.property_id?.trim())
    .filter((id): id is string => Boolean(id));
  if (propertyIds.length === 0) return codes;

  try {
    const byProperty = await listActiveSabreCodesForPropertyIds(propertyIds);
    for (const code of byProperty.values()) {
      const trimmed = code.trim().toUpperCase();
      if (trimmed) codes.add(trimmed);
    }
  } catch {
    // Mapped-code lookup is best-effort; name dedupe still applies.
  }

  return codes;
}

export type FillOpenGdsResult = {
  hotels: FoundHotel[];
  /** True when at least one open-GDS hotel was appended. */
  filled: boolean;
  /** True when Sabre discover was attempted (thin + browse + place). */
  attempted: boolean;
  skipReason: DiscoverSkipReason | null;
};

function skip(
  hotels: FoundHotel[],
  reason: DiscoverSkipReason,
  meta?: Record<string, unknown>,
): FillOpenGdsResult {
  const attempted =
    reason === "sabre_empty" ||
    reason === "all_deduped" ||
    reason === "error";
  discoverLog("warn", `skip (${reason})`, {
    reason,
    shortlist: hotels.length,
    ...meta,
  });
  return { hotels, filled: false, attempted, skipReason: reason };
}

/**
 * When PureLuxe shortlist is thin (&lt; 3) and open-GDS browse is on,
 * append up to 5 Sabre discover hotels (preferred first, then open).
 * Sabre occupancy is a fixed 2 adults / 1 room probe (names only).
 * Never inserts properties / supplier codes.
 */
export async function fillOpenGdsIfThin(input: {
  hotels: FoundHotel[];
  place: string | null;
  /** @deprecated Ignored — discover always uses 2 adults / 0 children / 1 room. */
  adults?: number | null;
  /** @deprecated Ignored — discover always uses 2 adults / 0 children / 1 room. */
  children?: number | null;
  /** Trip stay dates when known — preferred over +30d inventory probe. */
  checkIn?: string | null;
  checkOut?: string | null;
}): Promise<FillOpenGdsResult> {
  const hotels = input.hotels;
  if (hotels.length >= OPEN_GDS_THIN_THRESHOLD) {
    return skip(hotels, "not_thin", {
      place: input.place,
      threshold: OPEN_GDS_THIN_THRESHOLD,
    });
  }
  if (!isSabreOpenGdsBrowseEnabled()) {
    return skip(hotels, "browse_off", { place: input.place });
  }
  const placeText = input.place?.trim() || null;
  if (!placeText) {
    return skip(hotels, "no_place");
  }

  try {
    const resolved = await resolveDiscoverPlace(placeText);
    if (!resolved) {
      return skip(hotels, "no_geo", { place: placeText });
    }

    const discovered = await callDiscover(resolved, {
      checkIn: input.checkIn,
      checkOut: input.checkOut,
    });
    if (discovered.length === 0) {
      return skip(hotels, "sabre_empty", {
        place: placeText,
        city: resolved.city.name,
        path: resolved.airport ? "airport" : "geo",
        airport: resolved.airport?.iata_code ?? null,
      });
    }

    const seenNames = new Set(
      hotels.map((h) => normName(h.name)).filter((n) => n.length > 0),
    );
    const seenCodes = await knownSabreCodes(hotels);

    const added: FoundHotel[] = [];
    let deduped = 0;
    for (const hit of discovered) {
      if (added.length >= OPEN_GDS_MAX) break;
      const nameKey = normName(hit.hotelName);
      const codeKey = hit.hotelCode.trim().toUpperCase();
      if (
        (nameKey && seenNames.has(nameKey)) ||
        (codeKey && seenCodes.has(codeKey))
      ) {
        deduped += 1;
        continue;
      }
      if (nameKey) seenNames.add(nameKey);
      if (codeKey) seenCodes.add(codeKey);
      added.push(toOpenFound(hit, resolved));
    }

    if (added.length === 0) {
      return skip(hotels, "all_deduped", {
        place: placeText,
        discovered: discovered.length,
        deduped,
      });
    }

    discoverLog("info", "filled", {
      place: placeText,
      city: resolved.city.name,
      shortlistBefore: hotels.length,
      discovered: discovered.length,
      deduped,
      added: added.length,
      openNames: added.map((h) => h.name),
    });

    return {
      hotels: [...hotels, ...added],
      filled: true,
      attempted: true,
      skipReason: null,
    };
  } catch (err) {
    // Discover is best-effort — keep PureLuxe shortlist on Sabre/geo failure.
    const message = err instanceof Error ? err.message : String(err);
    discoverLog("warn", "skip (error)", {
      reason: "error" satisfies DiscoverSkipReason,
      place: placeText,
      message,
    });
    return {
      hotels,
      filled: false,
      attempted: true,
      skipReason: "error",
    };
  }
}
