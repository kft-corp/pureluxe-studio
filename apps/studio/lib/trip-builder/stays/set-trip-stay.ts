import {
  clearSelectedAccommodationForLeg,
  findActivePropertyById,
  findClientById,
  findStayShellLineItem,
  findSelectedAccommodationLineItem,
  findTripById,
  findTripLegById,
  listTripLegs,
  listTripTravellers,
  updateTrip as dbUpdateTrip,
  updateTripLeg,
  upsertFirstTripLeg,
  upsertStayShellLineItem,
} from "@pureluxe/db";
import { AppError, tripMessages, type SetTripStayInput } from "@pureluxe/shared";

import {
  matchPropertyByName,
  namesLooselyMatch,
  type PropertyNameMatch,
} from "@/lib/rates/match-property";

import { requireEditableTrip } from "../access/require-assigned-trip";
import {
  assertNoUnconfirmedOverlap,
  cancelStayBooking,
  markQuoteStale,
} from "./stay-side-effects";
import { syncTripCommercials } from "../pricing/sync-trip-commercials";
import { clearTripDossier } from "../chat/trip-dossier";
import { buildTripDetail, type TripDetail } from "../trip/trip-detail";
import { syncTripHotelBooking } from "../pricing/sync-trip-booking";
import { partyCounts } from "../party/trip-party";
import { nextTripTitle } from "../trip/trip-title";
import { assertStayInsideTrip, tripWindow } from "../trip/trip-window";

export type StayPropertyMatch = {
  status: PropertyNameMatch["status"];
  names: string[];
};

/**
 * Set Phase 1 fixed stay: first leg (city + dates) + named-hotel shell.
 * Blocked while pricing is locked.
 */
export async function setTripStay(
  tripId: string,
  input: SetTripStayInput,
  actor: { memberId: string },
): Promise<{ detail: TripDetail; property_match: StayPropertyMatch }> {
  const trip = await requireEditableTrip(tripId, actor.memberId);

  if (trip.pricing_locked_at) {
    throw new AppError({
      userMessage: tripMessages.error.pricingLocked,
      code: "trips.pricing_locked",
      status: 409,
    });
  }

  if (tripWindow(trip) && !trip.legs_confirmed_at) {
    throw new AppError({
      userMessage: tripMessages.error.legsNotConfirmed,
      code: "trips.legs_not_confirmed",
      status: 409,
    });
  }

  if (tripWindow(trip)) {
    assertStayInsideTrip(trip, input.check_in, input.check_out);
    const legs = await listTripLegs(trip.id);
    assertNoUnconfirmedOverlap(
      legs,
      input.check_in,
      input.check_out,
      input.leg_id ?? null,
      input.confirm_overlap,
    );
  }

  let propertyId = input.property_id;
  let propertyName = input.property_name;
  let destinationProfileId = input.destination_profile_id;
  const city = input.city.trim();

  let propertyMatch: StayPropertyMatch = { status: "none", names: [] };

  if (propertyId) {
    const property = await findActivePropertyById(propertyId);
    const typed = propertyName?.trim() ?? "";
    const sameHotel = !typed || !property || namesLooselyMatch(property.name, typed);
    if (!property || !sameHotel) {
      propertyId = null;
    } else {
      propertyName = property.name;
      destinationProfileId =
        destinationProfileId ?? property.destination_profile_id;
      propertyMatch = { status: "linked", names: [property.name] };
    }
  }

  if (!propertyId && propertyName?.trim()) {
    const match = await matchPropertyByName(propertyName);
    propertyMatch = { status: match.status, names: match.names };
    if (match.status === "linked" && match.property) {
      propertyId = match.property.id;
      propertyName = match.property.name;
      destinationProfileId =
        destinationProfileId ?? match.property.destination_profile_id;
    }
  }

  const hotelName = propertyName?.trim();
  if (!hotelName) {
    throw new AppError({
      userMessage: tripMessages.error.hotelRequired,
      code: "trips.hotel_required",
      status: 400,
    });
  }

  let leg;
  if (input.leg_id) {
    const existing = await findTripLegById(input.leg_id);
    if (!existing || existing.trip_id !== trip.id) {
      throw new AppError({
        userMessage: tripMessages.error.notFound,
        code: "trips.leg_not_found",
        status: 404,
      });
    }
    const datesChanged =
      existing.check_in !== input.check_in || existing.check_out !== input.check_out;
    const cityChanged =
      existing.destination.trim().toLowerCase() !== city.toLowerCase();
    const [selected, shell] = await Promise.all([
      findSelectedAccommodationLineItem(trip.id, existing.id),
      findStayShellLineItem(trip.id, existing.id),
    ]);
    const previousHotel = selected?.property_name ?? shell?.property_name ?? "";
    const hotelChanged =
      Boolean(previousHotel.trim()) && !namesLooselyMatch(previousHotel, hotelName);
    if (datesChanged || cityChanged || hotelChanged) {
      await clearSelectedAccommodationForLeg(trip.id, existing.id);
      if (selected) {
        await cancelStayBooking(trip.id, existing.id, actor, {
          pendingOnly: true,
          reason: "Stay changed in Trip Builder",
        });
      }
    }
    leg = await updateTripLeg(existing.id, {
      destination: city,
      check_in: input.check_in,
      check_out: input.check_out,
      destination_profile_id: destinationProfileId,
    });
  } else {
    leg = await upsertFirstTripLeg({
      trip_id: trip.id,
      destination: city,
      check_in: input.check_in,
      check_out: input.check_out,
      destination_profile_id: destinationProfileId,
    });
  }

  let adults = input.adults;
  let children = input.children;
  if (trip.travellers_confirmed_at) {
    const party = partyCounts(await listTripTravellers(trip.id));
    if (party.adults >= 1) {
      adults = party.adults;
      children = party.children;
    }
  }

  await upsertStayShellLineItem({
    trip_id: trip.id,
    leg_id: leg.id,
    property_id: propertyId,
    property_name: hotelName,
    created_by_id: actor.memberId,
    adults,
    children,
    rooms: input.rooms,
  });

  let clientName: string | null = null;
  if (trip.primary_client_id) {
    const client = await findClientById(trip.primary_client_id);
    clientName = client?.display_name ?? null;
  }

  const autoTitle = nextTripTitle(trip.title, {
    clientName,
    city,
    hotel: hotelName,
  });
  if (autoTitle) {
    await dbUpdateTrip(trip.id, { title: autoTitle });
  }

  await markQuoteStale(trip.id);
  await syncTripCommercials(trip.id);
  const fresh = (await findTripById(trip.id)) ?? trip;
  const detail = await buildTripDetail(fresh);
  await syncTripHotelBooking(detail, actor);
  await clearTripDossier(trip.id);
  return {
    detail,
    property_match: propertyMatch,
  };
}
