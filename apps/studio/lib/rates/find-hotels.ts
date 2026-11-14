import {
  guideQualityScore,
  listActiveHotelsInDestination,
  listKbExperiencesForPlaceSuggest,
  listKbHotelSuggestByPropertyIds,
  listKbHotelsForPlaceSuggest,
  listPropertyPriceBands,
  searchKbHotelsByName,
  searchPropertiesRanked,
  softChooseIfForParty,
  typicalNightlyForProperty,
  type HotelPriceTier,
  type HotelSuggestParty,
  type KbExperienceSuggestHit,
  type KbHotelGuideScoreFactors,
  type KbHotelSuggestHit,
  type PropertySearchHit,
} from "@pureluxe/db";

const LINKED_SCORE = 0.7;
const UNSURE_SCORE = 0.35;
const SCORE_GAP = 0.15;
const PRICE_BAND_TOLERANCE = 0.2;
/** Default shortlist size for destination / similar / tier suggest. */
const DEFAULT_SUGGEST_LIMIT = 3;
const EXPERIENCE_ACTIVITY_LIMIT = 3;
const EXPERIENCE_RESTAURANT_LIMIT = 2;

export type FindHotelsInput = {
  name?: string | null;
  destination?: string | null;
  tier?: HotelPriceTier | null;
  /** Hotel name to match style and tier against. */
  similarTo?: string | null;
  /** Hotel name whose price band others should match. */
  priceBandLike?: string | null;
  limit?: number;
  /** False for silent coverage probes — skip experience bank. Default true. */
  includeExperiences?: boolean;
  /** Adults on the open trip — tilts matrix ranking behind the scenes. */
  adults?: number | null;
  /** Children + infants on the open trip. */
  children?: number | null;
  /** Advisor ask text (or destination/query) for style tilt — romantic, spa, family, … */
  ask?: string | null;
  /** Client preference / diet labels from the lead profile. */
  prefHints?: string[] | null;
};

export type FoundHotel = {
  name: string;
  destination: string | null;
  city: string | null;
  country: string | null;
  tier: HotelPriceTier | null;
  style_tags: string[];
  score: number;
  /**
   * True when Rate Layer can shop this hotel (properties row).
   * False = Atlas preferred/guide only — suggest names, rates need paste/GDS/link.
   */
  contracted: boolean;
  /** Where the hit came from. */
  source: "rate_layer" | "atlas";
  /** Advisor-facing badge: Contracted = shoppable; Preferred = guide list only. */
  badge: "Contracted" | "Preferred";
  /** Neighbourhood / guide area when known. */
  area: string | null;
  /** Partner / consortia label when known. */
  partner: string | null;
  /** One-line why from Atlas advisor take / description. */
  why: string | null;
  /** Short "choose if" fit line. */
  choose_if: string | null;
  /** Destination-guide internal score when known (advisor-facing). */
  guide_rating: number | null;
  /** Internal guide matrix factors (full-name keys); for why/compare — never clients. */
  guide_score_factors: KbHotelGuideScoreFactors;
};

export type FoundExperience = {
  kind: "activity" | "restaurant";
  name: string;
  city: string | null;
  guide_type: string | null;
  who_it_suits: string | null;
  lead_time: string | null;
  veg_jain: string | null;
  why: string | null;
};

export type FindHotelsResult = {
  hotels: FoundHotel[];
  /** Curated activities + restaurants for the place (empty when none / skipped). */
  experiences: FoundExperience[];
  /** Suggested names when the query was unclear. */
  did_you_mean: string[];
  note: string | null;
};

function emptyDecisionFields(): Pick<
  FoundHotel,
  "area" | "partner" | "why" | "choose_if" | "guide_rating" | "guide_score_factors"
> {
  return {
    area: null,
    partner: null,
    why: null,
    choose_if: null,
    guide_rating: null,
    guide_score_factors: {},
  };
}

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
    source: "rate_layer",
    badge: "Contracted",
    ...emptyDecisionFields(),
  };
}

