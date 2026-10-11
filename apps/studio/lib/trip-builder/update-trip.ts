import {
  findTripById,
  findTripDocument,
  listTripLegs,
  setTripPrimaryClient,
  updateTrip as dbUpdateTrip,
  type UpdateTripRecord,
} from "@pureluxe/db";
import { AppError, tripMessages, type UpdateTripInput } from "@pureluxe/shared";

import { requireActiveClient } from "@/lib/clients/require-active-client";

import { requireAssignedTrip } from "./require-assigned-trip";
import { markQuoteStale, removeStayRecord } from "./stay-side-effects";
import { syncTripHotelBooking } from "./sync-trip-booking";
import { clearTripDossier } from "./trip-dossier";
import { buildTripDetail, type TripDetail } from "./trip-detail";
import { nextTripTitle } from "./trip-title";
import { stayInsideWindow, tripWindow } from "./trip-window";

/** Patch trip shell fields; returns Studio detail. */
export async function updateTrip(
  tripId: string,
  input: UpdateTripInput,
  actor: { memberId: string },
): Promise<TripDetail> {
  const existing = await requireAssignedTrip(tripId, actor.memberId);

  let clientName: string | null = null;
  if (input.primary_client_id) {
    const client = await requireActiveClient(input.primary_client_id);
    clientName = client.display_name;
  }

  const patch: UpdateTripRecord = {};
  if (input.primary_client_id !== undefined) {
    patch.primary_client_id = input.primary_client_id;
    if (input.primary_client_id !== existing.primary_client_id) {
      patch.travellers_confirmed_at = null;
    }
  }
  if (input.title !== undefined) {
    patch.title = input.title;
  } else if (clientName) {
    const autoTitle = nextTripTitle(existing.title, { clientName });
    if (autoTitle) patch.title = autoTitle;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }
  if (input.starts_on && input.ends_on) {
    const legs = await listTripLegs(existing.id);
    const window = { start: input.starts_on, end: input.ends_on };
    const outside = legs.filter(
      (leg) =>
        leg.check_in &&
        leg.check_out &&
        !stayInsideWindow(window, leg.check_in, leg.check_out),
    );
    if (outside.length > 0 && !input.drop_outside_legs) {
      const names = outside
        .map((leg) => `${leg.destination} (${leg.check_in} to ${leg.check_out})`)
        .join(", ");
      throw new AppError({
        userMessage: `${names} sit outside ${input.starts_on} to ${input.ends_on}. Move those stays, or remove them, before changing the trip dates.`,
        code: "trips.leg_outside",
        status: 409,
      });
    }
    if (outside.length > 0 && input.drop_outside_legs) {
      for (const leg of outside) {
        await removeStayRecord(existing.id, leg.id, actor);
      }
      const remaining = await listTripLegs(existing.id);
      if (remaining.length === 0) {
        patch.legs_confirmed_at = null;
      }
    }
    patch.starts_on = input.starts_on;
    patch.ends_on = input.ends_on;
  }
  if (input.confirm_legs) {
    const window = tripWindow({
      starts_on: input.starts_on ?? existing.starts_on,
      ends_on: input.ends_on ?? existing.ends_on,
    });
    if (!window) {
      throw new AppError({
        userMessage: tripMessages.error.tripDatesRequired,
        code: "trips.dates_required",
        status: 409,
      });
    }
    const legs = await listTripLegs(existing.id);
    if (legs.length === 0) {
      throw new AppError({
        userMessage: tripMessages.error.legsRequired,
        code: "trips.legs_required",
        status: 409,
      });
    }
    patch.legs_confirmed_at = new Date().toISOString();
  }
  if (input.lock_pricing && !existing.pricing_locked_at) {
    const document = await findTripDocument(existing.id, "rates");
    if (!document?.file_path || document.status !== "ready") {
      throw new AppError({
        userMessage:
          document?.status === "stale"
            ? tripMessages.error.quoteStale
            : tripMessages.error.quoteFileMissing,
        code: "trips.quote_not_ready",
        status: 409,
      });
    }
    patch.pricing_locked_at = new Date().toISOString();
    patch.pricing_locked_by_id = actor.memberId;
  }

  const trip = await dbUpdateTrip(tripId, patch);

  if (!trip) {
    throw new AppError({
      userMessage: tripMessages.error.notFound,
      code: "trips.not_found",
      status: 404,
    });
  }

  if (input.primary_client_id) {
    await setTripPrimaryClient(trip.id, input.primary_client_id);
  }

  if (input.starts_on && input.ends_on) {
    await markQuoteStale(trip.id);
  }

  const fresh = (await findTripById(trip.id)) ?? trip;
  if (input.primary_client_id) {
    await syncTripHotelBooking(await buildTripDetail(fresh), actor);
  }

  clearTripDossier(trip.id);
  return buildTripDetail((await findTripById(trip.id)) ?? fresh);
}
