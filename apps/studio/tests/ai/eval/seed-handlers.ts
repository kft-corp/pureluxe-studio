import type {
  ClientBrief,
  ClientSearchHit,
  HotelBrief,
  PlaceNotes,
  TripAgentHandlers,
} from "@pureluxe/ai";
import { AppError } from "@pureluxe/shared";

import type { ScenarioSeed, SeedClient, SeedHotel } from "../scenario-types";

import { toEvalTripFacts, type EvalTrip } from "./eval-trip";

const SEARCH_LIMIT = 8;

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9@.]+/).filter((word) => word.length >= 2);
}

function surname(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function toSearchHit(client: SeedClient): ClientSearchHit {
  return {
    id: client.id,
    display_name: client.displayName,
    email: client.email,
    phone: null,
    tier: { slug: client.tier.toLowerCase(), label: client.tier },
    review_status: "approved",
    has_family: (client.household?.length ?? 0) > 0,
  };
}

function toClientBrief(client: SeedClient, seed: ScenarioSeed): ClientBrief {
  const household = client.household ?? [];
  const members = household.flatMap((member) => {
    const person = seed.clients.find((row) => row.id === member.clientId);
    return person ? [{ display_name: person.displayName, role: member.relation, is_primary: false }] : [];
  });
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
      preferences: 0,
      preferences_prefer: 0,
      preferences_avoid: 0,
      preferences_require: 0,
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
            role: "primary",
            is_primary: true,
            members: [{ display_name: client.displayName, role: "self", is_primary: true }, ...members],
          }
        : null,
    preferences: [],
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

/**
 * Tool handlers that read the scenario seed instead of the database.
 * Same contract as Studio's createTripAgentTools, so the agent can't tell the difference.
 */
export function createSeedHandlers(
  seed: ScenarioSeed,
  trip: EvalTrip,
  today: string,
): TripAgentHandlers {
  return {
    async getTrip() {
      return toEvalTripFacts(trip, seed, today);
    },

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

    async getClient({ clientId }) {
      const id = clientId ?? trip.leadClientId;
      if (!id) {
        throw advisorError("No client on this trip yet. Pass client_id from client_search.", "ai.client_required");
      }
      const client = seed.clients.find((row) => row.id === id);
      if (!client) throw advisorError("That client isn't in Studio.", "clients.not_found");
      return toClientBrief(client, seed);
    },

    async searchTrips() {
      return { trips: [], total: 0 };
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

    async getRateSnapshot() {
      return { status: "none" };
    },
  };
}
