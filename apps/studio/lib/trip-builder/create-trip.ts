import { insertTrip, setTripPrimaryClient } from "@pureluxe/db";
import type { CreateTripInput } from "@pureluxe/shared";

import { requireActiveClient } from "@/lib/clients/require-active-client";

import { buildTripDetail, type TripDetail } from "./trip-detail";

/**
 * Create a Studio trip assigned to the actor.
 * Optional client seeds primary traveller + demo flag.
 */
export async function createTrip(
  input: CreateTripInput,
  actor: { memberId: string },
): Promise<TripDetail> {
  let isDemo = false;

  if (input.primary_client_id) {
    const client = await requireActiveClient(input.primary_client_id);
    isDemo = client.is_demo;
  }

  const trip = await insertTrip({
    primary_client_id: input.primary_client_id,
    relationship_owner_id: actor.memberId,
    title: input.title,
    created_by_id: actor.memberId,
    is_demo: isDemo,
    source: "studio",
  });

  if (input.primary_client_id) {
    await setTripPrimaryClient(trip.id, input.primary_client_id);
  }

  return buildTripDetail(trip);
}
