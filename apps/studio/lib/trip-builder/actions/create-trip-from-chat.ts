import type { TripCreateRequest, TripCreateResult, UpcomingTripMatch } from "@pureluxe/ai";
import { findTripCreatedWithKey, listUpcomingClientTrips, recordTripChange } from "@pureluxe/db";
import { journeyToday } from "@pureluxe/shared";

import { createTrip } from "../trip/create-trip";
import { resolveTripDates } from "../trip/resolve-dates";
import { staysOverlap } from "../trip/trip-window";

import { applyTripShape } from "./apply-trip-shape";
import {
  partyLabel,
  planParty,
  planStays,
  rangeLabel,
  sameCity,
  staysLabel,
  withAssumption,
  type PlannedParty,
} from "./plan-trip";
import { tripShapeOf, type TripShapeStay } from "./trip-shape";

export type TripCreateContext = {
  actor: { memberId: string };
  /** One trip per advisor message: a retried message returns the trip it created. */
  idempotencyKey: string;
};

/**
 * Upcoming trips of anyone travelling, any advisor's. Those overlapping the new dates
 * come first, then those to the same place.
 */
async function upcomingTrips(
  party: PlannedParty,
  request: { dates: { start: string; end: string } | null; cities: string[]; today: string },
  memberId: string,
): Promise<UpcomingTripMatch[]> {
  const trips = await listUpcomingClientTrips({
    clientIds: [party.lead.client_id, ...party.companions.map((person) => person.client_id)],
    today: request.today,
  });
  const { dates, cities } = request;
  const order = (trip: UpcomingTripMatch) => (trip.matches === "dates" ? 0 : trip.matches === "destination" ? 1 : 2);
  return trips
    .map((trip): UpcomingTripMatch => {
      const overlaps =
        dates && trip.starts_on && trip.ends_on && staysOverlap(dates.start, dates.end, trip.starts_on, trip.ends_on);
      const samePlace = trip.destinations.some((place) => cities.some((city) => sameCity(place, city)));
      return {
        trip_id: trip.id,
        title: trip.title,
        status: trip.status,
        starts_on: trip.starts_on,
        ends_on: trip.ends_on,
        destinations: trip.destinations,
        owner_name: trip.relationship_owner_id === memberId ? null : (trip.owner_name ?? "another advisor"),
        matches: overlaps ? "dates" : samePlace ? "destination" : null,
      };
    })
    .sort((left, right) => order(left) - order(right));
}

/**
 * Create a trip from the home chat with everything the advisor said: client and
 * household, dates and stays (hotel and rooms included). Every rule is checked before
 * the trip exists, so a refused request leaves nothing behind.
 */
export async function createTripFromChat(
  context: TripCreateContext,
  input: TripCreateRequest,
): Promise<TripCreateResult> {
  const { actor } = context;
  const today = journeyToday();
  const dates = input.start && input.end ? resolveTripDates({ start: input.start, end: input.end, today }) : null;
  const plan = dates
    ? planStays({ current: [], requested: input.stays, start: dates.start, end: dates.end })
    : { stays: [] as TripShapeStay[], roomsAssumed: false };

  const [createdBefore, party] = await Promise.all([
    findTripCreatedWithKey({ memberId: actor.memberId, idempotencyKey: context.idempotencyKey }),
    input.clientId
      ? planParty({ clientId: input.clientId, withHousehold: input.withHousehold, lead: input.lead })
      : Promise.resolve(null),
  ]);
  if (createdBefore) {
    return { ok: true, status: "created", trip_id: createdBefore, summary: "Trip already created.", unchanged: true };
  }

  if (party && !input.createAnyway) {
    const cities = plan.stays.length > 0 ? plan.stays.map((stay) => stay.city) : input.stays.map((stay) => stay.city);
    const upcoming = await upcomingTrips(party, { dates, cities, today }, actor.memberId);
    if (upcoming.length > 0) return { ok: true, status: "existing", upcoming_trips: upcoming };
  }

  const created = await createTrip({ primary_client_id: party?.lead.client_id ?? null }, actor);
  let assumptions = withAssumption({}, "year", dates?.yearAssumed ?? false);
  assumptions = withAssumption(assumptions, "rooms", plan.roomsAssumed);
  await applyTripShape(
    created.trip.id,
    {
      ...tripShapeOf(created),
      companions: (party?.companions ?? []).map(({ client_id, party_role }) => ({ client_id, party_role })),
      travellers_confirmed: Boolean(party),
      starts_on: dates?.start ?? null,
      ends_on: dates?.end ?? null,
      stays: plan.stays,
      legs_confirmed: plan.stays.length > 0,
      assumptions,
    },
    actor,
    created,
  );

  const where = plan.stays.length > 0
    ? staysLabel(plan.stays)
    : dates
      ? rangeLabel(dates.start, dates.end)
      : input.stays.length > 0
        ? `${input.stays.map((stay) => stay.city).join(", ")} (dates needed to add the stays)`
        : "no dates yet";
  const summary = [
    `Trip created for ${party ? partyLabel(party) : "no client yet"}`,
    `${where}${dates?.yearAssumed ? " (year assumed)" : ""}`,
  ].join(" · ");

  await recordTripChange({
    tripId: created.trip.id,
    memberId: actor.memberId,
    tool: "trip_create",
    args: { client_id: input.clientId ?? null, start: input.start ?? null, end: input.end ?? null },
    summary,
    before: null,
    after: null,
    idempotencyKey: context.idempotencyKey,
  });
  return { ok: true, status: "created", trip_id: created.trip.id, summary };
}
