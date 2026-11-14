import {
  findKbHotelDetails,
  findPreferredKbItineraryForCountry,
  getKnowledgeBaseSetting,
  listActiveKbCitiesForCountry,
  listActiveKbCountries,
  listActiveKbCountrySeasonWindows,
  listActiveKbEntities,
  listActiveKbHotelRoomCategories,
  listApprovedKbFactsForEntity,
  listKbExperiencesForPlaceSuggest,
  listKbItineraries,
  listKbItineraryItems,
  loadKbCountryPlaceBundle,
  loadKbCityPlaceBundle,
  searchApprovedKbFacts,
  type KbCity,
  type KbCountry,
  type KbCountryFacts,
  type KbCountrySeasonWindow,
  type KbCountryVisaRule,
  type KbDestinationAudienceNote,
  type KbDestinationFacts,
  type KbEntity,
  type KbExperienceSuggestHit,
  type KbItinerary,
  type KbTripStyle,
} from "@pureluxe/db";

import { wantsHotelSearch } from "../intents";

export type AtlasHotelChoice = {
  id: string;
  name: string;
  brand: string | null;
  city: string;
  propertyId: string | null;
  contractStatus: "contracted" | "not_yet_contracted" | "unknown";
};

export type AtlasStayAnswer = {
  matched: boolean;
  answer: string;
  hotels: AtlasHotelChoice[];
  /** Place this answer is about, so a later "search hotels there" can use it. */
  place: { city: string | null; country: string | null };
};

const CONTRACT_LABEL: Record<AtlasHotelChoice["contractStatus"], string> = {
  contracted: "Contract available",
  not_yet_contracted: "No contract yet",
  unknown: "Contract status unknown",
};

const PLACE_QUESTION =
  /\b(hotels?|resorts?|villas?|visa|season|weather|currency|money|yen|safety|safe|etiquette|tipping|onsen|pitfalls?|getting\s+(there|around)|shinkansen|amenit\w*|rooms?|dining|spa|wellness|beach|island|atoll|recommend\w*|famil\w*|honeymoon|transfer|seaplane|green\s*tax|city|countr\w*|destination|place|rules?|polic\w*|check-?in|check-?out|best time|how long|kind of|where to stay|which hotel|fee|fees|entry|itinerar\w*|classic japan|grand japan|ski|things to do|experiences?|activit\w*|restaurants?|vegetarian|jain)\b/i;

const WANTS_FULL =
  /\b(full|detailed|details|everything|all info|more info|extra|complete|documents? list|document requirements|entire)\b/i;

const WANTS_VISA =
  /\b(visa|entry|passport|immigration|embassy|e-?visa|vfs)\b/i;

const WANTS_FEE =
  /\b(fee|fees|cost|charge|price|how much|rs\.?|rupees?|usd|\$)\b/i;

/** Where / how to lodge the application (not the travel destination). */
const WANTS_APPLY =
  /\b(where\s+(?:to|can|do|should)\s+(?:\w+\s+){0,4}apply|where\s+to\s+apply|apply\s+(?:for|in|from)|application\s+cent(?:re|er)|vfs|consulate|embassy\s+(?:in|at)|lodge|submit\s+(?:the\s+)?(?:visa\s+)?application)\b/i;

const WANTS_SEASON =
  /\b(season|weather|best time|when to (go|visit)|climate|sakura|cherry blossom|autumn|foliage)\b/i;

/** Where to go / first-trip destinations (not visa apply-in). */
const WANTS_WHERE =
  /\b(where to (go|visit|travel|stay)|where should (?:i|we|they)|which (cities|places|destinations)|destinations? to visit|places to visit|first (?:trip|visit|timer)|golden route|what to (see|do|cover))\b/i;

/** Suggested itinerary shapes (not the city Where spine alone). */
const WANTS_ITINERARIES =
  /\b(suggested itinerar\w*|itinerary (?:shapes?|options?|templates?)|itineraries|classic japan|japan with onsen|culture and food|grand japan|ski and cities|model (?:trip|itinerary)|route options?|which (?:itinerary|route|shape)|day-?by-?day)\b/i;

const WANTS_LENGTH =
  /\b(how long|nights?|length of stay|ideal stay|how many nights|ideal (?:trip )?length)\b/i;

const WANTS_MONEY =
  /\b(currency|money|cash|cards?|yen|usd|dollars?|pay(ment|ing)?|ATMs?)\b/i;

const WANTS_ETIQUETTE =
  /\b(etiquette|tipping|tip\b|shoes off|onsen|tattoo|quiet on trains|customs?|manners)\b/i;

const WANTS_GETTING =
  /\b(getting (there|around)|open-?jaw|haneda|narita|shinkansen|takkyubin|luggage forward|private drivers?|flights? to|airport)\b/i;

const WANTS_NEIGHBOURHOOD =
  /\b(neighbourhood|neighborhood|where to stay|area to stay|which area|hotel (?:area|location)|ginza|umeda|roppongi|otemachi|nihonbashi|akasaka)\b/i;

/** Experience bank: things to do / restaurants (not hotel shopping). */
const WANTS_EXPERIENCES =
  /\b(things to do|what to do|experiences?|activit\w*|restaurants?|where to eat|dining (?:in|for)|vegetarian|jain|book ahead|omakase|tea ceremony|sumo|teamlab)\b/i;

/** Expand the short Where spine into a longer city list. */
const WANTS_MORE_PLACES =
  /\b(more places|other (cities|places|destinations)|show more|expand|full (list|route|itinerary)|all (cities|places)|more cities|more destinations)\b/i;

/** Prefer these cities first on a country visit-plan (Japan-style spine). */
const FIRST_TRIP_CITY_ORDER = [
  "Tokyo",
  "Kyoto",
  "Osaka",
  "Hakone",
  "Nara",
  "Hiroshima",
  "Miyajima",
  "Kanazawa",
  "Takayama",
  "Niseko",
];

/** Short first answer: luxury spine (city + one onsen), not the full catalog. */
const VISIT_SPINE_NAMES = ["Tokyo", "Kyoto", "Hakone", "Osaka"] as const;
const VISIT_SPINE_CITY_CAP = 4;
const VISIT_EXPANDED_CITY_CAP = 7;
const VISIT_SEASON_BULLETS_SHORT = 4;
const VISIT_SEASON_BULLETS_EXPANDED = 6;

/** Month in [from, to], including year wrap (e.g. Nov–Feb). */
function monthInSeasonWindow(
  month: number,
  from: number | null,
  to: number | null,
): boolean {
  if (from == null || to == null) return false;
  if (from <= to) return month >= from && month <= to;
  return month >= from || month <= to;
}

