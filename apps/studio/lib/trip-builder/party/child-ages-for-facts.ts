import { listClientDocuments } from "@pureluxe/db";

import type { TripDetail } from "../trip/trip-detail";

import {
  bestPassportDob,
  isMinorPartyRole,
  resolveChildAge,
} from "./resolve-child-age";

/** Derived child age for trip facts (never raw DOB). */
export type ChildAgeFact = {
  age_on_arrival?: number;
  dob_missing?: boolean;
};

function arrivalDate(detail: TripDetail): string | null {
  if (detail.trip.starts_on) return detail.trip.starts_on;
  const stays = detail.stays.length > 0 ? detail.stays : detail.stay ? [detail.stay] : [];
  const checkIns = stays
    .map((stay) => stay.check_in)
    .filter((day): day is string => Boolean(day))
    .sort();
  return checkIns[0] ?? null;
}

/**
 * Child / infant ages on arrival for agent trip facts.
 * Order: trip stated_age → client DOB → passport DOB.
 */
export async function loadChildAgeFacts(
  detail: TripDetail,
): Promise<Record<string, ChildAgeFact>> {
  const children = detail.travellers.filter(
    (person) => person.role !== "primary" && isMinorPartyRole(person.party_role),
  );
  if (children.length === 0) return {};

  const onDate = arrivalDate(detail);
  const docsByChild = await Promise.all(
    children.map((child) => listClientDocuments(child.client_id)),
  );

  const out: Record<string, ChildAgeFact> = {};
  children.forEach((child, index) => {
    const age = resolveChildAge({
      statedAge: child.stated_age,
      clientDob: child.date_of_birth,
      passportDob: bestPassportDob(docsByChild[index] ?? []),
      onDate,
    });
    if (age === "missing") {
      out[child.client_id] = { dob_missing: true };
      return;
    }
    // DOB on file but no trip dates yet — omit age until arrival date is known.
    if (age == null) return;
    out[child.client_id] = { age_on_arrival: age };
  });
  return out;
}
