import {
  listActiveHotelsInDestination,
  listPropertyPriceBands,
  searchPropertiesRanked,
  typicalNightlyForProperty,
  type HotelPriceTier,
  type PropertySearchHit,
} from "@pureluxe/db";

const LINKED_SCORE = 0.7;
const UNSURE_SCORE = 0.35;
const SCORE_GAP = 0.15;
const PRICE_BAND_TOLERANCE = 0.2;

export type FindHotelsInput = {
  name?: string | null;
  destination?: string | null;
  tier?: HotelPriceTier | null;
  /** Hotel name to match style and tier against. */
  similarTo?: string | null;
  /** Hotel name whose price band others should match. */
  priceBandLike?: string | null;
  limit?: number;
};

export type FoundHotel = {
  name: string;
  destination: string | null;
  city: string | null;
  country: string | null;
  tier: HotelPriceTier | null;
  style_tags: string[];
  score: number;
  /** True when this is a Rate Layer (PureLuxe) hotel. */
  contracted: true;
};

export type FindHotelsResult = {
  hotels: FoundHotel[];
  /** Suggested names when the query was unclear. */
  did_you_mean: string[];
  note: string | null;
};

function toFound(hit: PropertySearchHit): FoundHotel {
  return {
    name: hit.name,
    destination: hit.destination,
    city: hit.city,
    country: hit.country,
    tier: hit.price_tier,
    style_tags: hit.style_tags,
    score: hit.score,
    contracted: true,
  };
}

function overlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(a.map((t) => t.toLowerCase()));
  return b.reduce((n, tag) => n + (set.has(tag.toLowerCase()) ? 1 : 0), 0);
}

/**
 * Resolve a typed hotel name with confidence.
 * Clear match → one hotel. Unsure → did_you_mean. None → empty.
 */
async function resolveNamedHotel(
  name: string,
  destination?: string | null,
): Promise<{ hit: PropertySearchHit | null; didYouMean: string[] }> {
  const hits = await searchPropertiesRanked({
    query: name,
    destination,
    limit: 5,
  });
  if (hits.length === 0) return { hit: null, didYouMean: [] };

  const top = hits[0]!;
  const second = hits[1];
  const clearWinner =
    top.score >= LINKED_SCORE &&
    (!second || top.score - second.score >= SCORE_GAP || top.score >= 0.95);

  if (clearWinner) {
    return { hit: top, didYouMean: [] };
  }

  if (top.score >= UNSURE_SCORE) {
    return {
      hit: null,
      didYouMean: hits.filter((h) => h.score >= UNSURE_SCORE).map((h) => h.name),
    };
  }

  return { hit: null, didYouMean: [] };
}

async function hotelsNearPrice(
  reference: PropertySearchHit,
  candidates: PropertySearchHit[],
  limit: number,
): Promise<PropertySearchHit[]> {
  const bands = await listPropertyPriceBands([
    reference.id,
    ...candidates.map((c) => c.id),
  ]);
  const refPrice = typicalNightlyForProperty(bands, reference.id);
  if (refPrice == null || refPrice <= 0) return candidates.slice(0, limit);

  const low = refPrice * (1 - PRICE_BAND_TOLERANCE);
  const high = refPrice * (1 + PRICE_BAND_TOLERANCE);

  return candidates
    .map((hotel) => {
      const price = typicalNightlyForProperty(bands, hotel.id);
      const inBand = price != null && price >= low && price <= high;
      return { hotel, inBand, price };
    })
    .filter((row) => row.inBand)
    .sort((a, b) => {
      const da = Math.abs((a.price ?? 0) - refPrice);
      const db = Math.abs((b.price ?? 0) - refPrice);
      return da - db || a.hotel.name.localeCompare(b.hotel.name);
    })
    .slice(0, limit)
    .map((row) => row.hotel);
}

/**
 * Find PureLuxe hotels by name, destination, tier, "similar to X", or price band.
 * Used by hotel_find; never invents hotels outside the Rate Layer.
 */
