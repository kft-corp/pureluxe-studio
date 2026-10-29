import type { TripProposeSplitInput, TripProposeSplitResult } from "@pureluxe/ai";
import {
  findClientById,
  findLatestTripUndo,
  findTripChangeResult,
  recordTripUndo,
  type TripPartyRole,
} from "@pureluxe/db";
import { journeyToday } from "@pureluxe/shared";

import { requireActiveClient } from "@/lib/clients/require-active-client";

import { saveStatedAgesOnPassports } from "../party/save-stated-ages";
import { getTripDetail } from "../trip/get-trip-detail";
import { shiftTripDates } from "../trip/shift-trip-dates";
import type { TripDetail } from "../trip/trip-detail";
import { resolveTripDates } from "../trip/resolve-dates";
import { stayInsideWindow } from "../trip/trip-window";

import { applyTripShape } from "./apply-trip-shape";
import { cleanPlaceName } from "./place-names";
import {
  partyLabel,
  planParty,
  planStays,
  rangeLabel,
  refuse,
  sameCity,
  staysLabel,
  withAssumption,
  type StayInput,
} from "./plan-trip";
import {
  isQuoteSelectFinalUndo,
  undoQuoteSelectFinal,
} from "./quote-changes";
import { tripShapeOf, type TripShape } from "./trip-shape";
import {
  changeTripShape,
  withTripChange,
  type TripChangeContext,
  type TripChangeResult,
} from "./with-trip-change";

function hasSelectedRate(detail: TripDetail, legId: string | null): boolean {
  return detail.rates.candidates.some((rate) => rate.selected && rate.leg_id === legId);
}

/** Lead client, with their household as the travelling party unless told otherwise. */
export async function setTripClient(
  context: TripChangeContext,
  input: { clientId: string; withHousehold: boolean; lead: "named" | "household_primary" },
): Promise<TripChangeResult> {
  const party = await planParty(input);
  return changeTripShape(context, (before) => ({
    target: {
      ...tripShapeOf(before),
      lead_client_id: party.lead.client_id,
      companions: party.companions.map(({ client_id, party_role }) => ({ client_id, party_role })),
      travellers_confirmed: true,
    },
    summary: `Travellers set: ${partyLabel(party)}`,
  }));
}

/** Add or remove companions, or change who is a child. The lead stays. */
export async function setTripTravellers(
  context: TripChangeContext,
  input: {
    add: Array<{ clientId: string; partyRole: TripPartyRole; age?: number }>;
    remove: string[];
  },
): Promise<TripChangeResult> {
  const added = await Promise.all(input.add.map((person) => requireActiveClient(person.clientId)));
  const removed = await Promise.all(input.remove.map((id) => findClientById(id)));
  const withAges = input.add.filter((person) => person.age != null);
  const onDateHint =
    context.loaded?.trip.starts_on ??
    context.loaded?.stays[0]?.check_in ??
    null;

  const result = await changeTripShape(context, (before) => {
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
    const parts = input.add.map((person, index) => {
      const name = added[index]!.display_name;
      const ageBit = person.age != null ? ` (age ${person.age})` : "";
      const roleBit = person.partyRole === "child" ? " (child)" : "";
      return `${name}${ageBit}${roleBit}`;
    });
    const gone = removed.flatMap((row) => (row ? [row.display_name] : []));
    return {
      target: {
        ...shape,
        companions: [...companions].map(([client_id, party_role]) => ({ client_id, party_role })),
        travellers_confirmed: true,
      },
      summary: [
        parts.length > 0 ? `Updated travellers: ${parts.join(", ")}` : null,
        gone.length > 0 ? `Removed ${gone.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("; "),
    };
  });

  if (withAges.length > 0) {
    await saveStatedAgesOnPassports(
      withAges.map((person) => ({ clientId: person.clientId, age: person.age })),
      onDateHint ?? new Date().toISOString().slice(0, 10),
    );
  }

  return result;
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

/** Short day range for a split card, e.g. "10–12" (same month) or "10 Dec – 3 Jan". */
function shortStayRange(checkIn: string, checkOut: string): string {
  const start = new Date(`${checkIn}T12:00:00Z`);
  const end = new Date(`${checkOut}T12:00:00Z`);
  const day = (d: Date) => d.getUTCDate();
  const month = (d: Date) =>
    d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${day(start)}–${day(end)}`;
  }
  return `${day(start)} ${month(start)} – ${day(end)} ${month(end)}`;
}

/**
 * Propose a multi-city split without applying it. The advisor taps Accept to run trip_set_stays.
 */
export async function proposeTripSplit(
  tripId: string,
  input: TripProposeSplitInput,
  actor: { memberId: string },
  loaded?: TripDetail | null,
): Promise<TripProposeSplitResult> {
  const before = loaded ?? (await getTripDetail(tripId, actor));
  const shape = tripShapeOf(before);
  const today = journeyToday();
  const dates =
    input.start && input.end
      ? resolveTripDates({ start: input.start, end: input.end, today })
      : null;
  const start = dates?.start ?? shape.starts_on;
  const end = dates?.end ?? shape.ends_on;
  if (!start || !end) {
    throw refuse("Set the trip dates first, or give them with the split.", "trips.dates_required");
  }
  if (input.stays.length < 2) {
    throw refuse("A split needs at least two places.", "trips.split_too_few");
  }

  const { stays } = planStays({
    current: shape.stays,
    requested: input.stays.map((stay) => ({
      city: stay.city,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      hotel: stay.hotel,
      rooms: stay.rooms,
    })),
    start,
    end,
  });

  const summary = `${stays
    .map((stay) => `${stay.city} ${shortStayRange(stay.check_in, stay.check_out)}`)
    .join(", ")}?`;

  return {
    ok: true,
    summary: `Proposed split: ${summary.replace(/\?$/, "")}. Tap Accept to apply, or say different dates.`,
    split: {
      summary,
      stays: stays.map((stay) => ({
        city: stay.city,
        check_in: stay.check_in,
        check_out: stay.check_out,
        hotel: stay.hotel,
        rooms: stay.rooms,
      })),
    },
  };
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

    const { stays, roomsAssumed } = planStays({ current: shape.stays, requested: input.stays, start, end });

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
      summary: `Stays: ${staysLabel(stays)}`,
    };
  });
}

/** Remove one stay. With the client's room on it, its booking is cancelled and Undo is not offered. */
export function removeTripStay(context: TripChangeContext, input: { city: string }): Promise<TripChangeResult> {
  const city = cleanPlaceName(input.city, "city");
  return withTripChange(context, async (before) => {
    const shape = tripShapeOf(before);
    const stay = shape.stays.find((row) => sameCity(row.city, city));
    if (!stay) throw refuse(`There is no stay in ${city} on this trip.`, "trips.leg_not_found");
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

  const after = isQuoteSelectFinalUndo(latest.before_payload)
    ? await undoQuoteSelectFinal(context.tripId, latest.before_payload, context.actor)
    : await applyTripShape(
        context.tripId,
        latest.before_payload as TripShape,
        context.actor,
        context.loaded ?? undefined,
      );
  const version = await recordTripUndo({
    tripId: context.tripId,
    undoId: latest.id,
    memberId: context.actor.memberId,
    idempotencyKey: context.idempotencyKey,
  });
  context.onChanged?.({ ...after, trip: { ...after.trip, version } });
  return { ok: true, summary: `Undone: ${latest.summary ?? "the last change"}`, undo: false };
}
