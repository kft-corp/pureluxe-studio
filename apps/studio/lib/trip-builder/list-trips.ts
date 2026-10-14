import {
  findClientDisplayNamesByIds,
  listAssignedTrips,
  type TripDirectoryRow,
} from "@pureluxe/db";
import type { ListTripsQuery } from "@pureluxe/shared";

export type TripListItem = TripDirectoryRow & {
  client_display_name: string | null;
};

export type TripListResult = {
  trips: TripListItem[];
  total: number;
  limit: number;
  offset: number;
};

/** Assigned trips for Trip Builder home / switcher. */
export async function listTripBuilderTrips(
  query: ListTripsQuery,
  actor: { memberId: string },
): Promise<TripListResult> {
  const result = await listAssignedTrips({
    ownerMemberId: actor.memberId,
    q: query.q,
    status: query.status === "any" ? "any" : query.status,
    limit: query.limit,
    offset: query.offset,
  });

  const clientIds = [
    ...new Set(
      result.trips
        .map((trip) => trip.primary_client_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const names =
    clientIds.length > 0
      ? await findClientDisplayNamesByIds(clientIds)
      : new Map<string, string>();

  return {
    trips: result.trips.map((trip) => ({
      ...trip,
      client_display_name: trip.primary_client_id
        ? (names.get(trip.primary_client_id) ?? null)
        : null,
    })),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}
