import {
  clearSelectedAccommodationForLeg,
  deleteTripCompanion,
  findStayShellLineItem,
  listTripLegs,
  listTripTravellers,
  patchStayShellParty,
  setTripPrimaryClient,
  updateTrip as dbUpdateTrip,
  upsertTripCompanion,
  type TripPartyRole,
  type TripTravellerRow,
  type UpdateTripRecord,
} from "@pureluxe/db";
import { AppError, tripMessages } from "@pureluxe/shared";

import { requireActiveClient } from "@/lib/clients/require-active-client";

import { requireEditableTrip } from "../access/require-assigned-trip";
import { markQuoteStale } from "../stays/stay-side-effects";
import { syncTripCommercials } from "../pricing/sync-trip-commercials";
import { syncTripHotelBooking } from "../pricing/sync-trip-booking";
import { closeTripRateSearches } from "@/lib/rates/rate-search-store";
import { buildTripDetail, type TripDetail } from "../trip/trip-detail";
import { nextTripTitle } from "../trip/trip-title";

export function partyCounts(rows: Array<{ party_role: TripPartyRole }>): {
  adults: number;
  children: number;
} {
  const children = rows.filter((row) => row.party_role === "child").length;
  return { adults: rows.length - children, children };
}

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function storedCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/** Copy the named party onto each stay. A real count change clears that stay's rate. */
async function applyPartyToStays(tripId: string, after: TripTravellerRow[]): Promise<void> {
  const next = partyCounts(after);
  const legs = await listTripLegs(tripId);
  let changed = false;
  for (const leg of legs) {
    const shell = await findStayShellLineItem(tripId, leg.id);
    const extracted = shell?.extracted_json;
    const adults = storedCount(extracted?.adults);
    const children = storedCount(extracted?.children);
    const differs = adults !== next.adults || children !== next.children;
    await patchStayShellParty(tripId, leg.id, next);
    if (differs && shell) {
      changed = true;
      await clearSelectedAccommodationForLeg(tripId, leg.id);
    }
  }
  if (changed) {
    await markQuoteStale(tripId);
    await syncTripCommercials(tripId);
  }
}

async function finish(
  tripId: string,
  actor: { memberId: string },
): Promise<TripDetail> {
  const trip = await requireEditableTrip(tripId, actor.memberId);
  const detail = await buildTripDetail(trip);
  await syncTripHotelBooking(detail, actor);
  await closeTripRateSearches(tripId);
  return detail;
}

/**
 * Make another Studio client the lead.
 * The previous lead stays on the trip as a traveller.
 * A confirmed party stays confirmed; stay counts follow the new list.
 */
export async function changeTripLead(
  tripId: string,
  clientId: string,
  actor: { memberId: string },
): Promise<TripDetail> {
  const trip = await requireEditableTrip(tripId, actor.memberId);
  if (trip.pricing_locked_at) {
    throw new AppError({
      userMessage: tripMessages.error.pricingLocked,
      code: "trips.pricing_locked",
      status: 409,
    });
  }
  const client = await requireActiveClient(clientId);
  if (client.id === trip.primary_client_id) {
    throw new AppError({
      userMessage: `${client.display_name} is already the lead on this trip.`,
      code: "trips.traveller_is_lead",
      status: 409,
    });
  }

  await setTripPrimaryClient(trip.id, client.id);
  const patch: UpdateTripRecord = { primary_client_id: client.id };
  const title = nextTripTitle(trip.title, { clientName: client.display_name });
  if (title) patch.title = title;
  await dbUpdateTrip(trip.id, patch);

  if (trip.travellers_confirmed_at) {
    await applyPartyToStays(trip.id, await listTripTravellers(trip.id));
  }
  return finish(trip.id, actor);
}