/** Collect calendar months touched by an ISO date range (cap 14 steps). */
function monthsTouchedByTravel(
  travelFrom: string | null | undefined,
  travelTo: string | null | undefined,
): number[] {
  if (!travelFrom?.trim()) return [];
  const start = new Date(`${travelFrom.trim()}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return [];
  const endRaw = travelTo?.trim()
    ? new Date(`${travelTo.trim()}T00:00:00Z`)
    : start;
  const end = Number.isNaN(endRaw.getTime()) ? start : endRaw;
  const months = new Set<number>();
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  for (let i = 0; i < 14; i += 1) {
    months.add(cursor.getUTCMonth() + 1);
    if (cursor >= last) break;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return [...months];
}

function windowsForTravelMonths(
  windows: KbCountrySeasonWindow[],
  months: number[],
): KbCountrySeasonWindow[] {
  if (months.length === 0) return [];
  return windows.filter((row) =>
    months.some((month) => monthInSeasonWindow(month, row.month_from, row.month_to)),
  );
}

function formatSeasonWindowBullet(
  row: KbCountrySeasonWindow,
  tripStyle?: KbTripStyle | null,
): string {
  const title = row.months_label?.trim()
    ? `${row.label} (${row.months_label.trim()})`
    : row.label;
  const bestFor = bestForForParty(row.best_for?.trim() || null, tripStyle ?? null);
  const parts = [
    row.climate_notes?.trim() || null,
    bestFor ? `Best for: ${bestFor}` : null,
    row.watch_outs?.trim() ? `Watch out: ${row.watch_outs.trim()}` : null,
    row.book_ahead_notes?.trim() ? `Book ahead: ${row.book_ahead_notes.trim()}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return `- **${title}**`;
  return `- **${title}:** ${parts.join(" ")}`;
}

function seasonDateHeadsUp(
  countryName: string,
  windows: KbCountrySeasonWindow[],
  travelFrom: string | null | undefined,
  travelTo: string | null | undefined,
): string | null {
  const months = monthsTouchedByTravel(travelFrom, travelTo);
  const hits = windowsForTravelMonths(windows, months);
  if (hits.length === 0) return null;
  const avoid = hits.find((row) => row.demand_level === "avoid");
  const peak = hits.find((row) => row.demand_level === "peak");
  const pick = avoid ?? peak ?? hits[0]!;
  const watch = pick.watch_outs?.trim() || pick.climate_notes?.trim();
  if (!watch) return null;
  const when = pick.months_label?.trim() || pick.label;
  return `> **Heads-up:** Travel dates fall in ${countryName} ${when} — ${watch}`;
}

const FACT_STOP_WORDS = new Set([
  "about",
  "after",
  "before",
  "could",
  "hotel",
  "hotels",
  "please",
  "resort",
  "resorts",
  "should",
  "their",
  "there",
  "these",
  "those",
  "villa",
  "villas",
  "where",
  "which",
  "would",
  "passport",
  "holder",
  "holders",
  "indian",
  "trip",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word / whole-phrase match — "India" must not match inside "Indian". */
function includesName(message: string, name: string): boolean {
  const needle = name.trim();
  if (needle.length < 3) return false;
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(needle)}(?=[^\\p{L}\\p{N}]|$)`,
    "iu",
  );
  return pattern.test(message);
}

/**
 * Strip nationality / passport spans and apply-location tails so those
 * countries are not treated as the travel destination. Keep words between
 * "apply" and "in …" (e.g. "Japan" in "apply for the Japan visa in India").
 */
function textForDestinationMatch(text: string): string {
  return text
    .replace(
      /\b[\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}']*){0,2}\s+(?:passport|citizen|national|nationality)s?\b/giu,
      " ",
    )
    .replace(
      /\b(?:apply|application|vfs|centre|center|embassy|consulate|process(?:ing)?|lodge|submit)\b([\s\w,]{0,48}?)\bin\s+[\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}']*){0,2}\b/giu,
      (_full, middle: string) => ` ${middle} `,
    )
    .replace(
      /\bin\s+[\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}']*){0,2}\b(?=[\s\w,]{0,36}\b(?:apply|application|vfs|centre|center|embassy|consulate)\b)/giu,
      " ",
    )
    .replace(
      /\b(?:from|via|through)\s+[\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}']*){0,2}\b(?=[\s\w,]{0,24}\b(?:apply|application|vfs)\b)/giu,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Score how likely a country name is the travel destination in this text. */
function destinationScore(text: string, countryName: string): number {
  if (!includesName(text, countryName)) return Number.NEGATIVE_INFINITY;
  let score = countryName.length * 10;
  const name = escapeRegExp(countryName);

  if (
    new RegExp(
      `\\b(?:visit|travel(?:ling|ing)?\\s+to|trip\\s+to|going\\s+to|holiday\\s+(?:in|to)|honeymoon\\s+(?:in|to)|for)\\s+${name}\\b`,
      "i",
    ).test(text)
  ) {
    score += 120;
  }
  if (new RegExp(`\\b${name}\\s+(?:visa|trip|travel|holiday|honeymoon|itinerary|entry)\\b`, "i").test(text)) {
    score += 140;
  }
  if (new RegExp(`\\b(?:visa|entry)\\s+(?:for|to)\\s+${name}\\b`, "i").test(text)) {
    score += 140;
  }

  if (
    new RegExp(
      `\\b(?:apply|application|vfs|centre|center|embassy|consulate|process(?:ing)?|lodge|submit)\\b[\\s\\w,]{0,48}\\bin\\s+${name}\\b`,
      "i",
    ).test(text) ||
    new RegExp(
      `\\bin\\s+${name}\\b(?=[\\s\\w,]{0,36}\\b(?:apply|application|vfs|centre|center|embassy|consulate)\\b)`,
      "i",
    ).test(text) ||
    new RegExp(`\\b(?:apply|application)\\s+(?:for\\s+.{0,48}?)?(?:in|from|via)\\s+${name}\\b`, "i").test(text)
  ) {
    score -= 160;
  }

  return score;
}

function resolveCountryByName(name: string, countries: KbCountry[]): KbCountry | null {
  const needle = name.trim();
  if (!needle) return null;
  return (
    countries.find((row) => row.name.toLowerCase() === needle.toLowerCase()) ??
    countries
      .filter((row) => includesName(needle, row.name) || includesName(row.name, needle))
      .sort((a, b) => b.name.length - a.name.length)[0] ??
    null
  );
}

function resolveCityByName(name: string, cities: KbCity[]): KbCity | null {
  const needle = name.trim();
  if (!needle) return null;
  return (
    cities.find((row) => row.name.toLowerCase() === needle.toLowerCase()) ??
    cities
      .filter((row) => includesName(needle, row.name) || includesName(row.name, needle))
      .sort((a, b) => b.name.length - a.name.length)[0] ??
    null
  );
}

function bestHotel(hotels: KbEntity[], text: string): KbEntity | null {
  const tokens = new Set(
    (text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter(
      (word) => !FACT_STOP_WORDS.has(word),
    ),
  );
  return (
    hotels
      .filter((hotel) => {
        const name = hotel.name.toLowerCase();
        const brand = hotel.brand?.toLowerCase() ?? "";
        if (includesName(text, hotel.name) || (brand && includesName(text, brand))) {
          return true;
        }
        return [...tokens].some(
          (token) => token.length >= 5 && (name.includes(token) || brand.includes(token)),
        );
      })
      .sort((a, b) => b.name.length - a.name.length)[0] ?? null
  );
}

/** Hotel name anywhere in the knowledge base, not only in the saved stay's city. */
async function findNamedHotel(text: string, pool: KbEntity[]): Promise<KbEntity | null> {
  const local = bestHotel(pool, text);
  if (local) return local;
  const words = [
    ...new Set(text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []),
  ]
    .filter((word) => !FACT_STOP_WORDS.has(word))
    .slice(0, 3);
  const queries = text.trim().length <= 60 ? [text.trim(), ...words] : words;
  const found: KbEntity[] = [];
  const seen = new Set<string>();
  for (const query of queries) {
    if (!query) continue;
    const rows = await listActiveKbEntities({
      q: query,
      entity_type: "hotel",
      include_placeholders: false,
      include_not_yet_contracted: true,
      limit: 12,
    });
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      found.push(row);
    }
  }
  return bestHotel(found, text);
}

function asksAboutPlace(question: string): boolean {
  return PLACE_QUESTION.test(question);
}

function matchCountry(text: string, countries: KbCountry[]): KbCountry | null {
  const destinationText = textForDestinationMatch(text);
  const scored = countries
    .map((row) => ({
      row,
      score: Math.max(destinationScore(text, row.name), destinationScore(destinationText, row.name)),
    }))
    .filter((hit) => Number.isFinite(hit.score))
    .sort((a, b) => b.score - a.score || b.row.name.length - a.row.name.length);
  if (scored.length > 0 && scored[0]!.score > 0) return scored[0]!.row;

  // Soft fallback only when stripping left a clear single country.
  const byName = countries
    .filter((row) => includesName(destinationText, row.name))
    .sort((a, b) => b.name.length - a.name.length);
  if (byName.length === 1) return byName[0]!;
  if (byName.length > 1) {
    const ranked = byName
      .map((row) => ({ row, score: destinationScore(text, row.name) }))
      .sort((a, b) => b.score - a.score || b.row.name.length - a.row.name.length);
    if (ranked[0] && ranked[0].score > (ranked[1]?.score ?? Number.NEGATIVE_INFINITY)) {
      return ranked[0].row;
    }
  }

  const byCode = countries.find((row) => {
    const code = row.country_code.trim().toUpperCase();
    return code.length >= 2 && new RegExp(`\\b${code}\\b`).test(text.toUpperCase());
  });
  return byCode ?? null;
}

function matchCity(text: string, cities: KbCity[]): KbCity | null {
  const destinationText = textForDestinationMatch(text);
  return (
    cities
      .filter((row) => includesName(destinationText, row.name))
      .sort((a, b) => b.name.length - a.name.length)[0] ?? null
  );
}

/** "What is Paris like?" names a place. "Tell me about this trip" does not. */
function namesAnotherPlace(question: string, hint: string): boolean {
  const named = question.match(
    /\b(?:in|for|about|to|visit|is)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/,
  );
  if (!named) return false;
  const name = named[1].toLowerCase();
  const saved = hint.toLowerCase();
  return name !== saved && !saved.includes(name) && !name.includes(saved);
}

function contractStatus(value: string): AtlasHotelChoice["contractStatus"] {
  if (value === "contracted" || value === "not_yet_contracted") return value;
  return "unknown";
}

function section(title: string, lines: Array<string | null | undefined>): string | null {
  const body = lines.map((line) => line?.trim() ?? "").filter(Boolean);
  if (body.length === 0) return null;
  return `**${title}**\n${body.map((line) => `- ${line}`).join("\n")}`;
}

function visaLabel(entry: string | null): string | null {
  if (entry === "visa_free") return "visa free";
  if (entry === "e_visa") return "e-visa";
  if (entry === "visa_on_arrival") return "visa on arrival";
  if (entry === "embassy") return "embassy / sticker visa";
  return null;
}

function firstSentence(text: string | null | undefined, max = 220): string | null {
  const raw = text?.trim();
  if (!raw) return null;
  const sentence = raw.split(/(?<=[.!?])\s+/)[0]?.trim() || raw;
  if (sentence.length <= max) return sentence;
  return `${sentence.slice(0, max - 1).trim()}…`;
}

/** Prefer typed columns; fall back to legacy details prose labels. */
function visaFeeText(visa: KbCountryVisaRule): string | null {
  const typed = visa.fee_text?.trim();
  if (typed) return typed;
  const details = visa.details;
  if (!details) return null;
  const patterns = [
    /Fee:\s*([^\n.]+)/i,
    /\b(?:Rs\.?|INR|USD|EUR|GBP)\s*[\d,]+(?:\s*per\s*person)?/i,
    /\b[\d,]+\s*(?:Rs\.?|INR|USD|EUR|GBP)(?:\s*per\s*person)?/i,
  ];
  for (const pattern of patterns) {
    const hit = details.match(pattern);
    if (hit?.[0]) {
      const value = (hit[1] ?? hit[0]).trim().replace(/^Fee:\s*/i, "");
      if (value) return value;
    }
  }
  return null;
}

function visaProcessingText(visa: KbCountryVisaRule): string | null {
  const typed = visa.processing_text?.trim();
  if (typed) return typed;
  if (!visa.details) return null;
  const hit = visa.details.match(/Processing:\s*([^\n.]+)/i);
  return hit?.[1]?.trim() || null;
}

function visaWhereToApply(visa: KbCountryVisaRule): string | null {
  const typed = visa.where_to_apply?.trim();
  if (typed) return typed;
  if (!visa.details) return null;
  const patterns = [
    /Where to apply:\s*([^\n]+)/i,
    /Application(?:\s+cent(?:re|er))?:\s*([^\n]+)/i,
    /VFS[^\n]*/i,
  ];
  for (const pattern of patterns) {
    const hit = visa.details.match(pattern);
    if (hit?.[1]?.trim()) return hit[1].trim();
    if (hit?.[0] && /^VFS/i.test(hit[0])) return hit[0].trim();
  }
  return null;
}

/** Split documents_text into short bullets (max `limit`). */
function visaDocumentBullets(text: string | null | undefined, limit = 8): string[] {
  const raw = text?.trim();
  if (!raw) return [];
  const byPipe = raw
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 8);
  if (byPipe.length > 1) return byPipe.slice(0, limit);
  const bySemi = raw
    .split(/;\s+/)
    .map((part) => part.trim().replace(/\.$/, ""))
    .filter((part) => part.length > 8);
  if (bySemi.length > 1) return bySemi.slice(0, limit);
  return noteBullets(raw, limit);
}

/**
 * If trip starts sooner than ~14 days and processing mentions weeks, warn once.
 */
function visaLeadTimeHeadsUp(
  processing: string | null,
  travelFrom: string | null | undefined,
): string | null {
  if (!processing || !travelFrom?.trim()) return null;
  if (!/\b\d+\s*weeks?\b/i.test(processing) && !/\b2\s*weeks?\b/i.test(processing)) {
    return null;
  }
  const start = new Date(`${travelFrom.trim()}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.round((start.getTime() - todayUtc) / 86_400_000);
  if (days < 0 || days > 14) return null;
  return `> **Heads-up:** Travel starts in about ${days} day${days === 1 ? "" : "s"} — visa processing is typically ${processing}; confirm whether the sticker route still fits.`;
}

type PlaceFocus =
  | "visa"
  | "season"
  | "visit_plan"
  | "itineraries"
  | "experiences"
  | "length"
  | "money"
  | "etiquette"
  | "getting"
  | "neighbourhood"
  | "city"
  | "hotels"
  | "general";

/** Infer trip style from the ask so audience notes can attach when relevant. */
function detectTripStyle(question: string): KbTripStyle | null {
  if (/\bhoneymoon\b|\bcouples?\b/i.test(question)) return "honeymoon";
  if (/\bfamil\w*\b|\bkids?\b|\bchildren\b/i.test(question)) return "family";
  if (/\bbusiness\b/i.test(question)) return "business";
  if (/\bsolo\b/i.test(question)) return "solo";
  if (/\bgroup\b/i.test(question)) return "group";
  return null;
}

/**
 * Trip party from Studio (travellers on the open trip). Children → family;
 * never assume honeymoon for two adults alone.
 */
function tripStyleFromParty(
  adults: number | null | undefined,
  children: number | null | undefined,
): KbTripStyle | null {
  const a = typeof adults === "number" && adults >= 0 ? adults : null;
  const c = typeof children === "number" && children >= 0 ? children : null;
  if (a == null && c == null) return null;
  const adultCount = a ?? 0;
  const childCount = c ?? 0;
  if (adultCount + childCount <= 0) return null;
  if (childCount > 0) return "family";
  if (adultCount === 1) return "solo";
  if (adultCount >= 3) return "group";
  return null;
}

/** Party on the trip wins over ask keywords when it is a family (kids travelling). */
function resolveTripStyle(
  question: string,
  adults?: number | null,
  children?: number | null,
): KbTripStyle | null {
  const fromParty = tripStyleFromParty(adults, children);
  if (fromParty === "family") return "family";
  return detectTripStyle(question) ?? fromParty;
}

/** Drop honeymoon/couples-only Best-for lines when the trip party is a family. */
function bestForForParty(
  bestFor: string | null | undefined,
  tripStyle: KbTripStyle | null,
): string | null {
  const text = bestFor?.trim() || null;
  if (!text) return null;
  if (
    tripStyle === "family" &&
    /\bhoneymoon\b|\bcouples?\b/i.test(text) &&
    !/\bfamil\w*|\bkids?\b|\bchildren\b/i.test(text)
  ) {
    return null;
  }
  return text;
}

function placeFocus(question: string, listHotels: boolean): PlaceFocus {
  if (listHotels) return "hotels";
  if (WANTS_VISA.test(question) || WANTS_FEE.test(question) || WANTS_APPLY.test(question)) {
    return "visa";
  }
  if (WANTS_ITINERARIES.test(question)) return "itineraries";
  if (WANTS_EXPERIENCES.test(question)) return "experiences";
  const wantsSeason = WANTS_SEASON.test(question);
  const wantsWhere = WANTS_WHERE.test(question);
  // When + where (or where / first-trip alone) → structured visit plan from Atlas.
  if (wantsWhere || (wantsSeason && /\band\b/i.test(question) && /\bwhere\b/i.test(question))) {
    return "visit_plan";
  }
  if (wantsSeason) return "season";
  if (WANTS_LENGTH.test(question)) return "length";
  if (WANTS_MONEY.test(question)) return "money";
  if (WANTS_ETIQUETTE.test(question)) return "etiquette";
  if (WANTS_GETTING.test(question)) return "getting";
  if (WANTS_NEIGHBOURHOOD.test(question)) return "neighbourhood";
  if (/\b(vibe|like|what.?s it like)\b/i.test(question)) return "city";
  return "general";
}

function formatExperienceBullet(hit: KbExperienceSuggestHit): string {
  const kindLabel =
    hit.guide_type?.trim() ||
    (hit.kind === "restaurant" ? "Restaurant" : "Activity");
  const bits = [
    hit.why,
    hit.who_it_suits ? `**Suits:** ${firstSentence(hit.who_it_suits, 60)}` : null,
    hit.lead_time ? `**Lead time:** ${firstSentence(hit.lead_time, 70)}` : null,
    hit.veg_jain && !/^n\/a$/i.test(hit.veg_jain.trim())
      ? `**Veg/Jain:** ${firstSentence(hit.veg_jain, 70)}`
      : null,
  ].filter(Boolean);
  return `- **${hit.name}** (${kindLabel})${bits.length ? `: ${bits.join(" — ")}` : ""}`;
}

async function briefExperiencesAnswer(
  placeLabel: string,
  placeHint: string,
  question: string,
  wantFull: boolean,
  party?: { adults?: number | null; children?: number | null },
): Promise<string> {
  const restaurantsOnly = /\brestaurants?|where to eat|dining|omakase|vegetarian|jain\b/i.test(
    question,
  ) && !/\bthings to do|experiences?|activit\w*\b/i.test(question);
  const activitiesOnly =
    /\bthings to do|experiences?|activit\w*\b/i.test(question) &&
    !/\brestaurants?|where to eat|dining|omakase\b/i.test(question);
  const activityLimit = restaurantsOnly ? 0 : wantFull ? 6 : 4;
  const restaurantLimit = activitiesOnly ? 0 : wantFull ? 4 : 3;
  const partyStyle = resolveTripStyle(question, party?.adults, party?.children);
  const hits = await listKbExperiencesForPlaceSuggest({
    place: placeHint,
    activityLimit,
    restaurantLimit,
    preferFamily:
      partyStyle === "family" || /\bfamil\w*|\bkids?\b|\bchildren\b/i.test(question),
    preferCouples:
      partyStyle !== "family" &&
      (partyStyle === "honeymoon" || /\bhoneymoon\b|\bcouples?\b/i.test(question)),
    preferVeg: /\bvegetarian|jain|veg\b/i.test(question),
    preferBookAhead: /\bbook ahead|lead time|reserve|omakase\b/i.test(question),
  });
  if (hits.length === 0) {
    return `I don't have curated experiences or restaurants for ${placeLabel} yet.`;
  }
  const city = hits[0]?.city?.trim() || placeLabel;
  const blocks = [
    `**${city} — experience bank** (unverified guide entries; confirm before booking)`,
    hits.map(formatExperienceBullet).join("\n"),
  ];
  if (!wantFull) {
    blocks.push(
      "Ask for more / full list, restaurants only, or vegetarian / Jain options if needed.",
    );
  }
  return blocks.join("\n\n");
}

/** Score a template against the advisor ask (style / ski / nights / title). */
function scoreItineraryForQuestion(row: KbItinerary, question: string): number {
  const q = question.toLowerCase();
  const title = row.title.toLowerCase();
  let score = 0;
  if (q.includes(title)) score += 50;
  if (/\bski\b|niseko|powder/i.test(q) && /ski/i.test(title)) score += 40;
  if (/\bonsen\b|hakone|ryokan|slow luxury|couples?/i.test(q) && /onsen/i.test(title)) {
    score += 35;
  }
  if (/\bculture\b|food-?led|kanazawa/i.test(q) && /culture|food/i.test(title)) {
    score += 30;
  }
  if (/\bgrand\b|return|extended|naoshima|hiroshima/i.test(q) && /grand/i.test(title)) {
    score += 30;
  }
  if (
    /\btight schedule|short trip|classic|first[- ]?timers?/i.test(q) &&
    /classic/i.test(title)
  ) {
    score += 25;
  }
  if (row.is_default_first_trip) score += 5;
  const nightsMatch = q.match(/\b(\d{1,2})\s*-?\s*nights?\b/);
  if (nightsMatch && row.duration_nights != null) {
    const want = Number(nightsMatch[1]);
    if (want === row.duration_nights) score += 20;
    else if (Math.abs(want - row.duration_nights) <= 2) score += 8;
  }
  const suits = row.suits?.toLowerCase() ?? "";
  if (/\bhoneymoon\b|\bcouples?\b/i.test(q) && /couple|honeymoon|slow luxury/i.test(suits)) {
    score += 15;
  }
  if (/\bfamil\w*|\bkids?\b/i.test(q) && /famil/i.test(suits)) score += 15;
  if (/\bfood\b/i.test(q) && /food/i.test(suits)) score += 10;
  return score;
}

function pickItineraryForQuestion(
  rows: KbItinerary[],
  question: string,
): KbItinerary | null {
  if (rows.length === 0) return null;
  const scored = rows
    .map((row) => ({ row, score: scoreItineraryForQuestion(row, question) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.row.sort_order - b.row.sort_order ||
        a.row.title.localeCompare(b.row.title),
    );
  const best = scored[0];
  if (!best || best.score < 15) return null;
  return best.row;
}

function formatItineraryShapeBullet(row: KbItinerary): string {
  const nights =
    row.duration_nights != null ? `${row.duration_nights} nights` : null;
  const route = firstSentence(row.destination_summary, 160);
  const suits = firstSentence(row.suits, 80);
  const bits = [
    nights,
    route,
    suits ? `**Suits:** ${suits}` : null,
  ].filter(Boolean);
  return `- **${row.title}**${bits.length ? ` — ${bits.join(" — ")}` : ""}`;
}

async function briefItinerariesAnswer(
  countryName: string,
  countryId: string,
  question: string,
  wantFull: boolean,
): Promise<string> {
  const rows = await listKbItineraries({
    country_id: countryId,
    active_only: true,
    limit: 20,
  });
  if (rows.length === 0) {
    return `I don't have suggested itinerary shapes for ${countryName} yet.`;
  }

  const matched = pickItineraryForQuestion(rows, question);
  const showAll = !matched || WANTS_FULL.test(question) || /\ball\b|list\b|options?\b|shapes?\b/i.test(question);
  const blocks: string[] = [];

  if (matched && !showAll) {
    blocks.push(`**${countryName} — ${matched.title}**`);
    blocks.push(
      [
        matched.duration_nights != null
          ? `- **Length:** ${matched.duration_nights} nights (draft guide count)`
          : null,
        matched.destination_summary
          ? `- **Route:** ${matched.destination_summary}`
          : null,
        matched.suits ? `- **Suits:** ${matched.suits}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  } else {
    blocks.push(`**${countryName} — suggested itinerary shapes**`);
    const list = matched
      ? [matched, ...rows.filter((row) => row.id !== matched.id)]
      : rows;
    blocks.push(list.map(formatItineraryShapeBullet).join("\n"));
  }

  const seasonalRow =
    rows.find((row) => row.seasonal_notes?.trim()) ??
    rows.find((row) => row.is_default_first_trip) ??
    null;
  const seasonal = seasonalRow?.seasonal_notes?.trim();
  if (seasonal && (wantFull || /\bseason|sakura|autumn|summer|honeymoon|famil/i.test(question))) {
    const lines = seasonal
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, wantFull ? 8 : 5);
    blocks.push(
      `### Seasonal variants\n${lines.map((line) => `- ${line}`).join("\n")}`,
    );
  }

  if (wantFull && matched) {
    const items = await listKbItineraryItems(matched.id);
    if (items.length > 0) {
      const dayLines = items
        .slice(0, 16)
        .map((item) => {
          const note = item.note?.trim();
          return note
            ? `- **Day ${item.day_number}:** ${firstSentence(note, 140) ?? note}`
            : null;
        })
        .filter(Boolean);
      if (dayLines.length > 0) {
        blocks.push(
          `### Day outline (draft — not guide-verified)\n${dayLines.join("\n")}`,
        );
      }
    }
  }

  if (!wantFull) {
    blocks.push(
      matched && !showAll
        ? "Ask for all shapes, seasonal variants, or a fuller day outline if useful."
        : "Night counts are still draft; PureLuxe first-time pace often lengthens Classic. Say which shape to expand.",
    );
  }

  return blocks.filter(Boolean).join("\n\n");
}

/** Soft-cap a logistics note without dropping later sentences (luggage, drivers…). */
function clipNote(text: string, maxChars: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars - 1).trim()}…`;
}

/** Labelled country logistics for Where / full briefs (typed columns, not general_notes lottery). */
function pushLogisticsBullet(
  lines: string[],
  label: string,
  value: string | null | undefined,
  maxChars: number,
): void {
  const text = value?.trim();
  if (!text) return;
  lines.push(`- **${label}:** ${clipNote(text, maxChars)}`);
}

function countryLogisticsBullets(
  facts: KbCountryFacts | null,
  expanded: boolean,
): string[] {
  if (!facts) return [];
  const max = expanded ? 360 : 260;
  const lines: string[] = [];
  pushLogisticsBullet(lines, "First visit", facts.general_notes, max);
  pushLogisticsBullet(lines, "Ideal length", facts.ideal_trip_length, max);
  pushLogisticsBullet(lines, "Getting there", facts.getting_there, max);
  pushLogisticsBullet(lines, "Getting around", facts.getting_around, max);
  if (expanded) {
    const money =
      [facts.currency_code?.trim(), facts.currency_notes?.trim()]
        .filter(Boolean)
        .join(". ") || null;
    pushLogisticsBullet(lines, "Money", money, max);
    pushLogisticsBullet(lines, "Etiquette", facts.etiquette_notes, max);
    pushLogisticsBullet(lines, "Restaurants", facts.dining_notes, max);
    pushLogisticsBullet(lines, "Pitfalls", facts.pitfalls, max);
    pushLogisticsBullet(lines, "Safety", facts.safety_notes, max);
  }
  return lines;
}

function briefCountryMoney(countryName: string, facts: KbCountryFacts | null): string {
  if (!facts) {
    return `I don't have currency notes for ${countryName} yet.`;
  }
  const code = facts.currency_code?.trim();
  const notes = facts.currency_notes?.trim();
  if (!code && !notes) {
    return `I don't have currency notes for ${countryName} yet.`;
  }
  return [
    `**${countryName} — money**`,
    code ? `- **Currency:** ${code}` : null,
    notes ? `- **Notes:** ${firstSentence(notes, 220) ?? notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function briefCountryEtiquette(countryName: string, facts: KbCountryFacts | null): string {
  const text = facts?.etiquette_notes?.trim();
  if (!text) {
    return `I don't have etiquette notes for ${countryName} yet.`;
  }
  return `**${countryName} — etiquette**\n- ${firstSentence(text, 280) ?? text}`;
}

function briefCountryGetting(
  countryName: string,
  facts: KbCountryFacts | null,
  question: string,
): string {
  const wantAround = /\baround\b|shinkansen|takkyubin|driver|transfer|luggage/i.test(question);
  const wantThere = /\bthere\b|flight|airport|open-?jaw|haneda|narita/i.test(question);
  const lines: string[] = [];
  if (!wantAround || wantThere || (!wantThere && !wantAround)) {
    pushLogisticsBullet(lines, "Getting there", facts?.getting_there, 280);
  }
  if (!wantThere || wantAround || (!wantThere && !wantAround)) {
    pushLogisticsBullet(lines, "Getting around", facts?.getting_around, 280);
  }
  if (lines.length === 0) {
    return `I don't have getting-there / getting-around notes for ${countryName} yet.`;
  }
  return `**${countryName}**\n${lines.join("\n")}`;
}

function briefCountryLength(countryName: string, facts: KbCountryFacts | null): string {
  const text = facts?.ideal_trip_length?.trim();
  if (!text) {
    return `I don't have an ideal trip length for ${countryName} yet.`;
  }
  return `**${countryName}:** ${firstSentence(text, 220) ?? text}`;
}

/** Split a long Atlas note into short bullets (max `limit`). */
function noteBullets(text: string, limit = 6): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);
  return (parts.length > 0 ? parts : [cleaned]).slice(0, limit);
}

