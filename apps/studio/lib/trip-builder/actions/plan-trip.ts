import { findClientFamily, type TripAssumptions, type TripPartyRole } from "@pureluxe/db";
import { AppError } from "@pureluxe/shared";

import { requireActiveClient } from "@/lib/clients/require-active-client";

import { resolveTripDates } from "../trip/resolve-dates";
import { staysOverlap, stayInsideWindow } from "../trip/trip-window";

import { cleanPlaceName } from "./place-names";
import type { TripShapeStay } from "./trip-shape";

/** Pure planning shared by the trip chat's changes and trip creation from the home chat. */

export function refuse(userMessage: string, code: string): AppError {
  return new AppError({ userMessage, code, status: 409 });
}

export function sameCity(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/** "10 Dec – 15 Dec 2026". */
export function rangeLabel(start: string, end: string): string {
  const format = (iso: string, withYear: boolean) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    });
  return `${format(start, false)} – ${format(end, true)}`;
}

export function withAssumption(
  assumptions: TripAssumptions,
  key: keyof TripAssumptions,
  assumed: boolean,
): TripAssumptions {
  const next = { ...assumptions };
  if (assumed) next[key] = true;
  else delete next[key];
  return next;
}

export type PlannedParty = {
  lead: { client_id: string; display_name: string };
  companions: Array<{ client_id: string; display_name: string; party_role: TripPartyRole }>;
};

/**
 * Lead and travellers for a client. "household_primary" (the advisor named a family)
 * makes the household's primary member the lead; the household travels unless told otherwise.
 */
export async function planParty(input: {
  clientId: string;
  withHousehold: boolean;
  lead: "named" | "household_primary";
}): Promise<PlannedParty> {
  const named = await requireActiveClient(input.clientId);
  const household = input.withHousehold || input.lead === "household_primary"
    ? await findClientFamily(named.id)
    : null;
  const primary = input.lead === "household_primary"
    ? household?.members.find((member) => member.is_primary)
    : undefined;
  const lead = primary
    ? { client_id: primary.client_id, display_name: primary.display_name }
    : { client_id: named.id, display_name: named.display_name };

  const companions = input.withHousehold
    ? (household?.members ?? [])
        .filter((member) => member.client_id !== lead.client_id)
        .map((member) => ({
          client_id: member.client_id,
          display_name: member.display_name,
          party_role: (member.role === "child" ? "child" : "adult") as TripPartyRole,
        }))
    : [];
  return { lead, companions };
}

/** "Ravi Mehta with Anika, Aarav and Kiara (2 adults, 2 children)". */
export function partyLabel(party: PlannedParty): string {
  const children = party.companions.filter((person) => person.party_role === "child").length;
  const adults = 1 + party.companions.length - children;
  const counts = [
    adults === 1 ? "1 adult" : `${adults} adults`,
    children === 0 ? null : children === 1 ? "1 child" : `${children} children`,
  ]
    .filter(Boolean)
    .join(", ");
  const names = party.companions.map((person) => person.display_name.split(" ")[0]);
  const together = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return `${party.lead.display_name}${together ? ` with ${together}` : ""} (${counts})`;
}

export type StayInput = {
  city: string;
  checkIn?: string;
  checkOut?: string;
  hotel?: string | null;
  rooms?: number;
};

/** Match each requested stay to an existing one by city, in order, so moved stays keep their rates. */
function matchStays(current: TripShapeStay[], requested: StayInput[]): Array<TripShapeStay | null> {
  const free = [...current];
  return requested.map((stay) => {
    const index = free.findIndex((row) => sameCity(row.city, stay.city));
    return index >= 0 ? free.splice(index, 1)[0]! : null;
  });
}

/**
 * Every requested stay inside the trip window, in order. One stay without dates covers
 * the whole trip; dates without a year follow the trip start. Names are cleaned, and
 * stays may not leave the trip or overlap each other.
 */
export function planStays(input: {
  current: TripShapeStay[];
  requested: StayInput[];
  start: string;
  end: string;
}): { stays: TripShapeStay[]; roomsAssumed: boolean } {
  const { start, end } = input;
  const requested = input.requested.map((stay) => ({
    ...stay,
    city: cleanPlaceName(stay.city, "city"),
    hotel: stay.hotel ? cleanPlaceName(stay.hotel, "hotel") : stay.hotel,
  }));
  const matched = matchStays(input.current, requested);
  let roomsAssumed = false;

  const stays: TripShapeStay[] = requested.map((stay, index) => {
    const existing = matched[index];
    const single = requested.length === 1 && !stay.checkIn && !stay.checkOut;
    if (!single && (!stay.checkIn || !stay.checkOut)) {
      throw refuse(`Give check-in and check-out for ${stay.city}.`, "trips.stay_dates_required");
    }
    const stayDates = single
      ? { start, end }
      : resolveTripDates({ start: stay.checkIn!, end: stay.checkOut!, today: start });
    const hotel = stay.hotel === undefined ? existing?.hotel ?? null : stay.hotel;
    if (hotel && stay.rooms == null && existing?.rooms == null) roomsAssumed = true;
    return {
      leg_id: existing?.leg_id ?? null,
      city: stay.city,
      check_in: stayDates.start,
      check_out: stayDates.end,
      hotel,
      rooms: stay.rooms ?? existing?.rooms ?? null,
    };
  });

  for (const [index, stay] of stays.entries()) {
    if (!stayInsideWindow({ start, end }, stay.check_in, stay.check_out)) {
      throw refuse(`${stay.city} (${stay.check_in} to ${stay.check_out}) sits outside the trip, ${start} to ${end}.`, "trips.leg_outside");
    }
    const clash = stays.find(
      (other, otherIndex) =>
        otherIndex !== index && staysOverlap(stay.check_in, stay.check_out, other.check_in, other.check_out),
    );
    if (clash) throw refuse(`${stay.city} and ${clash.city} overlap. Adjust the nights.`, "trips.stay_overlap");
  }
  return { stays, roomsAssumed };
}

/** "Maldives 15 Dec – 20 Dec 2026 · Six Senses Kanuhura; …". */
export function staysLabel(stays: TripShapeStay[]): string {
  return stays
    .map((stay) => `${stay.city} ${rangeLabel(stay.check_in, stay.check_out)}${stay.hotel ? ` · ${stay.hotel}` : ""}`)
    .join("; ");
}
