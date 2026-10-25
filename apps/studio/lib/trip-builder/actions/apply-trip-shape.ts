import {
  deleteLineItemsForLeg,
  deleteTripLineItemsByIds,
  updateTrip as dbUpdateTrip,
  type UpdateTripRecord,
} from "@pureluxe/db";
import { AppError, tripMessages, type UpdateTripInput } from "@pureluxe/shared";

import {
  addTripTravellers,
  changeTripLead,
  confirmTripTravellers,
  partyCounts,
  removeTripTraveller,
} from "../party/trip-party";
import { addTripLeg } from "../stays/add-trip-leg";
import { removeTripLeg } from "../stays/remove-trip-leg";
import { reviseTripLeg } from "../stays/revise-trip-leg";
import { setTripStay } from "../stays/set-trip-stay";
import { markQuoteStale } from "../stays/stay-side-effects";
import { getTripDetail } from "../trip/get-trip-detail";
import type { TripDetail } from "../trip/trip-detail";
import { updateTrip } from "../trip/update-trip";
import { defaultRoomCount } from "../trip/resolve-dates";

import { sameStay, tripShapeOf, type TripShape, type TripShapeStay } from "./trip-shape";

type Actor = { memberId: string };

function sameText(left: string | null, right: string | null): boolean {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

async function applyTravellers(tripId: string, detail: TripDetail, target: TripShape, actor: Actor) {
  let next = detail;
  if (target.lead_client_id && target.lead_client_id !== next.client?.id) {
    next = next.client
      ? await changeTripLead(tripId, target.lead_client_id, actor)
      : await updateTrip(tripId, { primary_client_id: target.lead_client_id }, actor);
  }

  const wanted = new Map(target.companions.map((person) => [person.client_id, person.party_role]));
  for (const person of tripShapeOf(next).companions) {
    if (!wanted.has(person.client_id)) next = await removeTripTraveller(tripId, person.client_id, actor);
  }
  const current = new Map(tripShapeOf(next).companions.map((person) => [person.client_id, person.party_role]));
  const additions = [...wanted]
    .filter(([clientId, partyRole]) => current.get(clientId) !== partyRole)
    .map(([client_id, party_role]) => ({ client_id, party_role }));
  if (additions.length > 0) next = await addTripTravellers(tripId, additions, actor);

  if (target.travellers_confirmed && !next.trip.travellers_confirmed_at) {
    next = await confirmTripTravellers(tripId, actor);
  }
  return next;
}

/**
 * Trip dates that hold both the current stays and the target ones, so stays can move
 * one at a time. Null when the current dates already do.
 */
function widenedDates(detail: TripDetail, target: TripShape): { start: string; end: string } | null {
  if (!target.starts_on || !target.ends_on) return null;
  const { starts_on: start, ends_on: end } = detail.trip;
  const wide = {
    start: start && start < target.starts_on ? start : target.starts_on,
    end: end && end > target.ends_on ? end : target.ends_on,
  };
  return wide.start === start && wide.end === end ? null : wide;
}

/** Remove, move or add stays so the list matches; legs keep their id when they move. */
async function applyStayList(tripId: string, detail: TripDetail, stays: TripShapeStay[], actor: Actor) {
  let next = detail;
  const keep = new Set(stays.flatMap((stay) => (stay.leg_id ? [stay.leg_id] : [])));
  for (const stay of tripShapeOf(next).stays) {
    if (stay.leg_id && !keep.has(stay.leg_id)) next = await removeTripLeg(tripId, stay.leg_id, actor);
  }

  const placed: TripShapeStay[] = [];
  for (const stay of stays) {
    const existing = stay.leg_id ? tripShapeOf(next).stays.find((row) => row.leg_id === stay.leg_id) : null;
    const leg = { city: stay.city, check_in: stay.check_in, check_out: stay.check_out, confirm_overlap: true };
    if (existing) {
      const moved =
        !sameText(existing.city, stay.city) ||
        existing.check_in !== stay.check_in ||
        existing.check_out !== stay.check_out;
      if (moved) next = await reviseTripLeg(tripId, existing.leg_id!, leg, actor);
      placed.push(stay);
    } else {
      const added = await addTripLeg(tripId, leg, actor);
      next = added.detail;
      placed.push({ ...stay, leg_id: added.leg_id });
    }
  }
  return { detail: next, stays: placed };
}

function sameHotelName(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = (left ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const b = (right ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Choose or clear each stay's hotel.
 * Clearing drops quote rooms on that stay (and any rooms labelled with that hotel on
 * another stay — older attaches put multi-hotel options on the first leg).
 */
async function applyHotels(tripId: string, detail: TripDetail, stays: TripShapeStay[], actor: Actor) {
  let next = detail;
  const party = partyCounts(next.travellers);
  const adults = Math.max(1, party.adults);

  for (const stay of stays) {
    const current = tripShapeOf(next).stays.find((row) => row.leg_id === stay.leg_id);
    if (!current || !stay.leg_id || sameStay(current, stay)) continue;

    if (stay.hotel) {
      const result = await setTripStay(
        tripId,
        {
          leg_id: stay.leg_id,
          city: stay.city,
          check_in: stay.check_in,
          check_out: stay.check_out,
          property_id: null,
          property_name: stay.hotel,
          destination_profile_id: null,
          adults,
          children: party.children,
          rooms: stay.rooms ?? current.rooms ?? defaultRoomCount(adults),
          confirm_overlap: true,
        },
        actor,
      );
      next = result.detail;
    } else if (current.hotel) {
      if (next.pricing_locked) {
        throw new AppError({
          userMessage: tripMessages.error.pricingLocked,
          code: "trips.pricing_locked",
          status: 409,
        });
      }
      // Rooms may sit on this leg, or on another leg under this hotel name.
      const strayIds = next.rates.candidates
        .filter(
          (rate) =>
            rate.leg_id === stay.leg_id || sameHotelName(rate.property_name, current.hotel),
        )
        .map((rate) => rate.id);
      if (strayIds.length > 0) await deleteTripLineItemsByIds(strayIds);
      await deleteLineItemsForLeg(tripId, stay.leg_id);
      await markQuoteStale(tripId);
      next = await getTripDetail(tripId, actor);
    }
  }
  return next;
}

/** Trip-row flags with no service of their own (clearing them, assumptions), in one write. */
async function applyTripFlags(tripId: string, detail: TripDetail, target: TripShape): Promise<TripDetail> {
  const patch: UpdateTripRecord = {};
  if (!target.travellers_confirmed && detail.trip.travellers_confirmed_at) patch.travellers_confirmed_at = null;
  if (!target.legs_confirmed && detail.trip.legs_confirmed_at) patch.legs_confirmed_at = null;
  if (!target.starts_on && detail.trip.starts_on) Object.assign(patch, { starts_on: null, ends_on: null });
  if (JSON.stringify(target.assumptions) !== JSON.stringify(detail.trip.assumptions ?? {})) {
    patch.assumptions = target.assumptions;
  }
  if (Object.keys(patch).length === 0) return detail;
  const trip = await dbUpdateTrip(tripId, patch);
  return trip ? { ...detail, trip } : detail;
}

/**
 * Move the trip to `target` through the trip services, so every business rule and
 * side effect (bookings, rates, quote, party counts) applies as for any edit.
 * Only the steps that change something run; the dates are widened first only when a
 * stay would not fit while stays move. Pass `loaded` when the trip is already loaded.
 */
export async function applyTripShape(
  tripId: string,
  target: TripShape,
  actor: Actor,
  loaded?: TripDetail,
): Promise<TripDetail> {
  let detail = loaded ?? (await getTripDetail(tripId, actor));
  detail = await applyTravellers(tripId, detail, target, actor);

  const wide = widenedDates(detail, target);
  if (wide) detail = await updateTrip(tripId, { starts_on: wide.start, ends_on: wide.end }, actor);

  const placed = await applyStayList(tripId, detail, target.stays, actor);
  detail = placed.detail;

  const finish: UpdateTripInput = {};
  if (target.starts_on && target.ends_on) {
    if (detail.trip.starts_on !== target.starts_on || detail.trip.ends_on !== target.ends_on) {
      Object.assign(finish, { starts_on: target.starts_on, ends_on: target.ends_on });
    }
  }
  if (target.legs_confirmed && !detail.trip.legs_confirmed_at && placed.stays.length > 0) {
    finish.confirm_legs = true;
  }
  if (Object.keys(finish).length > 0) detail = await updateTrip(tripId, finish, actor);

  detail = await applyHotels(tripId, detail, placed.stays, actor);
  return applyTripFlags(tripId, detail, target);
}
