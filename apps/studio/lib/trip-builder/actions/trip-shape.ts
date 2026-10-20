import type { TripAssumptions, TripPartyRole } from "@pureluxe/db";

import type { TripDetail } from "../trip/trip-detail";

export type TripShapeStay = {
  /** Null for a stay that doesn't exist yet. */
  leg_id: string | null;
  city: string;
  check_in: string;
  check_out: string;
  /** Hotel name. Null until one is chosen. */
  hotel: string | null;
  rooms: number | null;
};

/**
 * The part of a trip the agent changes: who travels, when, and where they stay.
 * A change is "current shape → target shape"; Undo applies the shape from before.
 */
export type TripShape = {
  lead_client_id: string | null;
  companions: Array<{ client_id: string; party_role: TripPartyRole }>;
  travellers_confirmed: boolean;
  starts_on: string | null;
  ends_on: string | null;
  stays: TripShapeStay[];
  legs_confirmed: boolean;
  assumptions: TripAssumptions;
};

export function tripShapeOf(detail: TripDetail): TripShape {
  const stays = detail.stays.length > 0 ? detail.stays : detail.stay ? [detail.stay] : [];
  return {
    lead_client_id: detail.client?.id ?? null,
    companions: detail.travellers
      .filter((person) => person.role === "companion")
      .map((person) => ({ client_id: person.client_id, party_role: person.party_role })),
    travellers_confirmed: Boolean(detail.trip.travellers_confirmed_at),
    starts_on: detail.trip.starts_on,
    ends_on: detail.trip.ends_on,
    stays: stays.flatMap((stay) =>
      stay.check_in && stay.check_out
        ? [
            {
              leg_id: stay.leg_id,
              city: stay.city,
              check_in: stay.check_in,
              check_out: stay.check_out,
              hotel: stay.property_name,
              rooms: stay.rooms,
            },
          ]
        : [],
    ),
    legs_confirmed: Boolean(detail.trip.legs_confirmed_at),
    assumptions: detail.trip.assumptions ?? {},
  };
}

function sameText(left: string | null, right: string | null): boolean {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

export function sameStay(left: TripShapeStay, right: TripShapeStay): boolean {
  return (
    sameText(left.city, right.city) &&
    left.check_in === right.check_in &&
    left.check_out === right.check_out &&
    sameText(left.hotel, right.hotel) &&
    (right.rooms == null || left.rooms === right.rooms)
  );
}

/** True when applying `target` would change nothing. */
export function sameShape(current: TripShape, target: TripShape): boolean {
  const companions = (shape: TripShape) =>
    shape.companions
      .map((person) => `${person.client_id}:${person.party_role}`)
      .sort()
      .join(",");
  return (
    current.lead_client_id === target.lead_client_id &&
    companions(current) === companions(target) &&
    current.travellers_confirmed === target.travellers_confirmed &&
    current.starts_on === target.starts_on &&
    current.ends_on === target.ends_on &&
    current.legs_confirmed === target.legs_confirmed &&
    current.stays.length === target.stays.length &&
    current.stays.every((stay, index) => sameStay(stay, target.stays[index]!)) &&
    JSON.stringify(current.assumptions) === JSON.stringify(target.assumptions)
  );
}
