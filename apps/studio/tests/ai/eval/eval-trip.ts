import type { TripFacts } from "@pureluxe/ai";

import type { ScenarioSeed, SeedClient, TripExpectation } from "../scenario-types";

/** The trip an eval runs on. Held in memory; the agent's write tools change it. */
export type EvalTrip = {
  tripId: string;
  leadClientId: string | null;
  travellerIds: string[];
  startsOn: string | null;
  endsOn: string | null;
  stays: Array<{ destination: string; checkIn: string; checkOut: string; hotel: string | null }>;
  /** Values the agent assumed, e.g. "year". */
  assumed: string[];
};

export function newEvalTrip(tripId: string): EvalTrip {
  return {
    tripId,
    leadClientId: null,
    travellerIds: [],
    startsOn: null,
    endsOn: null,
    stays: [],
    assumed: [],
  };
}

function clientByName(seed: ScenarioSeed, name: string): SeedClient {
  const client = seed.clients.find((row) => row.displayName === name);
  if (!client) throw new Error(`Seed has no client named ${name}.`);
  return client;
}

/**
 * Apply what a step from a later build stage would have done, so the steps
 * after it run on the right trip. Called for every skipped step.
 */
export function fastForwardTrip(
  trip: EvalTrip,
  expected: TripExpectation | undefined,
  seed: ScenarioSeed,
): void {
  if (!expected) return;
  if (expected.client) {
    trip.leadClientId = clientByName(seed, expected.client.lead).id;
    trip.travellerIds = expected.client.travellers.map((name) => clientByName(seed, name).id);
  }
  if (expected.dates) {
    trip.startsOn = expected.dates.start;
    trip.endsOn = expected.dates.end;
    trip.assumed = [...(expected.dates.assumed ?? [])];
  }
  if (expected.stays) {
    trip.stays = expected.stays.map((stay) => ({ ...stay, hotel: null }));
  }
}

function ageOn(dateOfBirth: string, onDate: string): number {
  const born = new Date(`${dateOfBirth}T00:00:00Z`);
  const on = new Date(`${onDate}T00:00:00Z`);
  let age = on.getUTCFullYear() - born.getUTCFullYear();
  if (
    on.getUTCMonth() < born.getUTCMonth() ||
    (on.getUTCMonth() === born.getUTCMonth() && on.getUTCDate() < born.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

/** The trip as the agent sees it (same shape Studio builds from the database). */
export function toEvalTripFacts(trip: EvalTrip, seed: ScenarioSeed, today: string): TripFacts {
  const byId = new Map(seed.clients.map((client) => [client.id, client]));
  const lead = trip.leadClientId ? byId.get(trip.leadClientId) ?? null : null;
  const onDate = trip.startsOn ?? today;
  const household = (lead?.household ?? []).filter(
    (member) => !trip.travellerIds.includes(member.clientId),
  );
  const stays = trip.stays.map((stay) => ({
    city: stay.destination,
    check_in: stay.checkIn,
    check_out: stay.checkOut,
    property_name: stay.hotel,
    rate_selected: false,
  }));

  return {
    trip_id: trip.tripId,
    title: lead ? `${lead.displayName} · ${trip.stays[0]?.destination ?? "New trip"}` : null,
    status: "building",
    pricing_locked: false,
    assumptions: trip.assumed,
    client: lead ? { id: lead.id, display_name: lead.displayName } : null,
    travellers_confirmed: trip.travellerIds.length > 0,
    travellers: trip.travellerIds.flatMap((id) => {
      const person = byId.get(id);
      if (!person) return [];
      return [
        {
          client_id: id,
          display_name: person.displayName,
          role: id === trip.leadClientId ? "primary" : "companion",
          party_role: ageOn(person.dateOfBirth, onDate) >= 18 ? "adult" : "child",
        },
      ];
    }),
    family_suggestions: household.flatMap((member) => {
      const person = byId.get(member.clientId);
      return person
        ? [
            {
              client_id: member.clientId,
              display_name: person.displayName,
              party_role: ageOn(person.dateOfBirth, onDate) >= 18 ? "adult" : "child",
              family_role: member.relation,
            },
          ]
        : [];
    }),
    starts_on: trip.startsOn,
    ends_on: trip.endsOn,
    legs_confirmed: trip.stays.length > 0,
    stay: stays[0] ? { ...stays[0] } : null,
    stays,
    rates: { selected: null, candidates: [] },
    quote: {
      title: null,
      intro: null,
      notes: null,
      highlights: [],
      sell_total: null,
      sell_currency: null,
      document_status: null,
      has_file: false,
    },
    readiness: [],
  };
}
