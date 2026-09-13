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

export function formatBookingServiceType(value: string): string {
  return SERVICE_TYPE_LABELS[value] ?? value;
}

export function formatBookingStatus(value: string): string {
  return STATUS_LABELS[value] ?? value;
}

export function formatTripLinked(tripId: string | null | undefined): string {
  return tripId ? "Linked" : "No trip";
}
