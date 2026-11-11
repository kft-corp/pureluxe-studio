import {
  findKbHotelDetails,
  getKnowledgeBaseSetting,
  listActiveKbCitiesForCountry,
  listActiveKbCountries,
  listActiveKbEntities,
  listActiveKbHotelRoomCategories,
  listApprovedKbFactsForEntity,
  loadKbCountryPlaceBundle,
  loadKbCityPlaceBundle,
  searchApprovedKbFacts,
  type KbCity,
  type KbCountry,
  type KbCountryVisaRule,
  type KbDestinationFacts,
  type KbEntity,
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
  /\b(hotels?|resorts?|villas?|visa|season|weather|currency|safety|safe|amenit\w*|rooms?|dining|spa|wellness|beach|island|atoll|recommend\w*|famil\w*|honeymoon|transfer|seaplane|green\s*tax|city|countr\w*|destination|place|rules?|polic\w*|check-?in|check-?out|best time|how long|kind of|where to stay|which hotel|fee|fees|entry)\b/i;

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

const WANTS_LENGTH =
  /\b(how long|nights?|length of stay|ideal stay|how many nights)\b/i;

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

function extractVisaFee(details: string | null | undefined): string | null {
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

function extractProcessing(details: string | null | undefined): string | null {
  if (!details) return null;
  const hit = details.match(/Processing:\s*([^\n.]+)/i);
  return hit?.[1]?.trim() || null;
}

function extractWhereToApply(details: string | null | undefined): string | null {
  if (!details) return null;
  const patterns = [
    /Where to apply:\s*([^\n]+)/i,
    /Application(?:\s+cent(?:re|er))?:\s*([^\n]+)/i,
    /VFS[^\n]*/i,
  ];
  for (const pattern of patterns) {
    const hit = details.match(pattern);
    if (hit?.[1]?.trim()) return hit[1].trim();
    if (hit?.[0] && /^VFS/i.test(hit[0])) return hit[0].trim();
  }
  return null;
}

type PlaceFocus = "visa" | "season" | "length" | "city" | "hotels" | "general";

function placeFocus(question: string, listHotels: boolean): PlaceFocus {
  if (listHotels) return "hotels";
  if (WANTS_VISA.test(question) || WANTS_FEE.test(question) || WANTS_APPLY.test(question)) {
    return "visa";
  }
  if (WANTS_SEASON.test(question)) return "season";
  if (WANTS_LENGTH.test(question)) return "length";
  if (/\b(vibe|like|neighbourhood|neighborhood|area)\b/i.test(question)) return "city";
  return "general";
}

function briefVisaAnswer(
  countryName: string,
  passport: string,
  visa: KbCountryVisaRule | null,
  wantFee: boolean,
  wantApply: boolean,
  wantFull: boolean,
): string {
  if (!visa) {
    return `I don't have ${countryName} visa information for a ${passport} passport on file yet.`;
  }
  const kind = visaLabel(visa.entry_type);
  const fee = extractVisaFee(visa.details);
  const processing = extractProcessing(visa.details);
  const whereToApply = extractWhereToApply(visa.details);

  if (wantApply && !wantFull) {
    if (whereToApply) {
      return `For a ${countryName} visa (${passport} passport), apply at: **${whereToApply}**.${
        processing ? ` Processing is typically ${processing}.` : ""
      }`;
    }
    return `${firstSentence(visa.summary) ?? visa.summary}${
      kind ? ` (${kind})` : ""
    }. I don't have a separate "where to apply" line on file — ask if you want the full visa notes.`;
  }

  if (wantFee && !wantFull) {
    if (fee) {
      return `${countryName} visa fee for a ${passport} passport: **${fee}**.${
        processing ? ` Processing is typically ${processing}.` : ""
      }${kind ? ` (${kind})` : ""}`;
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
    ].filter(Boolean);
    return bits.join(" ");
  }

  return [
    `**${countryName} visa (${passport} passport)**`,
    `- ${visa.summary}${kind ? ` (${kind})` : ""}`,
    fee ? `- Fee: ${fee}` : null,
    processing ? `- Processing: ${processing}` : null,
    whereToApply ? `- Where to apply: ${whereToApply}` : null,
    visa.details ? `- Details: ${visa.details}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function briefSeasonAnswer(countryName: string, season: string | null): string {
  if (!season) {
    return `I don't have a best-time-to-visit note for ${countryName} on file yet.`;
  }
  return `**Best time for ${countryName}:** ${firstSentence(season, 280) ?? season}`;
}

function briefCityAnswer(
  cityName: string,
  facts: KbDestinationFacts | null,
  focus: PlaceFocus,
  wantFull: boolean,
): string | null {
  if (!facts) return null;
  if (wantFull) {
    return (
      section(cityName, [
        facts.best_time_to_visit,
        facts.ideal_length_of_stay,
        facts.vibe,
        facts.staff_notes,
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
  const vibe = firstSentence(facts.vibe, 180);
  const nights = firstSentence(facts.ideal_length_of_stay, 100);
  if (!vibe && !nights) return null;
  return [`**${cityName}**`, vibe, nights ? `Typical stay: ${nights}` : null]
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
}): Promise<AtlasStayAnswer> {
  const question = input.question.trim();
  const hint = input.cityHint?.trim() || "";
  const wantFull = WANTS_FULL.test(question);
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

    if (focus === "visa") {
      blocks.push(
        briefVisaAnswer(
          placeCountry.name,
          passport,
          visa,
          WANTS_FEE.test(question),
          WANTS_APPLY.test(question),
          wantFull,
        ),
      );
    } else if (focus === "season") {
      blocks.push(briefSeasonAnswer(placeCountry.name, facts?.best_season ?? null));
    } else if (wantFull) {
      const visaLine = visa
        ? `Visa (${passport}): ${visa.summary}${
            visaLabel(visa.entry_type) ? ` (${visaLabel(visa.entry_type)})` : ""
          }`
        : `No visa rule on file for a ${passport} passport.`;
      blocks.push(
        section(placeCountry.name, [
          facts?.currency_code ? `Currency: ${facts.currency_code}` : null,
          facts?.currency_notes,
          facts?.best_season ? `Season: ${facts.best_season}` : null,
          facts?.safety_notes,
          facts?.general_notes,
          visaLine,
        ]) ?? "",
      );
    } else if (focus === "general" && !placeCity) {
      const bits = [
        facts?.best_season
          ? `Best time: ${firstSentence(facts.best_season, 160)}`
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

  if (placeCity && focus !== "visa") {
    const cityBundle = await loadKbCityPlaceBundle({ city_id: placeCity.id });
    const cityLine = briefCityAnswer(
      placeCity.name,
      cityBundle?.facts ?? null,
      focus,
      wantFull,
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

  if (!wantFull && blocks.length > 0 && focus !== "hotels") {
    blocks.push("Ask if you want the full notes.");
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
