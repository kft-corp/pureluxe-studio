import type {
  ClientBrief,
  ClientListRow,
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
    review_status: client.reviewStatus ?? "approved",
    household_id: householdId(client),
  };
}

function addedOn(client: SeedClient): string {
  return client.addedOn ?? "2025-01-01";
}

function toListRow(client: SeedClient): ClientListRow {
  return {
    id: client.id,
    display_name: client.displayName,
    tier: { slug: client.tier.toLowerCase(), label: client.tier },
    review_status: client.reviewStatus ?? "approved",
    added_on: addedOn(client),
    client_since: null,
    household: client.household?.length ? `${surname(client.displayName)} family` : null,
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
    `Commission rate: ${hotel.minMarkupPercent}%.`,
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

    /** Every seeded client belongs to the seed advisor, so "unassigned" finds none. */
    async listClients({ tier, reviewStatus, addedFrom, addedTo, owner, missingContact, inHousehold, sort, limit }) {
      const matches = seed.clients
        .filter(
          (client) =>
            owner !== "unassigned" &&
            !missingContact &&
            (!tier || client.tier.toLowerCase() === tier) &&
            (!reviewStatus || (client.reviewStatus ?? "approved") === reviewStatus) &&
            (!addedFrom || addedOn(client) >= addedFrom) &&
            (!addedTo || addedOn(client) <= addedTo) &&
            (!inHousehold || (client.household?.length ?? 0) > 0),
        )
        .sort((left, right) =>
          sort === "name"
            ? left.displayName.localeCompare(right.displayName)
            : addedOn(right).localeCompare(addedOn(left)),
        );
      return { clients: matches.slice(0, limit ?? SEARCH_LIMIT).map(toListRow), total: matches.length };
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

    async findHotels({ name, destination, tier, similarTo, priceBandLike, limit }) {
      const max = Math.min(Math.max(limit ?? 5, 1), 10);
      const place = destination?.trim().toLowerCase() || null;
      const refName = similarTo || priceBandLike || name;
      const reference = refName
        ? seed.hotels.find((hotel) => hotelMatches(hotel, refName))
        : undefined;
      const targetTier = tier ?? reference?.tier;
      const dest =
        place ||
        reference?.destination.toLowerCase() ||
        null;

      let hotels = seed.hotels.filter((hotel) => {
        if (dest && hotel.destination.toLowerCase() !== dest) return false;
        if (targetTier && hotel.tier && hotel.tier !== targetTier) return false;
        if (name && !similarTo && !priceBandLike && !tier) {
          return hotelMatches(hotel, name);
        }
        return true;
      });

      if (reference && (similarTo || priceBandLike || tier)) {
        hotels = [
          reference,
          ...hotels.filter((hotel) => hotel.propertyId !== reference.propertyId),
        ];
      }

      if (name && !similarTo && !priceBandLike && !tier && hotels.length === 0) {
        const close = seed.hotels
          .filter((hotel) => !dest || hotel.destination.toLowerCase() === dest)
          .slice(0, 3)
          .map((hotel) => hotel.name);
        return {
          hotels: [],
          did_you_mean: close,
          note: close.length > 0 ? "Did you mean one of these?" : `No PureLuxe hotel matched "${name}".`,
        };
      }

      return {
        hotels: hotels.slice(0, max).map((hotel) => ({
          name: hotel.name,
          destination: hotel.destination,
          city: null,
          country: hotel.destination,
          tier: hotel.tier ?? null,
          style_tags: hotel.styleTags,
          score: 1,
          contracted: true as const,
        })),
        did_you_mean: [],
        note: hotels.length === 0 ? `No PureLuxe hotels found${dest ? ` in ${dest}` : ""}.` : null,
      };
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
      return { status: "none" as const };
    },

    async searchRates(input) {
      const hotels = input.hotels.slice(0, 5).map((name, hotelIndex) => {
        const hit = seed.hotels.find((row) => hotelMatches(row, name));
        const markupPercent = hit?.minMarkupPercent ?? 25;
        const rooms = (hit?.rooms ?? []).map((room, index) => {
          const teamCost = room.nightlyCost * 5 * input.rooms;
          const clientTotal = Math.round(teamCost * (1 + markupPercent / 100) * 100) / 100;
          return {
            rate_ref: `00000000-0000-4000-8${String(hotelIndex).padStart(3, "0")}-${String(index).padStart(12, "0")}`,
            room_name: room.name,
            team_cost: teamCost,
            client_total: clientTotal,
            client_per_night: Math.round((clientTotal / 5) * 100) / 100,
            team_per_night: Math.round((teamCost / 5) * 100) / 100,
            currency: "USD",
            pricing_scope: "total" as const,
            rooms: input.rooms,
            board: null as string | null,
            source: "Contracted",
            cancel: "Cancel within 30 days",
            cancel_by: null as string | null,
            cancel_days: 30 as number | null,
            inclusions: ["Breakfast"] as string[],
            markup_percent: markupPercent,
            recommended: index === 0 && hotelIndex === 0,
            markup_buttons: [markupPercent, 30],
          };
        });
        const primaryRoom = rooms[0]?.room_name ?? null;
        const valueRoom = rooms[1]?.room_name ?? null;
        const suggestToClient =
          primaryRoom && valueRoom
            ? `${primaryRoom} (primary) · ${valueRoom} (value)`
            : primaryRoom
              ? `${primaryRoom} (primary)`
              : null;
        return {
          hotel: hit?.name ?? name,
          status: hit ? ("ok" as const) : ("not_in_pureluxe" as const),
          from_cost: rooms[0]?.team_cost ?? null,
          currency: rooms[0]?.currency ?? null,
          source: hit ? "Contracted" : null,
          recommended: hotelIndex === 0 && Boolean(hit),
          rooms,
          notes: {
            cancellation: "Cancel within 30 days",
            markup: `Commission rate ${markupPercent}% — client per-night and total use this`,
            inclusions: ["Breakfast"],
          },
          suggest_to_client: suggestToClient,
          note: hit ? null : `No PureLuxe hotel matched "${name}".`,
          alternatives: [],
        };
      });
      const preference =
        seed.clients
          .find((client) => client.id === trip.leadClientId)
          ?.preferences?.find((row) => /connect/i.test(row.label))?.label ?? null;
      const topSuggest = hotels.find((hotel) => hotel.recommended)?.suggest_to_client ?? null;
      const topHotel = hotels.find((hotel) => hotel.recommended)?.hotel ?? null;
      const cardSuggest =
        topHotel && topSuggest
          ? `${topHotel} · ${topSuggest.replace(" (primary)", "").split(" · ")[0]}${
              preference ? " · matches client preference" : ""
            }`
          : null;
      return {
        destination: input.destination,
        check_in: input.checkIn,
        check_out: input.checkOut,
        adults: input.adults,
        children: input.children,
        rooms: input.rooms,
        hotels: hotels.map((hotel) => ({
          hotel: hotel.hotel,
          status: hotel.status,
          property_id: null,
          result_ids: hotel.rooms.map((room) => room.rate_ref),
          min_markup_percent: null,
          note: hotel.note,
          alternatives: [],
          option_count: hotel.rooms.length,
        })),
        compare: {
          destination: input.destination,
          check_in: input.checkIn,
          check_out: input.checkOut,
          adults: input.adults,
          children: input.children,
          rooms: input.rooms,
          nights: 5,
          shared_terms: [],
          preference,
          suggest_to_client: cardSuggest,
          hotels,
        },
        notes: hotels.map((hotel) => hotel.hotel).join(", "),
        preference,
      };
    },

    async addQuoteOptions(input) {
      for (const option of input.options) {
        const existing = trip.quoteOptions.findIndex(
          (row) =>
            row.hotel.toLowerCase().includes(option.hotel.toLowerCase()) &&
            row.room.toLowerCase().includes(option.room.toLowerCase()),
        );
        const next = {
          hotel: option.hotel,
          room: option.room,
          markupPercent: option.markupPercent ?? null,
          clientPrice: option.clientPrice ?? null,
        };
        if (existing >= 0) trip.quoteOptions[existing] = next;
        else trip.quoteOptions.push(next);
      }
      return {
        ok: true as const,
        summary: `Added ${input.options.length} options to the quote. Below the hotel minimum once.`,
        undo: true,
      };
    },

    async setQuoteClientPrices(input) {
      for (const price of input.prices) {
        const row = trip.quoteOptions.find(
          (option) =>
            option.hotel.toLowerCase().includes(price.hotel.toLowerCase()) &&
            option.room.toLowerCase().includes(price.room.toLowerCase()),
        );
        if (row) {
          row.clientPrice = price.clientPrice;
          row.markupPercent = null;
        }
      }
      return { ok: true as const, summary: `Updated ${input.prices.length} client prices.`, undo: true };
    },

    async removeQuoteOption(input) {
      if (input.clearAll) {
        const n = trip.quoteOptions.length;
        trip.quoteOptions = [];
        return {
          ok: true as const,
          summary: `Removed all ${n} room${n === 1 ? "" : "s"} from the quote.`,
          undo: true,
        };
      }
      const targets = [
        ...(input.options ?? []),
        ...(input.hotel && input.room ? [{ hotel: input.hotel, room: input.room }] : []),
      ];
      let removed = 0;
      for (const target of targets) {
        const before = trip.quoteOptions.length;
        trip.quoteOptions = trip.quoteOptions.filter(
          (row) =>
            !(
              row.hotel.toLowerCase().includes(target.hotel.toLowerCase()) &&
              row.room.toLowerCase().includes(target.room.toLowerCase())
            ),
        );
        removed += before - trip.quoteOptions.length;
      }
      return {
        ok: true as const,
        summary: `Removed ${removed} room${removed === 1 ? "" : "s"} from the quote.`,
        undo: true,
      };
    },

    async setQuoteWording() {
      return { ok: true as const, summary: "Updated the quote wording.", undo: true };
    },

    async editQuoteLines(input) {
      const count = input.lines?.length ?? (input.find ? 1 : 0);
      return {
        ok: true as const,
        summary:
          count <= 1
            ? "Updated 1 line on the options quote."
            : `Updated ${count} lines on the options quote.`,
        undo: true,
      };
    },

    async rewriteQuoteSection() {
      return {
        ok: true as const,
        summary: "Rewrote 3 lines in clear client wording on the options quote.",
        undo: true,
      };
    },

    async listQuoteLines() {
      return {
        lines: trip.quoteOptions.map((row, index) => ({
          id: `room:seed-${index}:name`,
          label: `Room · ${row.room}`,
          text: row.room,
        })),
      };
    },

    async previewQuote() {
      return {
        ok: true as const,
        summary: "The options quote is open.",
        url: "https://example.test/options-quote.pdf",
        expires_in: 120,
      };
    },

    async usePastedQuote(input) {
      trip.quoteOptions.push({
        hotel: input.hotel,
        room: input.room,
        markupPercent: null,
        clientPrice: input.clientPrice ?? null,
      });
      return { ok: true as const, summary: `Added ${input.room} from the pasted quote.`, undo: true };
    },

    async sendQuote() {
      trip.quoteStatus = "sent";
      const name =
        seed.clients.find((client) => client.id === trip.leadClientId)?.displayName ?? "the client";
      return {
        ok: true as const,
        summary: `Sent ${trip.quoteOptions.length} options to ${name}.`,
        undo: false,
      };
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
