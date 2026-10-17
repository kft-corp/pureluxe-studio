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
  type KbEntity,
} from "@pureluxe/db";

import { wantsHotelSearch } from "./intents";

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
  contracted: "Contract in PureLuxe",
  not_yet_contracted: "No contract in PureLuxe yet",
  unknown: "Contract status not in PureLuxe",
};

const PLACE_QUESTION =
  /\b(hotels?|resorts?|villas?|visa|season|weather|currency|safety|safe|amenit\w*|rooms?|dining|spa|wellness|beach|island|atoll|recommend\w*|famil\w*|honeymoon|transfer|seaplane|green\s*tax|city|countr\w*|destination|place|rules?|polic\w*|check-?in|check-?out|best time|how long|kind of|where to stay|which hotel)\b/i;

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
]);

function includesName(message: string, name: string): boolean {
  const haystack = message.toLowerCase();
  const needle = name.trim().toLowerCase();
  return needle.length >= 3 && haystack.includes(needle);
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
  return (
    countries.find((row) => includesName(text, row.name)) ??
    countries.find((row) => {
      const code = row.country_code.trim().toUpperCase();
      return code.length >= 2 && new RegExp(`\\b${code}\\b`).test(text.toUpperCase());
    }) ??
    null
  );
}

function matchCity(text: string, cities: KbCity[]): KbCity | null {
  return (
    cities
      .filter((row) => includesName(text, row.name))
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
  if (entry === "embassy") return "embassy visa";
  return null;
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

async function describeHotel(hotel: KbEntity): Promise<string[]> {
  const [details, rooms, facts] = await Promise.all([
    findKbHotelDetails(hotel.id),
    listActiveKbHotelRoomCategories(hotel.id),
    listApprovedKbFactsForEntity(hotel.id),
  ]);
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
      ? `Rooms in PureLuxe: ${rooms.map((room) => room.name).join(", ")}`
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
}): Promise<AtlasStayAnswer> {
  const question = input.question.trim();
  const hint = input.cityHint?.trim() || "";
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
  let namedCountry = matchCountry(question, countries);
  let namedCity = matchCity(question, allCities);
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

  const factQuery =
    useSavedPlace && !aboutPlace
      ? [hint, placeCity?.name, placeCountry?.name].filter(Boolean).join(" ")
      : question;
  const factHits =
    aboutPlace || namedHotel || namedCountry || namedCity || useSavedPlace
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

  const listHotels = wantsHotelSearch(question);

  const blocks: string[] = [];
  if (placeCountry) {
    const bundle = await loadKbCountryPlaceBundle({
      country_code: placeCountry.country_code,
      passport_country_code: passport,
    });
    const facts = bundle?.facts;
    const visaLine = bundle?.visa
      ? `Visa for a ${passport} passport: ${bundle.visa.summary}${visaLabel(bundle.visa.entry_type) ? ` (${visaLabel(bundle.visa.entry_type)})` : ""}${bundle.visa.details ? `. ${bundle.visa.details}` : ""}`
      : `No visa rule in PureLuxe for a ${passport} passport.`;
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
  }

  if (placeCity) {
    const cityBundle = await loadKbCityPlaceBundle({ city_id: placeCity.id });
    blocks.push(
      section(placeCity.name, [
        cityBundle?.facts?.best_time_to_visit,
        cityBundle?.facts?.ideal_length_of_stay,
        cityBundle?.facts?.vibe,
        cityBundle?.facts?.staff_notes,
      ]) ?? "",
    );
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
        "Hotels in PureLuxe",
        choices.map(
          (hotel) =>
            `${hotel.name}${hotel.brand ? ` (${hotel.brand})` : ""} — ${CONTRACT_LABEL[hotel.contractStatus]}`,
        ),
      ) ?? "",
    );
  } else if (listHotels && (placeCity || placeCountry)) {
    const where = placeCity?.name ?? placeCountry?.name ?? "that place";
    blocks.push(`PureLuxe has no hotels for ${where}.`);
  }

  if (namedHotel) {
    const lines = await describeHotel(namedHotel);
    blocks.push(section(namedHotel.name, lines) ?? "");
  }

  const extraFacts = factHits.filter((fact) => fact.entity_id !== namedHotel?.id);
  if (extraFacts.length > 0) {
    blocks.push(
      section(
        "Other notes",
        extraFacts.map((fact) => (fact.title ? `${fact.title}: ${fact.body}` : fact.body)),
      ) ?? "",
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