/** `- **Label:** rest` when the line already has a short lead-in before a colon. */
function formatVisitBullet(line: string): string {
  const trimmed = line.replace(/^[-•*]\s*/, "").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^([^:]{2,48}):\s+(.+)$/);
  if (match) {
    return `- **${match[1]!.trim()}:** ${match[2]!.trim()}`;
  }
  return `- ${trimmed}`;
}

function cityPriority(name: string): number {
  const index = FIRST_TRIP_CITY_ORDER.findIndex(
    (row) => row.toLowerCase() === name.trim().toLowerCase(),
  );
  return index === -1 ? 999 : index;
}

function orderedVisitCities(cities: KbCity[]): KbCity[] {
  return [...cities]
    .filter((city) => city.name !== "Unspecified")
    .sort(
      (a, b) =>
        cityPriority(a.name) - cityPriority(b.name) || a.name.localeCompare(b.name),
    );
}

/** Short = Tokyo/Kyoto/onsen spine; expanded = longer curated list (still capped). */
function pickVisitCities(cities: KbCity[], expanded: boolean): KbCity[] {
  const ordered = orderedVisitCities(cities);
  if (expanded) return ordered.slice(0, VISIT_EXPANDED_CITY_CAP);

  const picked: KbCity[] = [];
  for (const name of VISIT_SPINE_NAMES) {
    if (picked.length >= VISIT_SPINE_CITY_CAP) break;
    const hit = ordered.find((city) => city.name.toLowerCase() === name.toLowerCase());
    if (hit && !picked.some((row) => row.id === hit.id)) picked.push(hit);
  }
  for (const city of ordered) {
    if (picked.length >= VISIT_SPINE_CITY_CAP) break;
    if (!picked.some((row) => row.id === city.id)) picked.push(city);
  }
  return picked;
}

