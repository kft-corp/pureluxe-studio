/** Shared client UI helpers — formatting and labels. */

import {
  formatPhoneDisplay as formatPhoneDisplayShared,
  getCountryName,
  getLanguageName,
  isValidCountryCode,
} from "@pureluxe/shared";

export function formatVipLabel(tier: string): string {
  if (tier === "vip") return "VIP";
  if (tier === "vvip") return "VVIP";
  return "Standard";
}

export function formatFamilyRole(role: string): string {
  const labels: Record<string, string> = {
    primary: "Primary",
    spouse: "Spouse",
    partner: "Partner",
    child: "Child",
    parent: "Parent",
    member: "Member",
  };
  return labels[role] ?? role;
}

export function formatPreferredContact(
  method: string | null | undefined,
): string {
  if (method === "email") return "Email";
  if (method === "phone") return "Phone";
  if (method === "whatsapp") return "WhatsApp";
  return "—";
}

/** Preferred contact method options for register / edit forms. */
export const PREFERRED_CONTACT_OPTIONS = [
  { value: "", label: "Choose one" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" },
  { value: "whatsapp", label: "WhatsApp" },
] as const;

/**
 * Standard guest honorifics for name & identity.
 * Values are stored without a trailing period (Mr, Ms).
 */
export const CLIENT_TITLE_OPTIONS = [
  { value: "", label: "No title" },
  { value: "Mr", label: "Mr" },
  { value: "Mrs", label: "Mrs" },
  { value: "Ms", label: "Ms" },
  { value: "Miss", label: "Miss" },
] as const;

/**
 * Standard important-date types — keeps labels consistent in the database.
 */
export const CLIENT_IMPORTANT_DATE_LABEL_OPTIONS = [
  { value: "", label: "Choose a type" },
  { value: "Birthday", label: "Birthday" },
  { value: "Anniversary", label: "Anniversary" },
  { value: "Wedding anniversary", label: "Wedding anniversary" },
  { value: "Partner's birthday", label: "Partner's birthday" },
  { value: "Child's birthday", label: "Child's birthday" },
  { value: "Passport expiry", label: "Passport expiry" },
  { value: "Visa expiry", label: "Visa expiry" },
  { value: "Membership renewal", label: "Membership renewal" },
] as const;

/** Options for a date-label select, keeping any legacy free-text value visible. */
export function importantDateLabelSelectOptions(
  currentLabel: string | null | undefined,
): Array<{ value: string; label: string }> {
  const current = currentLabel?.trim() ?? "";
  const options: Array<{ value: string; label: string }> = [
    ...CLIENT_IMPORTANT_DATE_LABEL_OPTIONS,
  ];
  if (
    current &&
    !CLIENT_IMPORTANT_DATE_LABEL_OPTIONS.some(
      (option) => option.value === current,
    )
  ) {
    options.push({ value: current, label: current });
  }
  return options;
}

/** Options for the title select, keeping any legacy free-text value visible. */
export function clientTitleSelectOptions(
  currentTitle: string | null | undefined,
): Array<{ value: string; label: string }> {
  const current = normalizeClientTitle(currentTitle);
  const options: Array<{ value: string; label: string }> = [
    ...CLIENT_TITLE_OPTIONS,
  ];
  if (
    current &&
    !CLIENT_TITLE_OPTIONS.some((option) => option.value === current)
  ) {
    options.push({ value: current, label: current });
  }
  return options;
}

/** Map common variants (Mr. / MR) onto the standard stored value. */
export function normalizeClientTitle(
  raw: string | null | undefined,
): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "";
  const withoutDot = trimmed.replace(/\.$/, "");
  const match = CLIENT_TITLE_OPTIONS.find(
    (option) =>
      option.value.length > 0 &&
      option.value.toLowerCase() === withoutDot.toLowerCase(),
  );
  return match?.value ?? trimmed;
}

