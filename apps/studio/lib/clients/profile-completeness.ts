import type { Client } from "@pureluxe/db";

/** Inputs for the 0–100 profile completeness score. */
export type ProfileCompletenessInput = {
  display_name: string | null | undefined;
  email: string | null | undefined;
  phone: string | null | undefined;
  nationality: string | null | undefined;
  city_of_residence: string | null | undefined;
  important_dates: unknown[] | null | undefined;
  guest_notes: string | null | undefined;
  relationship_owner_id: string | null | undefined;
  hasPreference?: boolean;
  hasVerifiedPassport?: boolean;
  hasFamily?: boolean;
  hasHealthBasics?: boolean;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

/**
 * Advisory completeness score for advisors (not guest-facing).
 * Spec: client_module.md §6.12
 */
export function computeProfileCompleteness(
  input: ProfileCompletenessInput,
): number {
  let score = 0;

  if (hasText(input.display_name)) score += 10;
  if (hasText(input.email) || hasText(input.phone)) score += 10;
  if (hasText(input.nationality)) score += 10;
  if (hasText(input.city_of_residence)) score += 10;
  if (Array.isArray(input.important_dates) && input.important_dates.length > 0) {
    score += 5;
  }
  if (hasText(input.guest_notes) || input.hasPreference) score += 10;
  if (input.hasVerifiedPassport) score += 15;
  if (input.hasFamily) score += 10;
  if (hasText(input.relationship_owner_id)) score += 10;
  if (input.hasHealthBasics) score += 10;

  return Math.min(100, score);
}

export type CompletenessHint = {
  label: string;
  section?: "identity" | "contact" | "location" | "notes" | "dates" | "health";
};

/** Short “what’s missing” list for the profile completeness meter. */
export function listCompletenessHints(
  input: ProfileCompletenessInput,
): CompletenessHint[] {
  const hints: CompletenessHint[] = [];

  if (!hasText(input.email) && !hasText(input.phone)) {
    hints.push({ label: "Add email or phone", section: "contact" });
  }
  if (!hasText(input.nationality)) {
    hints.push({ label: "Add nationality", section: "location" });
  }
  if (!hasText(input.city_of_residence)) {
    hints.push({ label: "Add city", section: "location" });
  }
  if (!hasText(input.relationship_owner_id)) {
    hints.push({ label: "Assign account owner", section: "identity" });
  }
  if (
    !Array.isArray(input.important_dates) ||
    input.important_dates.length === 0
  ) {
    hints.push({ label: "Add an important date", section: "dates" });
  }
  if (!hasText(input.guest_notes) && !input.hasPreference) {
    hints.push({ label: "Add notes or a preference", section: "notes" });
  }
  if (!input.hasVerifiedPassport) {
    hints.push({ label: "Verify a passport" });
  }
  if (!input.hasHealthBasics) {
    hints.push({ label: "Add dietary or emergency contact", section: "health" });
  }
  if (!input.hasFamily) {
    hints.push({ label: "Link household" });
  }

  return hints;
}

/** Score from a client row plus optional related-signal flags. */
export function computeProfileCompletenessFromClient(
  client: Pick<
    Client,
    | "display_name"
    | "email"
    | "phone"
    | "nationality"
    | "city_of_residence"
    | "important_dates"
    | "guest_notes"
    | "relationship_owner_id"
  >,
  signals?: {
    hasPreference?: boolean;
    hasVerifiedPassport?: boolean;
    hasFamily?: boolean;
    hasHealthBasics?: boolean;
  },
): number {
  return computeProfileCompleteness({
    ...client,
    ...signals,
  });
}