export async function findHotels(input: FindHotelsInput): Promise<FindHotelsResult> {
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 10);
  const destination = input.destination?.trim() || null;
  const name = input.name?.trim() || null;
  const similarTo = input.similarTo?.trim() || null;
  const priceBandLike = input.priceBandLike?.trim() || null;
  const tier = input.tier ?? null;

  if (!name && !destination && !similarTo && !priceBandLike && !tier) {
    return {
      hotels: [],
      did_you_mean: [],
      note: "Pass a hotel name, destination, tier, similar_to, or price_band_like.",
    };
  }

  // Named lookup (exact / fuzzy / did you mean)
  if (name && !similarTo && !priceBandLike && !tier) {
    const { hit, didYouMean } = await resolveNamedHotel(name, destination);
    if (hit) {
      return { hotels: [toFound(hit)], did_you_mean: [], note: null };
    }
    if (didYouMean.length > 0) {
      return {
        hotels: [],
        did_you_mean: didYouMean,
        note: "Did you mean one of these?",
      };
    }
    return {
      hotels: [],
      did_you_mean: [],
      note: destination
        ? `No PureLuxe hotel matched "${name}" in ${destination}.`
        : `No PureLuxe hotel matched "${name}".`,
    };
  }

  // Reference hotel for similar / same tier / price band
  let reference: PropertySearchHit | null = null;
  let didYouMean: string[] = [];
  const refName = similarTo || priceBandLike || (tier && name ? name : null);
  if (refName) {
    const resolved = await resolveNamedHotel(refName, destination);
    reference = resolved.hit;
    didYouMean = resolved.didYouMean;
    if (!reference && didYouMean.length > 0) {
      return {
        hotels: [],
        did_you_mean: didYouMean,
        note: "Did you mean one of these?",
      };
    }
    if (!reference) {
      return {
        hotels: [],
        did_you_mean: [],
        note: `No PureLuxe hotel matched "${refName}".`,
      };
    }
  }

  const place =
    destination ||
    reference?.destination ||
    reference?.country ||
    reference?.city ||
    null;

  if (!place) {
    return {
      hotels: [],
      did_you_mean: [],
      note: "Add a destination (or name a hotel that has one) to suggest others.",
    };
  }

  const targetTier = tier ?? reference?.price_tier ?? null;
  let candidates = await listActiveHotelsInDestination({
    destination: place,
    tier: targetTier,
    excludePropertyIds: reference ? [reference.id] : [],
    limit: 40,
  });

  // Same tier as named hotel, include the named hotel first when asked by name+tier path
  if (reference && (similarTo || (name && tier))) {
    const withStyle = [...candidates].sort((a, b) => {
      const oa = overlap(reference!.style_tags, a.style_tags);
      const ob = overlap(reference!.style_tags, b.style_tags);
      return ob - oa || a.name.localeCompare(b.name);
    });
    candidates = withStyle;
  }

  if (reference && priceBandLike) {
    candidates = await hotelsNearPrice(reference, candidates, limit);
  }

  // "Six Senses and two others in the same tier" — include the named hotel
  const includeNamed = Boolean(reference && (similarTo || name || tier || priceBandLike));
  const hotels: PropertySearchHit[] = [];
  if (includeNamed && reference) {
    hotels.push(reference);
  }
  for (const hit of candidates) {
    if (hotels.length >= limit) break;
    if (hotels.some((h) => h.id === hit.id)) continue;
    hotels.push(hit);
  }

  if (hotels.length === 0) {
    return {
      hotels: [],
      did_you_mean: [],
      note: targetTier
        ? `No PureLuxe ${targetTier.replaceAll("_", " ")} hotels found in ${place}.`
        : `No PureLuxe hotels found in ${place}.`,
    };
  }

  return {
    hotels: hotels.map(toFound),
    did_you_mean: [],
    note: null,
  };
}
