import { listClientDocuments, type ClientDocument } from "@pureluxe/db";

import type { TripDetail } from "../trip/trip-detail";

/** Derived child age for trip facts (never raw DOB). */
export type ChildAgeFact = {
  age_on_arrival?: number;
  dob_missing?: boolean;
};

function ageOn(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  const hadBirthday = m! > bm! || (m === bm && d! >= bd!);
  return y! - by! - (hadBirthday ? 0 : 1);
}

function bestPassportDob(documents: ClientDocument[]): string | null {
  const passports = documents
    .filter((row) => row.document_type === "passport" && row.status !== "rejected")
    .sort((a, b) => {
      if ((a.status === "verified") !== (b.status === "verified")) {
        return a.status === "verified" ? -1 : 1;
      }
      return (b.expiry_date ?? "").localeCompare(a.expiry_date ?? "");
    });
  return passports.find((row) => row.date_of_birth)?.date_of_birth ?? null;
}

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
 * Child ages on arrival from passport DOB, for agent trip facts.
 * Lead is never treated as a child (same rule as before-booking readiness).
 */
export async function loadChildAgeFacts(
  detail: TripDetail,
): Promise<Record<string, ChildAgeFact>> {
  const children = detail.travellers.filter(
    (person) => person.role !== "primary" && person.party_role === "child",
  );
  if (children.length === 0) return {};

  const onDate = arrivalDate(detail);
  const docsByChild = await Promise.all(
    children.map((child) => listClientDocuments(child.client_id)),
  );

  const out: Record<string, ChildAgeFact> = {};
  children.forEach((child, index) => {
    const dob = bestPassportDob(docsByChild[index] ?? []);
    if (!dob) {
      out[child.client_id] = { dob_missing: true };
      return;
    }
    // DOB on file but no trip dates yet — omit age until arrival date is known.
    if (!onDate) return;
    const age = ageOn(dob, onDate);
    if (!Number.isFinite(age) || age < 0) {
      out[child.client_id] = { dob_missing: true };
      return;
    }
    out[child.client_id] = { age_on_arrival: age };
  });
  return out;
}
