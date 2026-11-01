import type { ClientDocument } from "@pureluxe/db";

export function ageOn(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  const hadBirthday = m! > bm! || (m === bm && d! >= bd!);
  return y! - by! - (hadBirthday ? 0 : 1);
}

export function bestPassportDob(documents: ClientDocument[]): string | null {
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

export function isMinorPartyRole(partyRole: string): boolean {
  return partyRole === "child" || partyRole === "infant";
}

/**
 * Prefer trip stated_age, then client DOB, then passport DOB.
 * Returns age when known; null when only DOB exists but onDate is missing;
 * "missing" when nothing usable is on file.
 */
export function resolveChildAge(input: {
  statedAge?: number | null;
  clientDob?: string | null;
  passportDob?: string | null;
  onDate?: string | null;
}): number | null | "missing" {
  if (input.statedAge != null && Number.isFinite(input.statedAge) && input.statedAge >= 0) {
    return Math.floor(input.statedAge);
  }
  const dob = input.clientDob || input.passportDob || null;
  if (!dob) return "missing";
  if (!input.onDate) return null;
  const age = ageOn(dob, input.onDate);
  if (!Number.isFinite(age) || age < 0) return "missing";
  return age;
}
