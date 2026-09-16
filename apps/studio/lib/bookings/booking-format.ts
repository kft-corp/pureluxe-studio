/** Shared booking display helpers for Studio UI. */

const SERVICE_TYPE_LABELS: Record<string, string> = {
  hotel: "Hotel",
  flight: "Flight",
  transfer: "Transfer",
  activity: "Activity",
};

const STATUS_LABELS: Record<string, string> = {
  on_hold: "On hold",
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  superseded: "Superseded",
};

const SOURCE_LABELS: Record<string, string> = {
  trip_builder: "Trip Builder",
  manual: "Manual",
  client_app: "Client app",
  import: "Import",
};

const TRAVELLER_ROLE_LABELS: Record<string, string> = {
  lead: "Lead",
  adult: "Adult",
  child: "Child",
  infant: "Infant",
};

const TRAVELLER_GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  unspecified: "Unspecified",
};

function titleCaseWords(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function displayOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

export function formatBookingDate(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const date = new Date(`${value.trim()}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date(value);
    if (Number.isNaN(fallback.getTime())) return value;
    return fallback.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  // Fixed locale so SSR and the browser render the same string.
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Timestamps (confirmed_at, audit, ticket limit) — fixed en-US for SSR parity. */
export function formatBookingDateTime(
  value: string | null | undefined,
): string {
  if (!value?.trim()) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type BookingDeadlineKind = "cancel" | "ticket";

export type BookingDeadlineDisplay = {
  label: string;
  kind: BookingDeadlineKind | null;
};

/** Prefer the sooner of cancel deadline vs ticket time limit. */
export function resolveBookingDeadline(
  cancellationDeadline: string | null | undefined,
  ticketTimeLimit: string | null | undefined,
): BookingDeadlineDisplay {
  const cancelRaw = cancellationDeadline?.trim() || "";
  const ticketRaw = ticketTimeLimit?.trim() || "";
  const cancelMs = cancelRaw
    ? Date.parse(`${cancelRaw}T00:00:00.000Z`)
    : Number.NaN;
  const ticketMs = ticketRaw ? Date.parse(ticketRaw) : Number.NaN;

  const hasCancel = !Number.isNaN(cancelMs);
  const hasTicket = !Number.isNaN(ticketMs);

  if (!hasCancel && !hasTicket) {
    return { label: "—", kind: null };
  }

  if (!hasTicket || (hasCancel && cancelMs <= ticketMs)) {
    return { label: formatBookingDate(cancelRaw), kind: "cancel" };
  }

  return {
    label: formatBookingDate(ticketRaw.slice(0, 10)),
    kind: "ticket",
  };
}

export function formatBookingNights(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value}N`;
}

/**
 * Duration chip for lists / detail — "Same day" for non-hotel same-day,
 * otherwise nights when > 0.
 */
export function bookingDurationLabel(input: {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  nights: number | null | undefined;
  serviceType?: string | null;
}): string | null {
  const sameDay = Boolean(
    input.startDate && input.endDate && input.startDate === input.endDate,
  );
  if (sameDay && input.serviceType !== "hotel") return "Same day";
  if (input.nights != null && input.nights > 0) {
    return formatBookingNights(input.nights);
  }
  return null;
}

/** Airport / city route label, e.g. BLR → MLE. */
export function formatFlightRoute(
  from: string | null | undefined,
  to: string | null | undefined,
): string | null {
  const origin = from?.trim().toUpperCase() ?? "";
  const destination = to?.trim().toUpperCase() ?? "";
  if (origin && destination) return `${origin} → ${destination}`;
  return origin || destination || null;
}

/** Manual create / edit channel presets. */
export const BOOKING_CHANNEL_PRESETS = [
  "offline",
  "direct",
  "wholesale",
  "GDS",
] as const;

export function formatBookingChannel(value: string): string {
  if (value === "GDS") return "GDS";
  if (!value.trim()) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function isLeadTravellerRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "lead";
}

export function formatBookingCount(value: number | null | undefined): string {
  if (value == null) return "—";
  return String(value);
}

export function formatBookingServiceType(value: string): string {
  return SERVICE_TYPE_LABELS[value] ?? value;
}

export function formatBookingStatus(value: string): string {
  return STATUS_LABELS[value] ?? value;
}

export function formatBookingSource(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  return SOURCE_LABELS[value] ?? titleCaseWords(value);
}

export function formatTripLinked(tripId: string | null | undefined): string {
  return tripId ? "Linked" : "No trip";
}

export function formatBookingMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  const code = currency?.trim().toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

export function formatTravellerRole(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  return TRAVELLER_ROLE_LABELS[value] ?? titleCaseWords(value);
}

export function formatTravellerGender(
  value: string | null | undefined,
): string {
  if (!value?.trim()) return "—";
  return TRAVELLER_GENDER_LABELS[value] ?? titleCaseWords(value);
}

export function formatBookingAuditAction(
  action: string,
  fieldName?: string | null,
): string {
  const base = titleCaseWords(action);
  if (!fieldName?.trim()) return base;
  return `${base}: ${titleCaseWords(fieldName)}`;
}
