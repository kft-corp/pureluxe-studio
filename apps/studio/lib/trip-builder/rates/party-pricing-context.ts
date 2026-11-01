import {
  findClientById,
  listClientDocuments,
  listTripTravellers,
} from "@pureluxe/db";

import {
  bestPassportDob,
  isMinorPartyRole,
  resolveChildAge,
} from "../party/resolve-child-age";

export type PartyPricingContext = {
  child_ages: number[];
  client_market_codes: string[];
};

/**
 * Child ages (on check-in) and lead nationality for Stage 3b pricing.
 * Missing ages are omitted so the rates layer can assume a default age.
 * Pass childAges to prefer stated ages over stored DOBs.
 */
export async function loadPartyPricingContext(input: {
  tripId: string;
  checkIn: string;
  /** Stated child ages from the advisor; wins over stored ages when provided. */
  childAges?: number[];
}): Promise<PartyPricingContext> {
  const travellers = await listTripTravellers(input.tripId);
  const lead = travellers.find((row) => row.role === "primary") ?? travellers[0];
  const children = travellers.filter((row) => isMinorPartyRole(row.party_role));

  const [leadClient, childDocs] = await Promise.all([
    lead ? findClientById(lead.client_id) : Promise.resolve(null),
    input.childAges != null && input.childAges.length > 0
      ? Promise.resolve([] as Awaited<ReturnType<typeof listClientDocuments>>[])
      : Promise.all(children.map((child) => listClientDocuments(child.client_id))),
  ]);

  let child_ages: number[] = [];
  if (input.childAges != null && input.childAges.length > 0) {
    child_ages = input.childAges.filter((age) => Number.isFinite(age) && age >= 0);
  } else {
    children.forEach((child, index) => {
      const age = resolveChildAge({
        statedAge: child.stated_age,
        clientDob: child.date_of_birth,
        passportDob: bestPassportDob(childDocs[index] ?? []),
        onDate: input.checkIn,
      });
      if (typeof age === "number") child_ages.push(age);
    });
  }

  const nationality = leadClient?.nationality?.trim().toUpperCase() ?? "";
  const client_market_codes =
    nationality.length === 2 ? [nationality] : [];

  return { child_ages, client_market_codes };
}