type VisitPlanOptions = {
  includeWhen: boolean;
  includeWhere: boolean;
  expanded: boolean;
  /** Prefer full season table (weather / climate asks). */
  preferSeasonTable: boolean;
  travelFrom?: string | null;
  travelTo?: string | null;
  tripStyle?: KbTripStyle | null;
};

function formatVisitCityBullet(
  cityName: string,
  facts: KbDestinationFacts,
  options: {
    expanded: boolean;
    audienceNote?: string | null;
    tripStyle?: KbTripStyle | null;
  },
): string {
  const nights = firstSentence(facts.ideal_length_of_stay, 90);
  const vibe = firstSentence(facts.vibe, 140);
  const bestFor = bestForForParty(firstSentence(facts.best_for, 80), options.tripStyle ?? null);
  const season = options.expanded
    ? firstSentence(facts.best_time_to_visit, 70)
    : null;
  const audience = options.audienceNote
    ? firstSentence(options.audienceNote, 120)
    : null;
  const styleLabel = options.tripStyle ?? "this style";
  const bits = [
    vibe ?? null,
    bestFor ? `**Best for:** ${bestFor}` : null,
    season ? `**Season:** ${season}` : null,
    audience ? `**For ${styleLabel}:** ${audience}` : null,
  ].filter(Boolean);
  const body = bits.length > 0 ? bits.join(" — ") : "See destination notes.";
  return `- **${cityName}**${nights ? ` (${nights})` : ""}: ${body}`;
}