export function formatBookingDate(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  // Fixed locale so SSR and the browser render the same string (avoids hydration mismatch).
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function familySummaryLine(input: {
  familyName: string | null | undefined;
  members?: Array<{ client_id: string; role: string }>;
  currentClientId?: string;
}): string | null {
  if (!input.familyName?.trim()) return null;

  const others = (input.members ?? []).filter(
    (member) => member.client_id !== input.currentClientId,
  );
  if (others.length === 0) {
    return input.familyName;
  }

  const roles = others.map((member) =>
    formatFamilyRole(member.role).toLowerCase(),
  );
  const unique = [...new Set(roles)];
  const otherLabel =
    others.length === 1 ? "1 other" : `${others.length} others`;
  return `${input.familyName} · ${otherLabel} · ${unique.join(", ")}`;
}

export function displayOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

/** Nationality stored as ISO alpha-2; fall back to raw for legacy free text. */
export function formatNationality(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "—";
  if (isValidCountryCode(trimmed)) {
    return getCountryName(trimmed) ?? trimmed.toUpperCase();
  }
  return trimmed;
}

/** International phone for display; falls back to raw or dash. */
export function formatPhone(value: string | null | undefined): string {
  return formatPhoneDisplayShared(value) ?? displayOrDash(value);
}

/** Language ISO 639-1 → English name; legacy free text passes through. */
export function formatLanguage(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "—";
  return getLanguageName(trimmed) ?? trimmed;
}

/** IANA timezone with spaces; unknown values pass through. */
export function formatTimezone(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "—";
  return trimmed.replace(/_/g, " ");
}

export function formatDietaryLine(
  restrictions: string[] | null | undefined,
): string {
  if (!restrictions?.length) return "—";
  return restrictions.join(", ");
}

export function formatClientSource(source: string | null | undefined): string {
  if (source === "trip_builder") return "Trip Builder";
  if (source === "client_app") return "Client App";
  if (source === "import") return "Import";
  if (source === "studio") return "Studio";
  return displayOrDash(source);
}

export function formatAddressLines(input: {
  address_line_1?: string | null;
  address_line_2?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postal_code?: string | null;
  address_country?: string | null;
}): string {
  const line1 = input.address_line_1?.trim();
  const line2 = input.address_line_2?.trim();
  const cityLine = [
    input.address_city,
    input.address_state,
    input.address_postal_code,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  const countryRaw = input.address_country?.trim();
  const country = countryRaw
    ? isValidCountryCode(countryRaw)
      ? (getCountryName(countryRaw) ?? countryRaw)
      : countryRaw
    : null;
  const parts = [line1, line2, cityLine, country].filter(Boolean);
  return parts.length ? parts.join("\n") : "—";
}

export function formatImportantDate(input: {
  label: string;
  date: string;
  recurring?: boolean;
}): string {
  const dateLabel = formatBookingDate(input.date);
  return input.recurring ? `${dateLabel} · repeats yearly` : dateLabel;
}

export function formatSentiment(sentiment: string): string {
  if (sentiment === "prefer") return "Prefers";
  if (sentiment === "avoid") return "Avoids";
  if (sentiment === "require") return "Required";
  return titleCaseWords(sentiment);
}

/** Snake/underscore or kebab enum → Title Case for display. */
export function titleCaseWords(value: string): string {
  return value
    .replaceAll(/[_-]+/g, " ")
    .trim()
    .replaceAll(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDocumentType(type: string): string {
  const labels: Record<string, string> = {
    passport: "Passport",
    visa: "Visa",
    insurance: "Travel insurance",
    other: "Other document",
  };
  return labels[type] ?? titleCaseWords(type);
}

export function formatDocumentStatus(status: string): string {
  const labels: Record<string, string> = {
    pending_upload: "Upload pending",
    pending_review: "Pending review",
    verified: "Verified",
    rejected: "Rejected",
    expired: "Expired",
  };
  return labels[status] ?? titleCaseWords(status);
}

export function formatRelationshipType(type: string): string {
  const labels: Record<string, string> = {
    assistant: "Assistant",
    travel_companion: "Travel companion",
    colleague: "Colleague",
    referrer: "Referrer",
    other: "Other",
  };
  return labels[type] ?? titleCaseWords(type);
}

export function formatAuditAction(
  action: string,
  fieldName?: string | null,
): string {
  const labels: Record<string, string> = {
    created: "Profile created",
    updated: "Profile updated",
    merged: "Merged",
    deactivated: "Deactivated",
    reactivated: "Reactivated",
    approved: "Approved",
    document_verified: "Document verified",
    preference_confirmed: "Preference confirmed",
    guest_invited: "Guest invited",
    field_updated: "Field updated",
  };
  const base = labels[action] ?? titleCaseWords(action);
  if (!fieldName?.trim()) return base;
  return `${base}: ${titleCaseWords(fieldName)}`;
}

export function formatPreferenceCategory(category: string): string {
  return titleCaseWords(category);
}

/** True when a document expires within the next 6 months (or already expired). */
export function isDocumentExpiringSoon(
  expiryDate: string | null | undefined,
  withinMonths = 6,
): boolean {
  if (!expiryDate?.trim()) return false;
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return false;
  const limit = new Date();
  limit.setMonth(limit.getMonth() + withinMonths);
  return expiry.getTime() <= limit.getTime();
}

export function sortDocumentsByUrgency<
  T extends { expiry_date: string | null; status: string },
>(docs: T[]): T[] {
  return [...docs].sort((a, b) => {
    const aExpired =
      a.status === "expired" || isDocumentExpiringSoon(a.expiry_date, 0);
    const bExpired =
      b.status === "expired" || isDocumentExpiringSoon(b.expiry_date, 0);
    if (aExpired !== bExpired) return aExpired ? -1 : 1;

    const aSoon = isDocumentExpiringSoon(a.expiry_date);
    const bSoon = isDocumentExpiringSoon(b.expiry_date);
    if (aSoon !== bSoon) return aSoon ? -1 : 1;

    const aTime = a.expiry_date
      ? new Date(a.expiry_date).getTime()
      : Number.POSITIVE_INFINITY;
    const bTime = b.expiry_date
      ? new Date(b.expiry_date).getTime()
      : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
}