function toFoundAtlas(
  hit: KbHotelSuggestHit,
  party?: HotelSuggestParty | null,
): FoundHotel {
  const contracted = Boolean(hit.property_id);
  return {
    name: hit.name,
    destination: hit.city ?? hit.country,
    city: hit.city,
    country: hit.country,
    tier: hit.luxury_band,
    style_tags: hit.style_tags,
    score: hit.score,
    contracted,
    source: "atlas",
    badge: contracted ? "Contracted" : "Preferred",
    area: hit.area,
    partner: hit.partner,
    why: hit.why,
    choose_if: softChooseIfForParty(hit.choose_if, party),
    guide_rating: hit.guide_score,
    guide_score_factors: hit.guide_score_factors ?? {},
  };
}

function applyAtlasMeta(
  hotel: FoundHotel,
  hit: KbHotelSuggestHit,
  party?: HotelSuggestParty | null,
): FoundHotel {
  const factors = hit.guide_score_factors ?? {};
  return {
    ...hotel,
    area: hit.area ?? hotel.area,
    partner: hit.partner ?? hotel.partner,
    why: hit.why ?? hotel.why,
    choose_if:
      softChooseIfForParty(hit.choose_if ?? hotel.choose_if, party) ??
      hotel.choose_if,
    guide_rating: hit.guide_score ?? hotel.guide_rating,
    guide_score_factors:
      Object.keys(factors).length > 0 ? factors : hotel.guide_score_factors,
    style_tags: hotel.style_tags.length > 0 ? hotel.style_tags : hit.style_tags,
    tier: hotel.tier ?? hit.luxury_band,
  };
}

function toFoundExperience(hit: KbExperienceSuggestHit): FoundExperience {
  return {
    kind: hit.kind,
    name: hit.name,
    city: hit.city,
    guide_type: hit.guide_type,
    who_it_suits: hit.who_it_suits,
    lead_time: hit.lead_time,
    veg_jain: hit.veg_jain,
    why: hit.why,
  };
}

/** Prefer majority hotel city, else destination string. */
function experiencePlaceHint(
  hotels: FoundHotel[],
  destination: string | null,
): string | null {
  const counts = new Map<string, number>();
  for (const hotel of hotels) {
    const city = hotel.city?.trim();
    if (!city) continue;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [city, count] of counts) {
    if (count > bestCount) {
      best = city;
      bestCount = count;
    }
  }
  if (best) return best;
  const dest = destination?.trim();
  if (dest) return dest;
  return hotels[0]?.destination?.trim() || hotels[0]?.country?.trim() || null;
}

async function attachExperiences(
  result: Omit<FindHotelsResult, "experiences">,
  place: string | null,
  include: boolean,
  party?: HotelSuggestParty | null,
): Promise<FindHotelsResult> {
  const base: FindHotelsResult = {
    hotels: result.hotels,
    experiences: [],
    did_you_mean: result.did_you_mean,
    note: result.note,
  };
  if (!include || result.hotels.length === 0) return base;
  const hint = experiencePlaceHint(result.hotels, place);
  if (!hint) return base;
  const kids = typeof party?.children === "number" ? party.children : 0;
  try {
    const rows = await listKbExperiencesForPlaceSuggest({
      place: hint,
      activityLimit: EXPERIENCE_ACTIVITY_LIMIT,
      restaurantLimit: EXPERIENCE_RESTAURANT_LIMIT,
      preferFamily: kids > 0,
      preferCouples: kids === 0 && party?.adults === 2,
    });
    return { ...base, experiences: rows.map(toFoundExperience) };
  } catch {
    return base;
  }
}

/** Re-order shortlist using guide average + matrix fit (party-weighted). */
function sortByGuideQuality(
  hotels: FoundHotel[],
  party?: HotelSuggestParty | null,
): FoundHotel[] {
  return [...hotels].sort((a, b) => {
    const contracted = Number(b.contracted) - Number(a.contracted);
    if (contracted !== 0) return contracted;
    const quality =
      guideQualityScore(
        {
          guide_score: b.guide_rating,
          guide_score_factors: b.guide_score_factors,
        },
        party,
      ) -
      guideQualityScore(
        {
          guide_score: a.guide_rating,
          guide_score_factors: a.guide_score_factors,
        },
        party,
      );
    if (quality !== 0) return quality;
    return a.name.localeCompare(b.name);
  });
}

