import type {
  LeadChoice,
  TripAgentHandlers,
  TripChange,
  TripCreateRequest,
  TripCreateResult,
  TripFacts,
  UpcomingTripMatch,
} from "@pureluxe/ai";
import { AppError } from "@pureluxe/shared";

import { cleanPlaceName } from "@/lib/trip-builder/actions/place-names";
import { resolveTripDates } from "@/lib/trip-builder/trip/resolve-dates";

import type { ScenarioSeed } from "../scenario-types";

import { toEvalTripFacts, type EvalTrip } from "./eval-trip";

type TripChangeHandlers = Pick<
  TripAgentHandlers,
  "setClient" | "setTravellers" | "setDates" | "setStays" | "removeStay" | "shiftDates" | "undo"
>;

function refuse(userMessage: string): AppError {
  return new AppError({ userMessage, code: "trips.change_refused", status: 409 });
}

function sameCity(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function snapshot(trip: EvalTrip): EvalTrip {
  return structuredClone(trip);
}

/** Lead and travellers, as Studio's planParty works them out from the seed's households. */
function seedParty(
  seed: ScenarioSeed,
  input: { clientId: string; withHousehold: boolean; lead: LeadChoice },
): { leadId: string; travellerIds: string[] } {
  const named = seed.clients.find((row) => row.id === input.clientId);
  if (!named) throw refuse("That client isn't in Studio.");
  const household = [named.id, ...(named.household ?? []).map((member) => member.clientId)];
  const primary =
    input.lead === "household_primary"
      ? seed.clients.find((row) => household.includes(row.id) && row.householdPrimary)
      : undefined;
  const leadId = primary?.id ?? named.id;
  const travellers = input.withHousehold ? household : [leadId];
  return { leadId, travellerIds: [leadId, ...travellers.filter((id) => id !== leadId)] };
}

/** Like Studio: seeded trips of anyone travelling that haven't ended, same dates first. */
function upcomingSeedTrips(
  seed: ScenarioSeed,
  travellerIds: string[],
  input: TripCreateRequest,
  dates: { start: string; end: string } | null,
  today: string,
): UpcomingTripMatch[] {
  return (seed.trips ?? [])
    .filter((row) => travellerIds.includes(row.leadClientId) && row.endsOn >= today)
    .map((row): UpcomingTripMatch => {
      const overlaps = dates && row.startsOn < dates.end && row.endsOn > dates.start;
      const samePlace = input.stays.some((stay) => sameCity(stay.city, row.destination));
      return {
        trip_id: row.id,
        title: `${clientNameOf(seed, row.leadClientId)} · ${row.destination}`,
        status: row.status,
        starts_on: row.startsOn,
        ends_on: row.endsOn,
        destinations: [row.destination],
        owner_name: row.ownerName ?? null,
        matches: overlaps ? "dates" : samePlace ? "destination" : null,
      };
    })
    .sort((left, right) => Number(right.matches === "dates") - Number(left.matches === "dates"));
}

function clientNameOf(seed: ScenarioSeed, clientId: string): string {
  return seed.clients.find((row) => row.id === clientId)?.displayName ?? clientId;
}

/** Home chat: fill in the run's trip, once per run (a retry returns the same trip). */
export function createSeedTrip(
  seed: ScenarioSeed,
  trip: EvalTrip,
  today: string,
  input: TripCreateRequest,
): TripCreateResult {
  if (trip.leadClientId || trip.startsOn) {
    return { ok: true, status: "created", trip_id: trip.tripId, summary: "Trip already created.", unchanged: true };
  }
  const party = input.clientId ? seedParty(seed, { ...input, clientId: input.clientId }) : null;
  const dates = input.start && input.end ? resolveTripDates({ start: input.start, end: input.end, today }) : null;
  const upcoming = party && !input.createAnyway ? upcomingSeedTrips(seed, party.travellerIds, input, dates, today) : [];
  if (upcoming.length > 0) return { ok: true, status: "existing", upcoming_trips: upcoming };
  const stays = dates
    ? input.stays.map((stay) => {
        const own = stay.checkIn && stay.checkOut
          ? resolveTripDates({ start: stay.checkIn, end: stay.checkOut, today: dates.start })
          : dates;
        return { destination: cleanPlaceName(stay.city, "city"), checkIn: own.start, checkOut: own.end, hotel: stay.hotel ?? null };
      })
    : [];

  trip.leadClientId = party?.leadId ?? null;
  trip.travellerIds = party?.travellerIds ?? [];
  trip.startsOn = dates?.start ?? null;
  trip.endsOn = dates?.end ?? null;
  trip.stays = stays;
  trip.assumed = dates?.yearAssumed ? ["year"] : [];
  const where = dates ? `${trip.stays.map((stay) => stay.destination).join(", ") || "no stays"} ${dates.start} to ${dates.end}` : "no dates yet";
  return {
    ok: true,
    status: "created",
    trip_id: trip.tripId,
    summary: `Trip created for ${partyLabel(toEvalTripFacts(trip, seed, today))} · ${where}${dates?.yearAssumed ? " (year assumed)" : ""}`,
  };
}

/** Like Studio's summary: "Ravi Mehta with Anika, Aarav and Kiara (2 adults, 2 children)". */
function partyLabel(facts: TripFacts): string {
  const travellers = facts.travellers ?? [];
  if (travellers.length === 0) return "no client yet";
  const children = travellers.filter((person) => person.party_role === "child").length;
  const adults = travellers.length - children;
  const counts = [`${adults} adult${adults === 1 ? "" : "s"}`, children ? `${children} child${children === 1 ? "" : "ren"}` : null];
  const [lead, ...others] = travellers.map((person) => person.display_name);
  return `${lead}${others.length ? ` with ${others.join(", ")}` : ""} (${counts.filter(Boolean).join(", ")})`;
}

/**
 * In-memory trip changes with the same rules the agent meets in Studio: dates without
 * a year roll forward, a single stay covers the whole trip, and Undo restores the last change.
 */
export function createSeedTripChanges(
  seed: ScenarioSeed,
  trip: EvalTrip,
  today: string,
): TripChangeHandlers {
  const undoStack: EvalTrip[] = [];
  const done = new Set<string>();

  function apply(callId: string, summary: string, change: () => void): TripChange {
    if (done.has(callId)) return { ok: true, summary, undo: false, unchanged: true };
    done.add(callId);
    undoStack.push(snapshot(trip));
    change();
    return { ok: true, summary, undo: true };
  }

  function withAssumed(key: string, assumed: boolean) {
    trip.assumed = trip.assumed.filter((item) => item !== key);
    if (assumed) trip.assumed.push(key);
  }

  function clientName(id: string): string {
    const client = seed.clients.find((row) => row.id === id);
    if (!client) throw refuse("That client isn't in Studio.");
    return client.displayName;
  }

  return {
    async setClient(input, call) {
      const party = seedParty(seed, input);
      return apply(call.id, `Client set to ${clientName(party.leadId)}`, () => {
        trip.leadClientId = party.leadId;
        trip.travellerIds = party.travellerIds;
      });
    },

    async setTravellers({ add, remove }, call) {
      if (!trip.leadClientId) throw refuse("Set the lead client first.");
      if (remove.includes(trip.leadClientId)) throw refuse("The lead stays on the trip.");
      const added = add.map((person) => person.clientId);
      added.forEach(clientName);
      return apply(call.id, "Travellers updated", () => {
        const kept = trip.travellerIds.filter((id) => !remove.includes(id));
        trip.travellerIds = [...new Set([...kept, ...added])];
      });
    },

    async setDates({ start, end }, call) {
      const dates = resolveTripDates({ start, end, today });
      const wholeTrip =
        trip.stays.length === 1 &&
        (!trip.startsOn || (trip.stays[0]!.checkIn === trip.startsOn && trip.stays[0]!.checkOut === trip.endsOn));
      if (!wholeTrip && trip.stays.some((stay) => stay.checkIn < dates.start || stay.checkOut > dates.end)) {
        throw refuse("A stay would sit outside the new dates. Set the stays together with the dates.");
      }
      return apply(call.id, `Dates set to ${dates.start} – ${dates.end}`, () => {
        trip.startsOn = dates.start;
        trip.endsOn = dates.end;
        if (wholeTrip) trip.stays = [{ ...trip.stays[0]!, checkIn: dates.start, checkOut: dates.end }];
        withAssumed("year", dates.yearAssumed);
      });
    },

    async setStays({ stays, start, end }, call) {
      const dates = start && end ? resolveTripDates({ start, end, today }) : null;
      const tripStart = dates?.start ?? trip.startsOn;
      const tripEnd = dates?.end ?? trip.endsOn;
      if (!tripStart || !tripEnd) throw refuse("Set the trip dates first, or give them with the stays.");
      const next = stays.map((stay) => {
        if (stays.length === 1 && !stay.checkIn && !stay.checkOut) {
          return { destination: cleanPlaceName(stay.city, "city"), checkIn: tripStart, checkOut: tripEnd, hotel: stay.hotel ?? null };
        }
        if (!stay.checkIn || !stay.checkOut) throw refuse(`Give check-in and check-out for ${stay.city}.`);
        const stayDates = resolveTripDates({ start: stay.checkIn, end: stay.checkOut, today: tripStart });
        if (stayDates.start < tripStart || stayDates.end > tripEnd) throw refuse(`${stay.city} sits outside the trip.`);
        return { destination: cleanPlaceName(stay.city, "city"), checkIn: stayDates.start, checkOut: stayDates.end, hotel: stay.hotel ?? null };
      });
      return apply(call.id, `Stays: ${next.map((stay) => stay.destination).join(", ")}`, () => {
        trip.startsOn = tripStart;
        trip.endsOn = tripEnd;
        trip.stays = next;
        if (dates) withAssumed("year", dates.yearAssumed);
      });
    },

    async removeStay({ city }, call) {
      const stay = trip.stays.find((row) => sameCity(row.destination, cleanPlaceName(city, "city")));
      if (!stay) throw refuse(`There is no stay in ${city} on this trip.`);
      return apply(call.id, `Removed ${stay.destination}`, () => {
        trip.stays = trip.stays.filter((row) => row !== stay);
      });
    },

    async shiftDates({ days }, call) {
      if (!trip.startsOn || !trip.endsOn) throw refuse("Set the trip dates first.");
      return apply(call.id, `Trip moved ${days} days`, () => {
        trip.startsOn = addDays(trip.startsOn!, days);
        trip.endsOn = addDays(trip.endsOn!, days);
        trip.stays = trip.stays.map((stay) => ({
          ...stay,
          checkIn: addDays(stay.checkIn, days),
          checkOut: addDays(stay.checkOut, days),
        }));
      });
    },

    async undo(call) {
      if (done.has(call.id)) return { ok: true, summary: "Already undone.", undo: false, unchanged: true };
      const before = undoStack.pop();
      if (!before) throw refuse("There is nothing to undo on this trip.");
      done.add(call.id);
      Object.assign(trip, before);
      return { ok: true, summary: "Undone: the last change", undo: false };
    },
  };
}
