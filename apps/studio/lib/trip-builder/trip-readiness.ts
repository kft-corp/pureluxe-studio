import {
  findActiveKbCountryByCode,
  findActiveKbVisaRule,
  findActivePropertyById,
  type ClientDocument,
  type ClientHealthProfile,
  type ClientPreference,
  type KbCountry,
} from "@pureluxe/db";
import { countryCodeFrom } from "@pureluxe/shared";

import type { TripDetail, TripStaySnapshot } from "./trip-detail";

/** One traveller's profile rows, already loaded for the trip dossier. */
export type ReadinessPerson = {
  name: string;
  child: boolean;
  nationality: string | null;
  documents: ClientDocument[];
  preferences: ClientPreference[];
  health: ClientHealthProfile | null;
};

/** Many countries refuse entry when the passport expires within this many months of leaving. */
const PASSPORT_MONTHS_AFTER_TRIP = 6;

const VISA_LABEL: Record<string, string> = {
  e_visa: "an e-visa",
  visa_on_arrival: "a visa on arrival",
  embassy: "an embassy visa",
};

function addMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1 + months, day!)).toISOString().slice(0, 10);
}

function ageOn(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  const hadBirthday = m! > bm! || (m === bm && d! >= bd!);
  return y! - by! - (hadBirthday ? 0 : 1);
}

function stayDates(detail: TripDetail, stays: TripStaySnapshot[]) {
  const ins = stays.map((stay) => stay.check_in).filter((day): day is string => Boolean(day)).sort();
  const outs = stays.map((stay) => stay.check_out).filter((day): day is string => Boolean(day)).sort();
  return {
    start: detail.trip.starts_on ?? ins[0] ?? null,
    end: detail.trip.ends_on ?? outs[outs.length - 1] ?? null,
  };
}

/** Verified first, then the one that expires last. Rejected passports do not count. */
function bestPassport(documents: ClientDocument[]): ClientDocument | null {
  const passports = documents
    .filter((row) => row.document_type === "passport" && row.status !== "rejected")
    .sort((a, b) => {
      if ((a.status === "verified") !== (b.status === "verified")) {
        return a.status === "verified" ? -1 : 1;
      }
      return (b.expiry_date ?? "").localeCompare(a.expiry_date ?? "");
    });
  return passports[0] ?? null;
}

function sameCountry(value: string | null, country: KbCountry): boolean {
  return countryCodeFrom(value) === country.country_code.toUpperCase();
}

function passportLines(person: ReadinessPerson, start: string | null, end: string | null): string[] {
  const passport = bestPassport(person.documents);
  if (!passport) return [`No passport on file for ${person.name}.`];
  const expiry = passport.expiry_date;
  if (!expiry) return [`${person.name}'s passport has no expiry date on file.`];
  if (passport.status === "expired" || (start && expiry < start)) {
    return [`${person.name}'s passport expired on ${expiry}.`];
  }
  if (end && expiry < addMonths(end, PASSPORT_MONTHS_AFTER_TRIP)) {
    return [
      `${person.name}'s passport expires on ${expiry}, less than ${PASSPORT_MONTHS_AFTER_TRIP} months after the trip ends (${end}).`,
    ];
  }
  return [];
}

function visaDocumentLines(person: ReadinessPerson, end: string | null): string[] {
  if (!end) return [];
  return person.documents
    .filter((row) => row.document_type === "visa" && row.expiry_date && row.expiry_date < end)
    .map(
      (row) =>
        `${person.name}'s visa${row.issuing_country ? ` for ${row.issuing_country}` : ""} expires on ${row.expiry_date}, before the trip ends.`,
    );
}

function childLines(person: ReadinessPerson, start: string | null): string[] {
  if (!person.child) return [];
  const birthDate = bestPassport(person.documents)?.date_of_birth ?? null;
  if (!birthDate) {
    return [`${person.name} is travelling as a child with no date of birth on file. Hotel child rates depend on age.`];
  }
  if (!start) return [];
  return [`${person.name} will be ${ageOn(birthDate, start)} on arrival. Check the hotel's child age bands.`];
}

function profileLines(person: ReadinessPerson): string[] {
  const lines: string[] = [];
  for (const row of person.preferences) {
    if (row.sentiment === "require") {
      lines.push(`${person.name} requires ${row.label}. Tell the hotel.`);
    } else if (row.sentiment === "avoid") {
      lines.push(`${person.name} avoids ${row.label}. Check the hotel and room choice.`);
    }
  }
  const health = person.health;
  const diet = health?.dietary_restrictions?.filter((item) => item.trim()) ?? [];
  const share = health?.share_with_hotels ? "Tell the hotel." : "Not cleared to share with hotels.";
  if (diet.length > 0) lines.push(`${person.name} diet: ${diet.join(", ")}. ${share}`);
  if (health?.mobility_notes?.trim()) {
    lines.push(`${person.name} mobility: ${health.mobility_notes.trim()}. ${share}`);
  }
  return lines;
}

/** Countries of the hotels on the trip, from each hotel's ISO code. */
async function stayCountries(stays: TripStaySnapshot[]): Promise<KbCountry[]> {
  const propertyIds = [...new Set(stays.map((stay) => stay.property_id).filter((id): id is string => Boolean(id)))];
  const properties = await Promise.all(propertyIds.map((id) => findActivePropertyById(id)));
  const codes = [
    ...new Set(
      properties.map((row) => countryCodeFrom(row?.country)).filter((code): code is string => Boolean(code)),
    ),
  ];
  const countries = await Promise.all(codes.map((code) => findActiveKbCountryByCode(code)));
  return countries.filter((row): row is KbCountry => Boolean(row));
}

/** A visa rule on file that is not visa-free, with no visa document for that country. */
async function visaRuleLines(countries: KbCountry[], people: ReadinessPerson[]): Promise<string[]> {
  const checks = countries.flatMap((country) =>
    people.map(async (person) => {
      const passportCode =
        countryCodeFrom(bestPassport(person.documents)?.issuing_country) ??
        countryCodeFrom(person.nationality);
      if (!passportCode || sameCountry(passportCode, country)) return null;
      const hasVisa = person.documents.some(
        (row) => row.document_type === "visa" && row.status !== "rejected" && sameCountry(row.issuing_country, country),
      );
      if (hasVisa) return null;
      const rule = await findActiveKbVisaRule(country.id, passportCode);
      if (!rule?.entry_type || rule.entry_type === "visa_free") return null;
      return `${person.name} (${passportCode} passport) needs ${VISA_LABEL[rule.entry_type]} for ${country.name}: ${rule.summary}`;
    }),
  );
  return (await Promise.all(checks)).filter((line): line is string => Boolean(line));
}

/**
 * Things to sort out before booking: passport validity, visas, child ages,
 * and preferences or health notes the hotel should know. Nothing is invented;
 * a missing rule means no line.
 */
export async function buildTripReadiness(
  detail: TripDetail,
  stays: TripStaySnapshot[],
  people: ReadinessPerson[],
): Promise<string[]> {
  if (people.length === 0) return [];
  const { start, end } = stayDates(detail, stays);
  const visaLines = await visaRuleLines(await stayCountries(stays), people);
  return [
    ...people.flatMap((person) => [
      ...passportLines(person, start, end),
      ...visaDocumentLines(person, end),
      ...childLines(person, start),
    ]),
    ...visaLines,
    ...people.flatMap(profileLines),
  ];
}
