import {
  findClientById,
  findClientFamily,
  findLatestTripUndo,
  findTripChangeResult,
  recordTripUndo,
  type TripAssumptions,
  type TripPartyRole,
} from "@pureluxe/db";
import { AppError, journeyToday } from "@pureluxe/shared";

import { requireActiveClient } from "@/lib/clients/require-active-client";

import { shiftTripDates } from "../trip/shift-trip-dates";
import type { TripDetail } from "../trip/trip-detail";
import { resolveTripDates } from "../trip/resolve-dates";
import { staysOverlap, stayInsideWindow } from "../trip/trip-window";

import { applyTripShape } from "./apply-trip-shape";
import { tripShapeOf, type TripShape, type TripShapeStay } from "./trip-shape";
import {
  changeTripShape,
  withTripChange,
  type TripChangeContext,
  type TripChangeResult,
} from "./with-trip-change";

function refuse(userMessage: string, code: string): AppError {
  return new AppError({ userMessage, code, status: 409 });
}

function sameCity(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/** "10–15 Dec 2026". */
function rangeLabel(start: string, end: string): string {
  const format = (iso: string, withYear: boolean) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    });
  return `${format(start, false)} – ${format(end, true)}`;
}

function withAssumption(
  assumptions: TripAssumptions,
  key: keyof TripAssumptions,
  assumed: boolean,
): TripAssumptions {
  const next = { ...assumptions };
  if (assumed) next[key] = true;
  else delete next[key];
  return next;
}

function hasSelectedRate(detail: TripDetail, legId: string | null): boolean {
  return detail.rates.candidates.some((rate) => rate.selected && rate.leg_id === legId);
}

/** Lead client; with their household as the travelling party unless told otherwise. */
export async function setTripClient(
  context: TripChangeContext,
  input: { clientId: string; withHousehold: boolean },
): Promise<TripChangeResult> {
  const client = await requireActiveClient(input.clientId);
  const household = input.withHousehold ? await findClientFamily(client.id) : null;
  const companions = (household?.members ?? [])
    .filter((member) => member.client_id !== client.id)
    .map((member) => ({
      client_id: member.client_id,
      display_name: member.display_name,
      party_role: (member.role === "child" ? "child" : "adult") as TripPartyRole,
    }));

  return changeTripShape(context, (before) => {
    const names = companions.map((person) => person.display_name);
    return {
      target: {
        ...tripShapeOf(before),
        lead_client_id: client.id,
        companions: companions.map(({ client_id, party_role }) => ({ client_id, party_role })),
        travellers_confirmed: true,
      },
      summary: names.length > 0
        ? `Client set to ${client.display_name}, travelling with ${names.join(", ")}`
        : `Client set to ${client.display_name}, travelling alone`,
    };
  });
}

