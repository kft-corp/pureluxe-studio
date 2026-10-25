import {
  findClientById,
  listClientDocuments,
  listTripTravellers,
  type ClientDocument,
} from "@pureluxe/db";

function ageOn(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  const hadBirthday = m! > bm! || (m === bm && d! >= bd!);
  return y! - by! - (hadBirthday ? 0 : 1);
}

function bestPassportDob(documents: ClientDocument[]): string | null {
  const passports = documents
    .filter((row) => row.document_type === "passport" && row.status !== "rejected")
    .sort((a, b) => {
      if ((a.status === "verified") !== (b.status === "verified")) {
        return a.status === "verified" ? -1 : 1;
      }
      return (b.expiry_date ?? "").localeCompare(a.expiry_date ?? "");
    });
  return passports.find((row) => row.date_of_birth)?.date_of_birth ?? null;
}

export type PartyPricingContext = {
  child_ages: number[];
  client_market_codes: string[];
};

/**
 * Child ages (on check-in) and lead nationality for Stage 3b pricing.
 * Missing DOBs are omitted so the rates layer can assume a default age.
 */
export async function loadPartyPricingContext(input: {
  tripId: string;
  checkIn: string;
}): Promise<PartyPricingContext> {
  const travellers = await listTripTravellers(input.tripId);
  const lead = travellers.find((row) => row.role === "primary") ?? travellers[0];
  const children = travellers.filter((row) => row.party_role === "child");

  const [leadClient, childDocs] = await Promise.all([
    lead ? findClientById(lead.client_id) : Promise.resolve(null),
    Promise.all(children.map((child) => listClientDocuments(child.client_id))),
  ]);

  const child_ages: number[] = [];
  for (const docs of childDocs) {
    const dob = bestPassportDob(docs);
    if (!dob) continue;
    const age = ageOn(dob, input.checkIn);
    if (Number.isFinite(age) && age >= 0) child_ages.push(age);
  }

  const nationality = leadClient?.nationality?.trim().toUpperCase() ?? "";
  const client_market_codes =
    nationality.length === 2 ? [nationality] : [];

  return { child_ages, client_market_codes };
}