/**
 * Fora-style When / Where briefing from country + city Atlas facts only.
 * Short by default (spine); expanded only when they ask for more / full / weather.
 */
async function briefVisitPlanAnswer(
  country: KbCountry,
  facts: KbCountryFacts | null,
  cities: KbCity[],
  seasonWindows: KbCountrySeasonWindow[],
  options: VisitPlanOptions,
): Promise<string> {
  const blocks: string[] = [];
  const { includeWhen, includeWhere, expanded, preferSeasonTable, tripStyle } =
    options;

  const audienceLead =
    tripStyle === "family"
      ? "family trip"
      : tripStyle === "honeymoon"
        ? "honeymoon"
        : tripStyle === "solo"
          ? "solo trip"
          : tripStyle === "group"
            ? "group trip"
            : "first luxury trip";
  blocks.push(
    expanded || preferSeasonTable
      ? `${country.name} — fuller ${audienceLead} map:`
      : `${country.name} for a ${audienceLead}:`,
  );

  if (includeWhen) {
    blocks.push(
      briefWhenToGo(country.name, facts?.best_season ?? null, seasonWindows, {
        expanded: expanded || preferSeasonTable,
        travelFrom: options.travelFrom,
        travelTo: options.travelTo,
        tripStyle: options.tripStyle,
      }),
    );
  }

  if (includeWhere) {
    const whereLines: string[] = [...countryLogisticsBullets(facts, expanded)];

    const itinerary = await findPreferredKbItineraryForCountry(country.id);
    if (itinerary?.title) {
      const nights =
        itinerary.duration_nights != null
          ? `${itinerary.duration_nights} nights`
          : null;
      const route = firstSentence(itinerary.destination_summary, 160);
      const suits = bestForForParty(firstSentence(itinerary.suits, 70), tripStyle ?? null);
      const shapeBits = [nights, route, suits ? `Suits ${suits}` : null]
        .filter(Boolean)
        .join(" — ");
      whereLines.push(
        `- **First-trip shape — ${itinerary.title}:** ${
          shapeBits || "See destination notes for nights."
        }`,
      );
      if (!expanded) {
        whereLines.push(
          `- **Other shapes:** ask for suggested itineraries (onsen, culture/food, grand, ski).`,
        );
      }
    }

    const picked = pickVisitCities(cities, expanded);
    let cityCount = 0;
    for (const city of picked) {
      const bundle = await loadKbCityPlaceBundle({
        city_id: city.id,
        trip_style: tripStyle ?? null,
      });
      const cityFacts = bundle?.facts;
      if (!cityFacts) continue;
      if (
        !cityFacts.ideal_length_of_stay?.trim() &&
        !cityFacts.vibe?.trim() &&
        !cityFacts.best_for?.trim()
      ) {
        continue;
      }
      whereLines.push(
        formatVisitCityBullet(city.name, cityFacts, {
          expanded,
          audienceNote: bundle?.audience_note?.note ?? null,
          tripStyle: tripStyle ?? null,
        }),
      );
      cityCount += 1;
    }

    if (!expanded && cityCount > 0) {
      whereLines.push(
        `- **More places:** say if you want a longer city list beyond this spine.`,
      );
    }

    blocks.push(
      whereLines.length > 0
        ? `### Where to go\n${whereLines.join("\n")}`
        : `### Where to go\n- I don't have city destination notes for ${country.name} yet.`,
    );
  }

  return blocks.join("\n\n");
}