function normName(value: string): string {
  return value.trim().toLowerCase();
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

async function resolveNamedAtlasHotel(
  name: string,
  destination?: string | null,
): Promise<{ hit: KbHotelSuggestHit | null; didYouMean: string[] }> {
  const hits = await searchKbHotelsByName({
    query: name,
    place: destination,
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
  party?: HotelSuggestParty | null,
): Promise<PropertySearchHit[]> {
  const bands = await listPropertyPriceBands([
    reference.id,
    ...candidates.map((c) => c.id),
  ]);
  const refPrice = typicalNightlyForProperty(bands, reference.id);
  if (refPrice == null || refPrice <= 0) return candidates.slice(0, limit);

  const low = refPrice * (1 - PRICE_BAND_TOLERANCE);
  const high = refPrice * (1 + PRICE_BAND_TOLERANCE);
  const atlasByProperty = await listKbHotelSuggestByPropertyIds(
    candidates.map((c) => c.id),
  );

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
      if (da !== db) return da - db;
      // Matrix / guide as tie-break inside the same price distance.
      const atlasA = atlasByProperty.get(a.hotel.id);
      const atlasB = atlasByProperty.get(b.hotel.id);
      const qa = atlasA
        ? guideQualityScore(
            {
              guide_score: atlasA.guide_score,
              guide_score_factors: atlasA.guide_score_factors,
            },
            party,
          )
        : 0;
      const qb = atlasB
        ? guideQualityScore(
            {
              guide_score: atlasB.guide_score,
              guide_score_factors: atlasB.guide_score_factors,
            },
            party,
          )
        : 0;
      return qb - qa || a.hotel.name.localeCompare(b.hotel.name);
    })
    .slice(0, limit)
    .map((row) => row.hotel);
}

/** Attach Atlas area / partner / why / choose_if onto Rate Layer hits. */
async function enrichRateHotels(
  rateHits: PropertySearchHit[],
  party?: HotelSuggestParty | null,
): Promise<FoundHotel[]> {
  if (rateHits.length === 0) return [];
  const byProperty = await listKbHotelSuggestByPropertyIds(rateHits.map((h) => h.id));
  return rateHits.map((hit) => {
    const found = toFound(hit);
    const atlas = byProperty.get(hit.id);
    return atlas ? applyAtlasMeta(found, atlas, party) : found;
  });
}

/** Rate Layer first, then Atlas preferred hotels to fill the shortlist. */
async function mergeAtlasFill(
  rateHotels: FoundHotel[],
  place: string,
  limit: number,
  tier: HotelPriceTier | null,
  party?: HotelSuggestParty | null,
  /** False keeps Rate Layer / price-band order (only fills gaps from Atlas). */
  reorderByGuide = true,
): Promise<FoundHotel[]> {
  if (rateHotels.length >= limit) {
    const sliced = rateHotels.slice(0, limit);
    return reorderByGuide ? sortByGuideQuality(sliced, party) : sliced;
  }

  const atlas = await listKbHotelsForPlaceSuggest({
    place,
    limit: Math.min(limit * 4, 16),
    party,
  });
  const seen = new Set(rateHotels.map((h) => normName(h.name)));
  const merged = [...rateHotels];

  for (const hit of atlas) {
    if (merged.length >= limit) break;
    if (tier && hit.luxury_band && hit.luxury_band !== tier) continue;
    const key = normName(hit.name);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(toFoundAtlas(hit, party));
  }

  return reorderByGuide ? sortByGuideQuality(merged, party) : merged;
}

function emptyNote(place: string, tier: HotelPriceTier | null): string {
  return tier
    ? `No ${tier.replaceAll("_", " ")} hotels found in ${place}.`
    : `No hotels found in ${place}.`;
}

/**
 * Find hotels by name, destination, tier, "similar to X", or price band.
 * Rate Layer (shoppable) first; Atlas preferred list fills when thin/empty.
 * Never invents names outside those two sources. Rates stay a separate ask.
 * Destination shortlists also return a curated experience slice when available.
 */
export async function findHotels(input: FindHotelsInput): Promise<FindHotelsResult> {
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_SUGGEST_LIMIT, 1), 10);
  const destination = input.destination?.trim() || null;
  const name = input.name?.trim() || null;
  const similarTo = input.similarTo?.trim() || null;
  const priceBandLike = input.priceBandLike?.trim() || null;
  const tier = input.tier ?? null;
  const includeExperiences = input.includeExperiences !== false;
  const askText =
    input.ask?.trim() ||
    [input.destination, input.name, input.similarTo, input.priceBandLike]
      .filter(Boolean)
      .join(" ") ||
    null;
  const party: HotelSuggestParty | null = {
    adults: input.adults ?? null,
    children: input.children ?? null,
    ask: askText,
    prefHints: input.prefHints ?? null,
  };

  if (!name && !destination && !similarTo && !priceBandLike && !tier) {
    return {
      hotels: [],
      experiences: [],
      did_you_mean: [],
      note: "Pass a hotel name, destination, tier, similar_to, or price_band_like.",
    };
  }

  // Named lookup (exact / fuzzy / did you mean) — Rate Layer, then Atlas
  if (name && !similarTo && !priceBandLike && !tier) {
    const { hit, didYouMean } = await resolveNamedHotel(name, destination);
    if (hit) {
      const hotels = await enrichRateHotels([hit], party);
      return attachExperiences(
        { hotels, did_you_mean: [], note: null },
        destination ?? hit.city ?? hit.destination,
        includeExperiences,
        party,
      );
    }
    if (didYouMean.length > 0) {
      return {
        hotels: [],
        experiences: [],
        did_you_mean: didYouMean,
        note: "Did you mean one of these?",
      };
    }

    const atlas = await resolveNamedAtlasHotel(name, destination);
    if (atlas.hit) {
      return attachExperiences(
        {
          hotels: [toFoundAtlas(atlas.hit, party)],
          did_you_mean: [],
          note: null,
        },
        destination ?? atlas.hit.city ?? atlas.hit.country,
        includeExperiences,
        party,
      );
    }
    if (atlas.didYouMean.length > 0) {
      return {
        hotels: [],
        experiences: [],
        did_you_mean: atlas.didYouMean,
        note: "Did you mean one of these?",
      };
    }

    return {
      hotels: [],
      experiences: [],
      did_you_mean: [],
      note: destination
        ? `No hotel matched "${name}" in ${destination}.`
        : `No hotel matched "${name}".`,
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
        experiences: [],
        did_you_mean: didYouMean,
        note: "Did you mean one of these?",
      };
    }
    if (!reference) {
      // No Rate Layer reference — still try destination Atlas shortlist below
      if (!destination) {
        return {
          hotels: [],
          experiences: [],
          did_you_mean: [],
          note: `No hotel matched "${refName}".`,
        };
      }
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
      experiences: [],
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
    candidates = await hotelsNearPrice(reference, candidates, limit, party);
  }

  // "Six Senses and two others in the same tier" — include the named hotel
  const includeNamed = Boolean(reference && (similarTo || name || tier || priceBandLike));
  const rateHits: PropertySearchHit[] = [];
  if (includeNamed && reference) {
    rateHits.push(reference);
  }
  for (const hit of candidates) {
    if (rateHits.length >= limit) break;
    if (rateHits.some((h) => h.id === hit.id)) continue;
    rateHits.push(hit);
  }

  const rateFound = await enrichRateHotels(rateHits, party);
  // Price-band keeps proximity order (matrix is tie-break inside band); others full re-rank.
  const hotels = await mergeAtlasFill(
    rateFound,
    place,
    limit,
    targetTier,
    party,
    !priceBandLike,
  );

  if (hotels.length === 0) {
    return {
      hotels: [],
      experiences: [],
      did_you_mean: [],
      note: emptyNote(place, targetTier),
    };
  }

  const onlyAtlas = hotels.every((h) => h.source === "atlas");
  const mixed =
    hotels.some((h) => h.source === "rate_layer") &&
    hotels.some((h) => h.source === "atlas");

  return attachExperiences(
    {
      hotels,
      did_you_mean: [],
      note: onlyAtlas
        ? "Preferred hotels from the destination guide — none are in the contracted rate file yet. Suggest names now; rates need a paste quote (or a linked/GDS hotel) when asked."
        : mixed
          ? "Contracted Rate Layer hotels first; preferred guide hotels fill the rest. Only call rates for contracted picks (or paste quote)."
          : null,
    },
    place,
    includeExperiences,
    party,
  );
}
