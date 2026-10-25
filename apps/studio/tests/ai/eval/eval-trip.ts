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
  /** Options on the quote (Stage 3d). */
  quoteOptions: Array<{
    hotel: string;
    room: string;
    markupPercent: number | null;
    clientPrice: number | null;
  }>;
  quoteStatus: "draft" | "sent";
  /** Rooms used on the last rates search (default 1). */
  rooms: number;
  /** Client's final room (Stage 4). */
  chosenOption: { hotel: string; room: string } | null;
  /** Pending / confirmed hotel booking from the choice (Stage 4). */
  booking: { hotel: string; status: "pending" | "confirmed" } | null;
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
    quoteOptions: [],
    quoteStatus: "draft",
    rooms: 1,
    chosenOption: null,
    booking: null,
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
  if (expected.chosenOption) {
    trip.chosenOption = { ...expected.chosenOption };
    trip.booking = expected.booking
      ? { ...expected.booking }
      : { hotel: expected.chosenOption.hotel, status: "pending" };
  }
  if (expected.booking && !expected.chosenOption) {
    trip.booking = { ...expected.booking };
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
    rate_selected: Boolean(
      trip.chosenOption &&
        stay.hotel &&
        stay.hotel.toLowerCase().includes(trip.chosenOption.hotel.toLowerCase()),
    ),
  }));

  /** Quote rooms the agent added — without these, the model thinks the quote is empty and retries. */
  const nights =
    trip.startsOn && trip.endsOn
      ? Math.max(
          1,
          Math.round(
            (Date.parse(`${trip.endsOn}T12:00:00Z`) - Date.parse(`${trip.startsOn}T12:00:00Z`)) /
              86_400_000,
          ),
        )
      : 5;
  const roomCount = Math.max(1, trip.rooms);
  const candidates = trip.quoteOptions.map((option) => {
    const hotel = seed.hotels.find(
      (row) =>
        row.name.toLowerCase().includes(option.hotel.toLowerCase()) ||
        option.hotel.toLowerCase().includes(row.name.toLowerCase()) ||
        row.aliases?.some((alias) => alias.toLowerCase().includes(option.hotel.toLowerCase())),
    );
    const room = hotel?.rooms.find(
      (row) =>
        row.name.toLowerCase().includes(option.room.toLowerCase()) ||
        option.room.toLowerCase().includes(row.name.toLowerCase()),
    );
    const cost =
      room != null ? Math.round(room.nightlyCost * nights * roomCount * 100) / 100 : null;
    const sellAmount =
      option.clientPrice ??
      (cost != null && option.markupPercent != null
        ? Math.round(cost * (1 + option.markupPercent / 100) * 100) / 100
        : null);
    const selected = Boolean(
      trip.chosenOption &&
        option.hotel.toLowerCase().includes(trip.chosenOption.hotel.toLowerCase()) &&
        option.room.toLowerCase().includes(trip.chosenOption.room.toLowerCase()),
    );
    return {
      title: `${option.hotel} · ${option.room}`,
      subtitle:
        option.markupPercent != null
          ? `${option.markupPercent}% markup`
          : option.clientPrice != null
            ? `client ${option.clientPrice} USD`
            : null,
      cost_internal: cost,
      currency: "USD",
      rate_source_code: "offline_contracted",
      selected,
      sell_amount: sellAmount,
      inclusions: room?.inclusions ?? [],
      cancellation_policy: hotel?.cancellation ?? null,
      payment_policy: null,
    };
  });

  const selected =
    candidates.find((row) => row.selected) ??
    (trip.chosenOption
      ? {
          title: `${trip.chosenOption.hotel} · ${trip.chosenOption.room}`,
          subtitle: null,
          cost_internal: null,
          currency: "USD",
          rate_source_code: "offline_contracted",
          selected: true,
          sell_amount: null,
          inclusions: [],
          cancellation_policy: null,
          payment_policy: null,
        }
      : null);

  return {
    trip_id: trip.tripId,
    title: lead ? `${lead.displayName} · ${trip.stays[0]?.destination ?? "New trip"}` : null,
    status:
      trip.booking?.status === "confirmed"
        ? "confirmed"
        : trip.chosenOption || trip.booking
          ? "booking"
          : trip.quoteStatus === "sent"
            ? "quote_sent"
            : "building",
    pricing_locked: Boolean(trip.chosenOption || trip.booking),
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
    rates: { selected, candidates },
    quote: {
      title: null,
      notes: null,
      sell_total: null,
      sell_currency: "USD",
      document_status: trip.quoteOptions.length > 0 ? "ready" : null,
      has_file: trip.quoteOptions.length > 0,
      line_edit_count: 0,
    },
    readiness: [],
  };
}