function briefVisaAnswer(
  countryName: string,
  passport: string,
  visa: KbCountryVisaRule | null,
  wantFee: boolean,
  wantApply: boolean,
  wantFull: boolean,
  travelFrom?: string | null,
): string {
  if (!visa) {
    return `I don't have ${countryName} visa information for a ${passport} passport on file yet.`;
  }
  const kind = visaLabel(visa.entry_type);
  const fee = visaFeeText(visa);
  const processing = visaProcessingText(visa);
  const whereToApply = visaWhereToApply(visa);
  const alternate = visa.alternate_routes?.trim() || null;
  const tips = visa.advisor_tips?.trim() || null;
  const docs = visa.documents_text?.trim() || null;
  const headsUp = visaLeadTimeHeadsUp(processing, travelFrom);

  if (wantApply && !wantFull) {
    if (whereToApply) {
      return [
        `For a ${countryName} visa (${passport} passport), apply at: **${whereToApply}**.${
          processing ? ` Processing is typically ${processing}.` : ""
        }`,
        headsUp,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    return `${firstSentence(visa.summary) ?? visa.summary}${
      kind ? ` (${kind})` : ""
    }. I don't have a separate "where to apply" line on file — ask if you want the full visa notes.`;
  }

  if (wantFee && !wantFull) {
    if (fee) {
      return [
        `${countryName} visa fee for a ${passport} passport: **${fee}**.${
          processing ? ` Processing is typically ${processing}.` : ""
        }${kind ? ` (${kind})` : ""}`,
        headsUp,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    return `${countryName}: ${firstSentence(visa.summary) ?? visa.summary}${
      kind ? ` (${kind})` : ""
    }. I don't have a separate fee line on file — ask if you want the full visa notes.`;
  }

  if (!wantFull) {
    const bits = [
      firstSentence(visa.summary) ?? visa.summary,
      kind ? `(${kind})` : null,
      fee ? `Fee: ${fee}` : null,
      processing ? `Processing: ${processing}` : null,
      whereToApply ? `Apply: ${whereToApply}` : null,
      alternate ? `Also: ${firstSentence(alternate, 140)}` : null,
    ].filter(Boolean);
    return [bits.join(" "), headsUp].filter(Boolean).join("\n\n");
  }

  const docBullets = visaDocumentBullets(docs, 10);
  const lines = [
    `**${countryName} visa (${passport} passport)**`,
    `- ${visa.summary}${kind ? ` (${kind})` : ""}`,
    visa.is_pureluxe_default === false ? `- Not the PureLuxe default route for this passport.` : null,
    fee ? `- **Fee:** ${fee}` : null,
    processing ? `- **Processing:** ${processing}` : null,
    whereToApply ? `- **Where to apply:** ${whereToApply}` : null,
    alternate ? `- **Alternate route:** ${alternate}` : null,
    tips ? `- **Advisor tips:** ${tips}` : null,
    docBullets.length > 0
      ? `- **Typical documents:**\n${docBullets.map((line) => `  - ${line}`).join("\n")}`
      : null,
    visa.official_url ? `- **Official page:** ${visa.official_url}` : null,
    visa.details?.trim() && !docs
      ? `- **Notes:** ${visa.details.trim()}`
      : visa.details?.trim() && docs
        ? `- **Sources / notes:** ${firstSentence(visa.details, 200)}`
        : null,
  ].filter(Boolean);

  return [lines.join("\n"), headsUp].filter(Boolean).join("\n\n");
}

/**
 * When to go: short PureLuxe summary always; season table when expanded / weather.
 * Optional Heads-up when trip dates overlap a window with watch-outs.
 */
function briefWhenToGo(
  countryName: string,
  bestSeason: string | null,
  windows: KbCountrySeasonWindow[],
  options: {
    expanded: boolean;
    travelFrom?: string | null;
    travelTo?: string | null;
    tripStyle?: KbTripStyle | null;
  },
): string {
  const parts: string[] = [];
  const summary = bestSeason?.trim() || null;
  const summaryCap = options.expanded
    ? VISIT_SEASON_BULLETS_EXPANDED
    : VISIT_SEASON_BULLETS_SHORT;
  const summaryLines = summary ? noteBullets(summary, summaryCap) : [];

  if (summaryLines.length > 0) {
    parts.push(
      summaryLines.length === 1 && !options.expanded
        ? `### When to go\n**${countryName}:** ${summaryLines[0]}`
        : `### When to go\n${summaryLines.map(formatVisitBullet).filter(Boolean).join("\n")}`,
    );
  } else if (windows.length === 0) {
    return `### When to go\n- I don't have a best-time note for ${countryName} yet.`;
  } else {
    parts.push(`### When to go`);
  }

  if (options.expanded && windows.length > 0) {
    parts.push(
      `**Season by season:**\n${windows
        .map((row) => formatSeasonWindowBullet(row, options.tripStyle))
        .join("\n")}`,
    );
  }

  const headsUp = seasonDateHeadsUp(
    countryName,
    windows,
    options.travelFrom,
    options.travelTo,
  );
  if (headsUp) parts.push(headsUp);

  return parts.join("\n\n");
}

function briefSeasonAnswer(
  countryName: string,
  bestSeason: string | null,
  windows: KbCountrySeasonWindow[],
  travelFrom?: string | null,
  travelTo?: string | null,
  tripStyle?: KbTripStyle | null,
): string {
  return briefWhenToGo(countryName, bestSeason, windows, {
    expanded: windows.length > 0,
    travelFrom,
    travelTo,
    tripStyle,
  });
}

function briefCityAnswer(
  cityName: string,
  facts: KbDestinationFacts | null,
  focus: PlaceFocus,
  wantFull: boolean,
  audienceNote?: KbDestinationAudienceNote | null,
  tripStyle?: KbTripStyle | null,
): string | null {
  if (!facts) return null;
  const bestForLine = bestForForParty(facts.best_for, tripStyle ?? audienceNote?.trip_style ?? null);
  if (wantFull) {
    return (
      section(cityName, [
        facts.best_time_to_visit,
        facts.ideal_length_of_stay,
        facts.vibe,
        bestForLine ? `Best for: ${bestForLine}` : null,
        facts.staff_notes,
        audienceNote?.note
          ? `For ${audienceNote.trip_style}: ${audienceNote.note}`
          : null,
      ]) ?? null
    );
  }
  if (focus === "length") {
    return facts.ideal_length_of_stay
      ? `**${cityName}:** ${firstSentence(facts.ideal_length_of_stay, 160)}`
      : `I don't have an ideal length of stay for ${cityName} on file yet.`;
  }
  if (focus === "season") {
    return facts.best_time_to_visit
      ? `**${cityName}:** ${firstSentence(facts.best_time_to_visit, 160)}`
      : null;
  }
  if (focus === "neighbourhood") {
    const notes = facts.staff_notes?.trim();
    if (!notes) {
      return `I don't have neighbourhood / where-to-stay notes for ${cityName} yet.`;
    }
    return `**${cityName} — neighbourhood**\n- ${clipNote(notes, 360)}`;
  }
  const vibe = firstSentence(facts.vibe, 180);
  const nights = firstSentence(facts.ideal_length_of_stay, 100);
  const bestFor = bestForForParty(
    firstSentence(facts.best_for, 100),
    tripStyle ?? audienceNote?.trip_style ?? null,
  );
  const audience = audienceNote?.note
    ? firstSentence(audienceNote.note, 140)
    : null;
  if (!vibe && !nights && !bestFor && !audience) return null;
  return [
    `**${cityName}**`,
    vibe,
    nights ? `Typical stay: ${nights}` : null,
    bestFor ? `Best for: ${bestFor}` : null,
    audience ? `For ${audienceNote!.trip_style}: ${audience}` : null,
  ]
    .filter(Boolean)
    .join(" — ");
}

async function hotelsForCity(city: KbCity): Promise<KbEntity[]> {
  return listActiveKbEntities({
    city_id: city.id,
    entity_type: "hotel",
    include_placeholders: false,
    include_not_yet_contracted: true,
    limit: 20,
  });
}

async function describeHotel(hotel: KbEntity, wantFull: boolean): Promise<string[]> {
  const [details, rooms, facts] = await Promise.all([
    findKbHotelDetails(hotel.id),
    listActiveKbHotelRoomCategories(hotel.id),
    listApprovedKbFactsForEntity(hotel.id),
  ]);
  if (!wantFull) {
    return [
      hotel.brand ? `Brand: ${hotel.brand}` : null,
      firstSentence(hotel.advisor_take, 180),
      firstSentence(hotel.description, 180),
    ].filter((line): line is string => Boolean(line?.trim()));
  }
  const lines = [
    hotel.brand ? `Brand: ${hotel.brand}` : null,
    hotel.advisor_take ? `Advisor note: ${hotel.advisor_take}` : null,
    hotel.description,
    hotel.address_line_1,
    hotel.website_url,
    details?.amenities?.length ? `Amenities: ${details.amenities.join(", ")}` : null,
    details?.dining_notes,
    details?.wellness_notes,
    rooms.length > 0
      ? `Rooms: ${rooms.map((room) => room.name).join(", ")}`
      : null,
    ...facts.map((fact) =>
      fact.title ? `${fact.title}: ${fact.body}` : fact.body,
    ),
  ];
  return lines.filter((line): line is string => Boolean(line?.trim()));
}

/**
 * Answer a stay-stage question from Atlas only.
 * Prices stay in the rate layer. Missing facts are called out, not filled in.
 */
async function relatedFacts(question: string, placeNames: string[]): Promise<Awaited<ReturnType<typeof searchApprovedKbFacts>>> {
  const direct = question.length >= 4 ? await searchApprovedKbFacts({ q: question, limit: 5 }) : [];
  if (direct.length > 0) return direct;
  const blocked = new Set(placeNames.map((name) => name.toLowerCase()));
  const words = [
    ...new Set((question.toLowerCase().match(/[a-z]{5,}/g) ?? []).filter((word) => !FACT_STOP_WORDS.has(word) && !blocked.has(word))),
  ].slice(0, 4);
  const hits = [];
  for (const word of words) {
    hits.push(...(await searchApprovedKbFacts({ q: word, limit: 3 })));
  }
  const seen = new Set<string>();
  return hits.filter((fact) => {
    if (seen.has(fact.id)) return false;
    seen.add(fact.id);
    return true;
  });
}

export async function answerAtlasStay(input: {
  question: string;
  cityHint?: string | null;
  /** Recent user lines. A follow-up such as "what is the visa?" keeps the name they just gave. */
  earlier?: string | null;
  /** LLM-extracted travel destination (country or city) — never where they apply for a visa. */
  destination?: string | null;
  /** LLM-extracted place they apply from (e.g. India for VFS). Ignored for place match. */
  applyIn?: string | null;
  /** Trip stay start (YYYY-MM-DD) — optional Heads-up vs season windows. */
  travelFrom?: string | null;
  /** Trip stay end (YYYY-MM-DD). */
  travelTo?: string | null;
  /** Adults on the open trip (from travellers). */
  adults?: number | null;
  /** Children + infants on the open trip. */
  children?: number | null;
}): Promise<AtlasStayAnswer> {
  const question = input.question.trim();
  const hint = input.cityHint?.trim() || "";
  const travelFrom = input.travelFrom?.trim() || null;
  const travelTo = input.travelTo?.trim() || null;
  const wantFull = WANTS_FULL.test(question);
  const tripStyle = resolveTripStyle(question, input.adults, input.children);
  const countries = await listActiveKbCountries();
  const citiesByCountry = await Promise.all(
    countries.map(async (country) => ({
      country,
      cities: await listActiveKbCitiesForCountry(country.id),
    })),
  );
  const allCities = citiesByCountry.flatMap((row) => row.cities);

  const hintCity =
    allCities.find((row) => row.name.toLowerCase() === hint.toLowerCase()) ??
    allCities
      .filter((row) => includesName(hint, row.name) || includesName(row.name, hint))
      .sort((a, b) => b.name.length - a.name.length)[0] ??
    null;
  const hintCountry =
    countries.find((row) => row.name.toLowerCase() === hint.toLowerCase()) ??
    countries.find((row) => includesName(hint, row.name) || includesName(row.name, hint)) ??
    null;

  const earlier = input.earlier?.trim() ?? "";
  const destinationHint = input.destination?.trim() ?? "";
  // applyIn is accepted so callers can pass LLM parse results; matching never uses it.
  void input.applyIn;

  let namedCountry: KbCountry | null = null;
  let namedCity: KbCity | null = null;
  if (destinationHint) {
    namedCountry = resolveCountryByName(destinationHint, countries);
    namedCity = namedCountry ? null : resolveCityByName(destinationHint, allCities);
    if (namedCity) {
      namedCountry = countries.find((row) => row.id === namedCity!.country_id) ?? null;
    }
  }
  if (!namedCountry) namedCountry = matchCountry(question, countries);
  if (!namedCity) namedCity = matchCity(question, allCities);

  let namedHotel = await findNamedHotel(
    question,
    namedCity || hintCity ? await hotelsForCity(namedCity ?? hintCity!) : [],
  );
  if (!namedCountry && !namedCity && !namedHotel && earlier) {
    namedCountry = matchCountry(earlier, countries);
    namedCity = matchCity(earlier, allCities);
    namedHotel = await findNamedHotel(
      earlier,
      namedCity ? await hotelsForCity(namedCity) : [],
    );
  }

  const aboutPlace = asksAboutPlace(question);
  // "Tell me about this trip" does not say visa or season. The saved stay is still the place.
  const useSavedPlace =
    Boolean(hint) &&
    !namedCity &&
    !namedCountry &&
    !namedHotel &&
    !namesAnotherPlace(question, hint);
  let placeCity: KbCity | null =
    namedCity ?? (aboutPlace || namedHotel || useSavedPlace ? hintCity : null);
  if (!placeCity && namedHotel?.city_id) {
    placeCity = allCities.find((row) => row.id === namedHotel.city_id) ?? null;
  }
  const placeCountry: KbCountry | null =
    namedCountry ??
    (placeCity ? countries.find((row) => row.id === placeCity.country_id) ?? null : null) ??
    (namedHotel?.country_id
      ? countries.find((row) => row.id === namedHotel.country_id) ?? null
      : null) ??
    (aboutPlace || wantsHotelSearch(question) || useSavedPlace ? hintCountry : null);

  const setting = await getKnowledgeBaseSetting();
  const passport = setting.default_passport_country_code || "IN";
  const listHotels = wantsHotelSearch(question);
  const focus = placeFocus(question, listHotels);

  const factQuery =
    useSavedPlace && !aboutPlace
      ? [hint, placeCity?.name, placeCountry?.name].filter(Boolean).join(" ")
      : question;
  const factHits =
    wantFull && (aboutPlace || namedHotel || namedCountry || namedCity || useSavedPlace)
      ? await relatedFacts(factQuery, [
          placeCountry?.name ?? "",
          placeCity?.name ?? "",
          namedHotel?.name ?? "",
        ])
      : [];

  const matched = Boolean(placeCountry || placeCity || namedHotel || factHits.length > 0);
  const place = {
    city: placeCity?.name ?? null,
    country: placeCountry?.name ?? null,
  };
  if (!matched) {
    return {
      matched: false,
      answer: "",
      hotels: [],
      place,
    };
  }

  const blocks: string[] = [];

  if (placeCountry) {
    const bundle = await loadKbCountryPlaceBundle({
      country_code: placeCountry.country_code,
      passport_country_code: passport,
    });
    const facts = bundle?.facts;
    const visa = bundle?.visa ?? null;
    const seasonWindows =
      bundle?.seasonWindows ??
      (await listActiveKbCountrySeasonWindows(placeCountry.id));

    if (focus === "visa") {
      blocks.push(
        briefVisaAnswer(
          placeCountry.name,
          passport,
          visa,
          WANTS_FEE.test(question),
          WANTS_APPLY.test(question),
          wantFull,
          travelFrom,
        ),
      );
    } else if (focus === "itineraries") {
      blocks.push(
        await briefItinerariesAnswer(
          placeCountry.name,
          placeCountry.id,
          question,
          wantFull,
        ),
      );
    } else if (focus === "experiences") {
      const hint = placeCity?.name ?? placeCountry.name;
      blocks.push(
        await briefExperiencesAnswer(hint, hint, question, wantFull, {
          adults: input.adults,
          children: input.children,
        }),
      );
    } else if (focus === "visit_plan") {
      const wantsSeason = WANTS_SEASON.test(question);
      const hasWhereWord = WANTS_WHERE.test(question) || /\bwhere\b/i.test(question);
      const expanded = wantFull || WANTS_MORE_PLACES.test(question);
      // Where-only → skip When; when+where (incl. "…and where") → both.
      const includeWhen = wantsSeason || !hasWhereWord;
      const includeWhere = hasWhereWord || !wantsSeason;
      blocks.push(
        await briefVisitPlanAnswer(
          placeCountry,
          facts ?? null,
          bundle?.cities ?? [],
          seasonWindows,
          {
            includeWhen,
            includeWhere,
            expanded,
            preferSeasonTable: wantsSeason,
            travelFrom,
            travelTo,
            tripStyle,
          },
        ),
      );
    } else if (focus === "season") {
      blocks.push(
        briefSeasonAnswer(
          placeCountry.name,
          facts?.best_season ?? null,
          seasonWindows,
          travelFrom,
          travelTo,
          tripStyle,
        ),
      );
    } else if (focus === "length") {
      blocks.push(briefCountryLength(placeCountry.name, facts ?? null));
    } else if (focus === "money") {
      blocks.push(briefCountryMoney(placeCountry.name, facts ?? null));
    } else if (focus === "etiquette") {
      blocks.push(briefCountryEtiquette(placeCountry.name, facts ?? null));
    } else if (focus === "getting") {
      blocks.push(briefCountryGetting(placeCountry.name, facts ?? null, question));
    } else if (wantFull) {
      const visaLine = visa
        ? `Visa (${passport}): ${visa.summary}${
            visaLabel(visa.entry_type) ? ` (${visaLabel(visa.entry_type)})` : ""
          }`
        : `No visa rule on file for a ${passport} passport.`;
      const seasonBlock =
        seasonWindows.length > 0
          ? `Seasons:\n${seasonWindows
              .map((row) => formatSeasonWindowBullet(row, tripStyle))
              .join("\n")}`
          : facts?.best_season
            ? `Season: ${facts.best_season}`
            : null;
      const logistics = countryLogisticsBullets(facts ?? null, true)
        .map((line) => line.replace(/^-\s*/, ""))
        .join("\n");
      blocks.push(
        section(placeCountry.name, [
          seasonBlock,
          logistics || null,
          visaLine,
        ]) ?? "",
      );
    } else if (focus === "general" && !placeCity) {
      const bits = [
        facts?.best_season
          ? `Best time: ${firstSentence(facts.best_season, 160)}`
          : null,
        facts?.ideal_trip_length
          ? `Ideal length: ${firstSentence(facts.ideal_trip_length, 140)}`
          : null,
        visa
          ? `Visa (${passport}): ${firstSentence(visa.summary, 160)}${
              visaLabel(visa.entry_type) ? ` (${visaLabel(visa.entry_type)})` : ""
            }`
          : null,
        facts?.currency_code ? `Currency: ${facts.currency_code}` : null,
      ].filter(Boolean);
      blocks.push(
        bits.length > 0
          ? `**${placeCountry.name}**\n${bits.map((line) => `- ${line}`).join("\n")}`
          : `I matched ${placeCountry.name}, but I don't have place notes on file yet.`,
      );
    }
  }

  // Country visit_plan / itineraries / experiences already cover place — skip duplicate city block.
  // Money / etiquette / getting are country-level; length may still add city nights.
  if (
    placeCity &&
    focus !== "visa" &&
    focus !== "visit_plan" &&
    focus !== "itineraries" &&
    focus !== "experiences" &&
    focus !== "money" &&
    focus !== "etiquette" &&
    focus !== "getting"
  ) {
    const cityBundle = await loadKbCityPlaceBundle({
      city_id: placeCity.id,
      trip_style: tripStyle,
    });
    const cityLine = briefCityAnswer(
      placeCity.name,
      cityBundle?.facts ?? null,
      focus,
      wantFull,
      cityBundle?.audience_note ?? null,
      tripStyle,
    );
    if (cityLine) blocks.push(cityLine);
  }

  const cityHotels = placeCity ? await hotelsForCity(placeCity) : [];
  const listed = listHotels ? await hotelsToList(cityHotels, placeCity, placeCountry) : [];
  const choices: AtlasHotelChoice[] = listed.map((hotel) => ({
    id: hotel.id,
    name: hotel.name,
    brand: hotel.brand,
    city: hotel.cityName,
    propertyId: hotel.property_id,
    contractStatus: contractStatus(hotel.contract_status),
  }));

  if (listHotels && choices.length > 0) {
    blocks.push(
      section(
        "Hotels",
        choices.map(
          (hotel) =>
            `${hotel.name}${hotel.brand ? ` (${hotel.brand})` : ""} — ${CONTRACT_LABEL[hotel.contractStatus]}`,
        ),
      ) ?? "",
    );
  } else if (listHotels && (placeCity || placeCountry)) {
    const where = placeCity?.name ?? placeCountry?.name ?? "that place";
    blocks.push(`No hotels listed for ${where} yet.`);
  }

  if (namedHotel) {
    const lines = await describeHotel(namedHotel, wantFull);
    blocks.push(section(namedHotel.name, lines) ?? "");
  }

  const extraFacts = factHits.filter((fact) => fact.entity_id !== namedHotel?.id);
  if (wantFull && extraFacts.length > 0) {
    blocks.push(
      section(
        "Other notes",
        extraFacts.map((fact) => (fact.title ? `${fact.title}: ${fact.body}` : fact.body)),
      ) ?? "",
    );
  }

  if (
    !wantFull &&
    blocks.length > 0 &&
    focus !== "hotels" &&
    focus !== "visit_plan" &&
    focus !== "itineraries" &&
    focus !== "experiences"
  ) {
    blocks.push("Ask if you want the full notes.");
  }

  // City-only match (no country resolved) still answers experience-bank asks.
  if (focus === "experiences" && blocks.length === 0 && placeCity) {
    blocks.push(
      await briefExperiencesAnswer(
        placeCity.name,
        placeCity.name,
        question,
        wantFull,
      ),
    );
  }
  if (focus === "visit_plan" && blocks.length > 0) {
    const expandedVisit = wantFull || WANTS_MORE_PLACES.test(question);
    blocks.push(
      expandedVisit
        ? "Who is this for, and what dates or interests matter most? I can narrow the route once I know."
        : "Want more places beyond this spine, or who is this for and roughly when?",
    );
  }

  return {
    matched: true,
    answer: blocks.filter(Boolean).join("\n\n"),
    hotels: listHotels ? choices : [],
    place,
  };
}

async function hotelsToList(
  cityHotels: KbEntity[],
  city: KbCity | null,
  country: KbCountry | null,
): Promise<Array<KbEntity & { cityName: string }>> {
  if (city) {
    return cityHotels.slice(0, 8).map((hotel) => ({ ...hotel, cityName: city.name }));
  }
  if (!country) return [];
  const cities = await listActiveKbCitiesForCountry(country.id);
  const rows: Array<KbEntity & { cityName: string }> = [];
  for (const row of cities) {
    if (rows.length >= 8) break;
    const found = await hotelsForCity(row);
    for (const hotel of found) {
      if (rows.length >= 8) break;
      rows.push({ ...hotel, cityName: row.name });
    }
  }
  return rows;
}
