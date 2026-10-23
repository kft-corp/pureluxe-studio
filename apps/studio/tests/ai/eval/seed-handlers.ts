import type {
  ClientBrief,
  ClientSearchHit,
  DeskAgentHandlers,
  HomeAgentHandlers,
  HotelBrief,
  PlaceNotes,
  TripAgentHandlers,
  TripHistoryRow,
} from "@pureluxe/ai";
import { AppError } from "@pureluxe/shared";

import type { ScenarioSeed, SeedClient, SeedHotel, SeedTrip } from "../scenario-types";

import { toEvalTripFacts, type EvalTrip } from "./eval-trip";
import { createSeedTrip, createSeedTripChanges } from "./seed-trip-changes";

const SEARCH_LIMIT = 8;

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9@.]+/).filter((word) => word.length >= 2);
}

function surname(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

/** One id per household, the same for every member (the seed has no household rows). */
function householdId(client: SeedClient): string | null {
  const members = client.household ?? [];
  if (members.length === 0) return null;
  return [client.id, ...members.map((member) => member.clientId)].sort()[0]!;
}

function toSearchHit(client: SeedClient): ClientSearchHit {
  return {
    id: client.id,
    display_name: client.displayName,
    email: client.email,
    phone: null,
    tier: { slug: client.tier.toLowerCase(), label: client.tier },
    review_status: "approved",
    household_id: householdId(client),
  };
}

function toClientBrief(client: SeedClient, seed: ScenarioSeed): ClientBrief {
  const household = client.household ?? [];
  const members = household.flatMap((member) => {
    const person = seed.clients.find((row) => row.id === member.clientId);
    return person
      ? [{ display_name: person.displayName, role: member.relation, is_primary: Boolean(person.householdPrimary) }]
      : [];
  });
  const preferences = client.preferences ?? [];
  const primary = members.some((member) => member.is_primary) ? Boolean(client.householdPrimary) : true;
  return {
    id: client.id,
    display_name: client.displayName,
    email: client.email,
    phone: null,
    whatsapp: null,
    preferred_contact_method: "email",
    preferred_language: "English",
    nationality: null,
    city_of_residence: null,
    company: null,
    review_status: "approved",
    client_since: null,
    tier: { slug: client.tier.toLowerCase(), label: client.tier },
    relationship_owner: { id: seed.advisor.memberId, name: seed.advisor.name },
    counts: {
      preferences: preferences.length,
      preferences_prefer: preferences.filter((row) => row.sentiment === "prefer").length,
      preferences_avoid: preferences.filter((row) => row.sentiment === "avoid").length,
      preferences_require: preferences.filter((row) => row.sentiment === "require").length,
      documents: 0,
      documents_passport: 0,
      documents_visa: 0,
      documents_insurance: 0,
      documents_other: 0,
      family_members: members.length,
      relationships: members.length,
      bookings: 0,
      open_trips: 1,
    },
    family:
      members.length > 0
        ? {
            name: `${surname(client.displayName)} family`,
            role: primary ? "primary" : "member",
            is_primary: primary,
            members: [{ display_name: client.displayName, role: "self", is_primary: primary }, ...members],
          }
        : null,
    preferences: preferences.map((row) => ({ ...row, is_confirmed: true })),
    health: null,
    documents: [],
    guest_notes: null,
    last_booking_date: null,
    note: null,
  };
}

function hotelMatches(hotel: SeedHotel, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return [hotel.name, ...(hotel.aliases ?? [])].some((name) => {
    const candidate = name.toLowerCase();
    return candidate.includes(needle) || needle.includes(candidate);
  });
}

/** What the contract on file says, in the same plain style as Studio's hotel facts. */
function hotelFacts(hotel: SeedHotel): string {
  const charges = hotel.requiredCharges
    .map((charge) => `${charge.name} USD ${charge.amount} ${charge.unit.replaceAll("_", " ")}`)
    .join("; ");
  const rooms = hotel.rooms
    .map((room) => `${room.name} (up to ${room.maxAdults} adults; includes ${room.inclusions.join(", ")})`)
    .join("; ");
  return [
    `Contract valid ${hotel.validFrom} to ${hotel.validTo}.`,
    `Cancellation: ${hotel.cancellation}`,
    `Required charges: ${charges}.`,
    `Rooms on contract: ${rooms}.`,
    `Minimum markup: ${hotel.minMarkupPercent}%.`,
  ].join("\n");
}

/** A rule the advisor can see, like Studio's access and "not found" errors. */
function advisorError(userMessage: string, code: string): AppError {
  return new AppError({ userMessage, code, status: 400 });
}

function findClientBrief(seed: ScenarioSeed, clientId: string): ClientBrief {
  const client = seed.clients.find((row) => row.id === clientId);
  if (!client) throw advisorError("That client isn't in Studio.", "clients.not_found");
  return toClientBrief(client, seed);
}

const WORKING_STATUSES = new Set(["building", "quote_sent", "waiting_on_client", "booking"]);

/** Studio's trip board stages: working by status, the travel stages by dates. */
function inStage(trip: SeedTrip, stage: string | undefined, today: string): boolean {
  switch (stage ?? "any") {
    case "any":
      return true;
    case "working":
      return WORKING_STATUSES.has(trip.status);
    case "upcoming":
      return trip.startsOn > today;
    case "on_trip":
      return trip.startsOn <= today && trip.endsOn >= today;
    case "past":
      return trip.endsOn < today;
    default:
      return trip.status === stage;
  }
}

/** The seed's trip travellers: the lead and their household. */
function tripTravellers(trip: SeedTrip, seed: ScenarioSeed): SeedClient[] {
  const lead = seed.clients.find((row) => row.id === trip.leadClientId);
  const household = (lead?.household ?? []).flatMap((member) => seed.clients.filter((row) => row.id === member.clientId));
  return lead ? [lead, ...household] : [];
}

function toTripRow(trip: SeedTrip, seed: ScenarioSeed): TripHistoryRow {
  const travellers = tripTravellers(trip, seed);
  return {
    trip_id: trip.id,
    title: `${travellers[0]?.displayName ?? "Trip"} · ${trip.destination}`,
    status: trip.status,
    client: travellers[0]?.displayName ?? null,
    owner: trip.ownerName ?? seed.advisor.name,
    starts_on: trip.startsOn,
    ends_on: trip.endsOn,
    destinations: [trip.destination],
    traveller_count: travellers.length,
    sell_total: null,
    sell_currency: null,
    margin: null,
    pricing_locked: trip.status === "confirmed",
    quote_out_of_date: false,
  };
}

/** Lookups both chats share, read from the seed (no bookings on file). */
function createSeedDeskHandlers(seed: ScenarioSeed, today: string): Omit<DeskAgentHandlers, "getClient"> {
  return {
    async searchClients({ query, limit }) {
      const terms = words(query);
      const clients = seed.clients
        .filter((client) => {
          const haystack = `${client.displayName} ${client.email}`.toLowerCase();
          return terms.some((term) => haystack.includes(term));
        })
        .slice(0, limit ?? SEARCH_LIMIT);
      return { clients: clients.map(toSearchHit) };
    },

    async searchTrips({ clientId, query, stage, limit }) {
      const terms = query ? words(query) : [];
      const trips = (seed.trips ?? []).filter((trip) => {
        const travellers = tripTravellers(trip, seed);
        const haystack = `${travellers[0]?.displayName ?? ""} ${trip.destination}`.toLowerCase();
        return (
          (!clientId || travellers.some((person) => person.id === clientId)) &&
          (terms.length === 0 || terms.some((term) => haystack.includes(term))) &&
          inStage(trip, stage, today)
        );
      });
      return { trips: trips.slice(0, limit ?? 10).map((trip) => toTripRow(trip, seed)), total: trips.length };
    },

    async searchBookings() {
      return { bookings: [], total: 0 };
    },

    async getBooking() {
      throw advisorError("That booking isn't in Studio.", "bookings.not_found");
    },

    async getHotel({ name }) {
      const hotels: HotelBrief[] = seed.hotels
        .filter((hotel) => hotelMatches(hotel, name))
        .map((hotel) => ({
          name: hotel.name,
          city: null,
          country: hotel.destination,
          contracted: true,
          facts: hotelFacts(hotel),
        }));
      return { hotels };
    },

    async getPlaceNotes({ query, cityHint }): Promise<PlaceNotes> {
      const text = `${query} ${cityHint ?? ""}`.toLowerCase();
      const hotel = seed.hotels.find((row) => hotelMatches(row, query));
      const place =
        seed.places?.find((row) => text.includes(row.name.toLowerCase())) ??
        seed.places?.find((row) => row.name === hotel?.destination);
      if (!place) return { matched: false, notes: null, hotels: [] };
      return {
        matched: true,
        notes: place.notes,
        hotels: seed.hotels
          .filter((row) => row.destination === place.name)
          .map((row) => ({ name: row.name, city: row.destination, contracted: true })),
      };
    },
  };
}

/**
 * Trip chat handlers that read the scenario seed instead of the database.
 * Same contract as Studio's createTripAgentTools, so the agent can't tell the difference.
 */
export function createSeedHandlers(
  seed: ScenarioSeed,
  trip: EvalTrip,
  today: string,
): TripAgentHandlers {
  return {
    ...createSeedDeskHandlers(seed, today),

    async getTrip() {
      return toEvalTripFacts(trip, seed, today);
    },

    async getClient({ clientId }) {
      const id = clientId ?? trip.leadClientId;
      if (!id) {
        throw advisorError("No client on this trip yet. Pass client_id from client_search.", "ai.client_required");
      }
      return findClientBrief(seed, id);
    },

    async getRateSnapshot() {
      return { status: "none" };
    },

    ...createSeedTripChanges(seed, trip, today),
  };
}

/** Home chat handlers on the seed: creating a trip fills in the run's eval trip. */
export function createSeedHomeHandlers(
  seed: ScenarioSeed,
  trip: EvalTrip,
  today: string,
): HomeAgentHandlers {
  return {
    ...createSeedDeskHandlers(seed, today),

    async getClient({ clientId }) {
      if (!clientId) throw advisorError("No trip is open, so pass client_id from client_search.", "ai.client_id_required");
      return findClientBrief(seed, clientId);
    },

    createTrip: async (input) => createSeedTrip(seed, trip, today, input),

    async openTrip({ tripId }) {
      if (tripId !== trip.tripId) throw advisorError("That trip isn't in Studio.", "trips.not_found");
      return { ok: true, trip_id: trip.tripId, title: null };
    },
  };
}
