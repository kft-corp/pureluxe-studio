import { insertTrip, setTripPrimaryClient } from "@pureluxe/db";
import type { CreateTripInput } from "@pureluxe/shared";

import { requireActiveClient } from "@/lib/clients/require-active-client";

import { buildTripDetail, type TripDetail } from "./trip-detail";
import { buildTripAutoTitle, NEW_TRIP_TITLE } from "./trip-title";

/**
 * Create a Studio trip assigned to the actor.
 * Optional client seeds primary traveller + demo flag + auto title.
 */
export async function createTrip(
  input: CreateTripInput,
  actor: { memberId: string },
): Promise<TripDetail> {
  let isDemo = false;
  let clientName: string | null = null;

  if (input.primary_client_id) {
    const client = await requireActiveClient(input.primary_client_id);
    isDemo = client.is_demo;
    clientName = client.display_name;
  }

  const title =
    input.title?.trim() ||
    (clientName
      ? buildTripAutoTitle({ clientName })
      : NEW_TRIP_TITLE);

  const trip = await insertTrip({
    primary_client_id: input.primary_client_id,
    relationship_owner_id: actor.memberId,
    title,
    created_by_id: actor.memberId,
    is_demo: isDemo,
    source: "studio",
  });

  if (input.primary_client_id) {
    await setTripPrimaryClient(trip.id, input.primary_client_id);
  }

  return buildTripDetail(trip);
}