/** Add or remove companions, or change who is a child. The lead stays. */
export async function setTripTravellers(
  context: TripChangeContext,
  input: { add: Array<{ clientId: string; partyRole: TripPartyRole }>; remove: string[] },
): Promise<TripChangeResult> {
  const added = await Promise.all(input.add.map((person) => requireActiveClient(person.clientId)));
  const removed = await Promise.all(input.remove.map((id) => findClientById(id)));

  return changeTripShape(context, (before) => {
    const shape = tripShapeOf(before);
    if (!shape.lead_client_id) throw refuse("Set the lead client first.", "trips.client_required");
    if (input.remove.includes(shape.lead_client_id)) {
      throw refuse("The lead stays on the trip. Set a different lead to change it.", "trips.traveller_is_lead");
    }
    const companions = new Map(shape.companions.map((person) => [person.client_id, person.party_role]));
    for (const id of input.remove) companions.delete(id);
    for (const person of input.add) {
      if (person.clientId !== shape.lead_client_id) companions.set(person.clientId, person.partyRole);
    }
    const parts = [
      ...input.add.map((person, index) => `${added[index]!.display_name}${person.partyRole === "child" ? " (child)" : ""}`),
    ];
    const gone = removed.flatMap((row) => (row ? [row.display_name] : []));
    return {
      target: {
        ...shape,
        companions: [...companions].map(([client_id, party_role]) => ({ client_id, party_role })),
        travellers_confirmed: true,
      },
      summary: [
        parts.length > 0 ? `Added ${parts.join(", ")}` : null,
        gone.length > 0 ? `Removed ${gone.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("; "),
    };
  });
}

/** Trip dates from what the advisor said. A single stay that covered the trip moves with it. */
export async function setTripDates(
  context: TripChangeContext,
  input: { start: string; end: string },
): Promise<TripChangeResult> {
  const dates = resolveTripDates({ ...input, today: journeyToday() });
  return changeTripShape(context, (before) => {
    const shape = tripShapeOf(before);
    const window = { start: dates.start, end: dates.end };
    const [only] = shape.stays;
    const wholeTrip =
      shape.stays.length === 1 &&
      (!shape.starts_on || (only!.check_in === shape.starts_on && only!.check_out === shape.ends_on));
    const stays = wholeTrip
      ? [{ ...only!, check_in: dates.start, check_out: dates.end }]
      : shape.stays;
    const outside = stays.filter((stay) => !stayInsideWindow(window, stay.check_in, stay.check_out));
    if (outside.length > 0) {
      throw refuse(
        `${outside.map((stay) => `${stay.city} (${stay.check_in} to ${stay.check_out})`).join(", ")} would sit outside the new dates. Set the stays together with the dates.`,
        "trips.leg_outside",
      );
    }
    return {
      target: {
        ...shape,
        starts_on: dates.start,
        ends_on: dates.end,
        stays,
        assumptions: withAssumption(shape.assumptions, "year", dates.yearAssumed),
      },
      summary: `Dates set to ${rangeLabel(dates.start, dates.end)}${dates.yearAssumed ? " (year assumed)" : ""}`,
    };
  });
}

type StayInput = {
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
 * Every stay at once, in order. One stay without dates covers the whole trip. Optional
 * new trip dates apply in the same change. A stay that has the client's room can't be
 * dropped here; that needs trip_remove_stay (approval).
 */
export async function setTripStays(
  context: TripChangeContext,
  input: { stays: StayInput[]; start?: string; end?: string },
): Promise<TripChangeResult> {
  const today = journeyToday();
  return changeTripShape(context, (before) => {
    const shape = tripShapeOf(before);
    const dates =
      input.start && input.end ? resolveTripDates({ start: input.start, end: input.end, today }) : null;
    const start = dates?.start ?? shape.starts_on;
    const end = dates?.end ?? shape.ends_on;
    if (!start || !end) throw refuse("Set the trip dates first, or give them with the stays.", "trips.dates_required");

    const matched = matchStays(shape.stays, input.stays);
    let roomsAssumed = false;
    const stays: TripShapeStay[] = input.stays.map((stay, index) => {
      const existing = matched[index];
      const single = input.stays.length === 1 && !stay.checkIn && !stay.checkOut;
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
        city: stay.city.trim(),
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

    const kept = new Set(stays.map((stay) => stay.leg_id));
    const dropped = shape.stays.filter((stay) => !kept.has(stay.leg_id));
    const booked = dropped.find((stay) => hasSelectedRate(before, stay.leg_id));
    if (booked) {
      throw refuse(`${booked.city} has the client's room. Remove it with trip_remove_stay, which asks first.`, "trips.stay_has_booking");
    }

    let assumptions = shape.assumptions;
    if (dates) assumptions = withAssumption(assumptions, "year", dates.yearAssumed);
    assumptions = withAssumption(assumptions, "rooms", roomsAssumed);
    return {
      target: { ...shape, starts_on: start, ends_on: end, stays, legs_confirmed: true, assumptions },
      summary: `Stays: ${stays
        .map((stay) => `${stay.city} ${rangeLabel(stay.check_in, stay.check_out)}${stay.hotel ? ` · ${stay.hotel}` : ""}`)
        .join("; ")}`,
    };
  });
}

/** Remove one stay. With the client's room on it, its booking is cancelled and Undo is not offered. */
export function removeTripStay(context: TripChangeContext, input: { city: string }): Promise<TripChangeResult> {
  return withTripChange(context, async (before) => {
    const shape = tripShapeOf(before);
    const stay = shape.stays.find((row) => sameCity(row.city, input.city));
    if (!stay) throw refuse(`There is no stay in ${input.city} on this trip.`, "trips.leg_not_found");
    const target: TripShape = { ...shape, stays: shape.stays.filter((row) => row !== stay) };
    if (target.stays.length === 0) target.legs_confirmed = false;
    return {
      summary: `Removed ${stay.city} (${rangeLabel(stay.check_in, stay.check_out)})`,
      undoable: !hasSelectedRate(before, stay.leg_id),
      after: await applyTripShape(context.tripId, target, context.actor, before),
    };
  });
}

/** Move the whole trip. Selected rates clear and pending bookings are cancelled, so Undo is offered only when there were none. */
export function shiftTrip(context: TripChangeContext, input: { days: number }): Promise<TripChangeResult> {
  return withTripChange(context, async (before) => {
    const after = await shiftTripDates(context.tripId, input.days, context.actor);
    const count = Math.abs(input.days);
    return {
      summary: `Trip moved ${count} day${count === 1 ? "" : "s"} ${input.days > 0 ? "later" : "earlier"}, to ${rangeLabel(after.trip.starts_on!, after.trip.ends_on!)}`,
      undoable: !before.rates.candidates.some((rate) => rate.selected),
      after,
    };
  });
}

/** Undo the latest agent change on this trip (once, within 24 hours). A retried Undo does nothing. */
export async function undoTripChange(context: TripChangeContext): Promise<TripChangeResult> {
  const [done, latest] = await Promise.all([
    findTripChangeResult({
      tripId: context.tripId,
      memberId: context.actor.memberId,
      idempotencyKey: context.idempotencyKey,
    }),
    findLatestTripUndo(context.tripId),
  ]);
  if (done) return { ok: true, summary: "Already undone.", undo: false, unchanged: true };
  if (!latest) throw refuse("There is nothing to undo on this trip.", "trips.undo_none");

  const after = await applyTripShape(context.tripId, latest.before_payload as TripShape, context.actor);
  const version = await recordTripUndo({
    tripId: context.tripId,
    undoId: latest.id,
    memberId: context.actor.memberId,
    idempotencyKey: context.idempotencyKey,
  });
  context.onChanged?.({ ...after, trip: { ...after.trip, version } });
  return { ok: true, summary: `Undone: ${latest.summary ?? "the last change"}`, undo: false };
}