/** Add a client who is already in Studio. The lead is not replaced. */
export async function addTripTraveller(
  tripId: string,
  input: { client_id: string; party_role: TripPartyRole },
  actor: { memberId: string },
): Promise<TripDetail> {
  const trip = await requireEditableTrip(tripId, actor.memberId);
  if (trip.pricing_locked_at) {
    throw new AppError({
      userMessage: tripMessages.error.pricingLocked,
      code: "trips.pricing_locked",
      status: 409,
    });
  }
  if (!trip.primary_client_id) {
    throw new AppError({
      userMessage: tripMessages.error.clientRequired,
      code: "trips.client_required",
      status: 409,
    });
  }
  if (input.client_id === trip.primary_client_id) {
    throw new AppError({
      userMessage: "That person is already the lead on this trip.",
      code: "trips.traveller_is_lead",
      status: 409,
    });
  }

  const client = await requireActiveClient(input.client_id);
  const existing = await listTripTravellers(trip.id);
  if (existing.length >= 20 && !existing.some((row) => row.client_id === client.id)) {
    throw new AppError({
      userMessage: "This trip already has 20 travellers.",
      code: "trips.traveller_limit",
      status: 409,
    });
  }

  const partyRole: TripPartyRole = input.party_role === "child" ? "child" : "adult";
  await upsertTripCompanion(trip.id, client.id, partyRole);
  if (trip.travellers_confirmed_at) {
    await applyPartyToStays(trip.id, await listTripTravellers(trip.id));
  }
  return finish(trip.id, actor);
}

/** Remove a companion. The lead stays. */
export async function removeTripTraveller(
  tripId: string,
  clientId: string,
  actor: { memberId: string },
): Promise<TripDetail> {
  const trip = await requireEditableTrip(tripId, actor.memberId);
  if (trip.pricing_locked_at) {
    throw new AppError({
      userMessage: tripMessages.error.pricingLocked,
      code: "trips.pricing_locked",
      status: 409,
    });
  }
  if (clientId === trip.primary_client_id) {
    throw new AppError({
      userMessage: "The lead stays on the trip. Remove a companion instead.",
      code: "trips.traveller_is_lead",
      status: 409,
    });
  }

  const existing = await listTripTravellers(trip.id);
  const match = existing.find((row) => row.client_id === clientId && row.role === "companion");
  if (!match) {
    throw new AppError({
      userMessage: "That person is not a companion on this trip.",
      code: "trips.traveller_not_found",
      status: 404,
    });
  }

  await deleteTripCompanion(trip.id, clientId);
  if (trip.travellers_confirmed_at) {
    await applyPartyToStays(trip.id, await listTripTravellers(trip.id));
  }
  return finish(trip.id, actor);
}

export async function removeTripTravellerByName(
  tripId: string,
  name: string,
  actor: { memberId: string },
): Promise<TripDetail> {
  const trip = await requireEditableTrip(tripId, actor.memberId);
  const rows = await listTripTravellers(trip.id);
  const match = rows.find((row) => sameName(row.display_name, name));
  if (!match) {
    throw new AppError({
      userMessage: "That person is not on this trip.",
      code: "trips.traveller_not_found",
      status: 404,
    });
  }
  return removeTripTraveller(tripId, match.client_id, actor);
}

/** The named list is complete. Stay counts follow it. */
export async function confirmTripTravellers(
  tripId: string,
  actor: { memberId: string },
): Promise<TripDetail> {
  const trip = await requireEditableTrip(tripId, actor.memberId);
  if (!trip.primary_client_id) {
    throw new AppError({
      userMessage: tripMessages.error.clientRequired,
      code: "trips.client_required",
      status: 409,
    });
  }
  if (trip.pricing_locked_at) {
    throw new AppError({
      userMessage: tripMessages.error.pricingLocked,
      code: "trips.pricing_locked",
      status: 409,
    });
  }

  if (!trip.travellers_confirmed_at) {
    await dbUpdateTrip(trip.id, { travellers_confirmed_at: new Date().toISOString() });
  }
  await applyPartyToStays(trip.id, await listTripTravellers(trip.id));
  return finish(trip.id, actor);
}
