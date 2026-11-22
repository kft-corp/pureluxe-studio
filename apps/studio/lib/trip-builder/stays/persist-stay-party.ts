import {
  findStayShellLineItem,
  listTripLegs,
  upsertStayShellLineItem,
} from "@pureluxe/db";

import { loadTripStays } from "../trip/trip-detail";

function normPlace(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Save rooms + party on the stay shell for the matching city so the summary
 * sidebar and later rates/rechecks reuse the confirmed room count.
 */
export async function persistStayPartyFromRatesSearch(input: {
  tripId: string;
  destination: string;
  rooms: number;
  adults: number;
  children: number;
  memberId: string;
}): Promise<void> {
  const rooms = Math.max(1, Math.floor(input.rooms));
  const adults = Math.max(1, Math.floor(input.adults));
  const children = Math.max(0, Math.floor(input.children));
  if (!Number.isFinite(rooms) || rooms < 1) return;

  const [stays, legs] = await Promise.all([
    loadTripStays(input.tripId),
    listTripLegs(input.tripId),
  ]);
  if (stays.length === 0 || legs.length === 0) return;

  const needle = normPlace(input.destination);
  const matched =
    stays.find((stay) => {
      const city = stay.city?.trim();
      if (!city) return false;
      const hay = normPlace(city);
      return hay === needle || hay.includes(needle) || needle.includes(hay);
    }) ??
    stays[0] ??
    null;
  if (!matched) return;

  const leg = legs.find((row) => row.id === matched.leg_id);
  if (!leg) return;

  const shell = await findStayShellLineItem(input.tripId, matched.leg_id);
  const propertyName =
    matched.property_name?.trim() ||
    shell?.property_name?.trim() ||
    matched.city.trim() ||
    input.destination.trim() ||
    "Stay";

  await upsertStayShellLineItem({
    trip_id: input.tripId,
    leg_id: matched.leg_id,
    property_id: matched.property_id ?? shell?.property_id ?? null,
    property_name: propertyName,
    created_by_id: input.memberId,
    adults,
    children,
    rooms,
  });
}
