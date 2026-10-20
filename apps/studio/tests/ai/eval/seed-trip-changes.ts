import type { TripAgentHandlers, TripChange } from "@pureluxe/ai";
import { AppError } from "@pureluxe/shared";

import { resolveTripDates } from "@/lib/trip-builder/trip/resolve-dates";

import type { ScenarioSeed } from "../scenario-types";

import type { EvalTrip } from "./eval-trip";

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
    async setClient({ clientId, withHousehold }, call) {
      const name = clientName(clientId);
      const household = withHousehold
        ? (seed.clients.find((row) => row.id === clientId)?.household ?? []).map((member) => member.clientId)
        : [];
      return apply(call.id, `Client set to ${name}`, () => {
        trip.leadClientId = clientId;
        trip.travellerIds = [clientId, ...household];
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
          return { destination: stay.city.trim(), checkIn: tripStart, checkOut: tripEnd, hotel: stay.hotel ?? null };
        }
        if (!stay.checkIn || !stay.checkOut) throw refuse(`Give check-in and check-out for ${stay.city}.`);
        const stayDates = resolveTripDates({ start: stay.checkIn, end: stay.checkOut, today: tripStart });
        if (stayDates.start < tripStart || stayDates.end > tripEnd) throw refuse(`${stay.city} sits outside the trip.`);
        return { destination: stay.city.trim(), checkIn: stayDates.start, checkOut: stayDates.end, hotel: stay.hotel ?? null };
      });
      return apply(call.id, `Stays: ${next.map((stay) => stay.destination).join(", ")}`, () => {
        trip.startsOn = tripStart;
        trip.endsOn = tripEnd;
        trip.stays = next;
        if (dates) withAssumed("year", dates.yearAssumed);
      });
    },

    async removeStay({ city }, call) {
      const stay = trip.stays.find((row) => sameCity(row.destination, city));
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
