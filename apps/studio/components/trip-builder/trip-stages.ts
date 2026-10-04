import type { TripDetail } from "@/lib/trip-builder";

export const TRIP_STAGES = [
  "client",
  "stay",
  "rates",
  "package",
  "quote",
] as const;

export type TripStage = (typeof TRIP_STAGES)[number];

export const TRIP_STAGE_LABELS: Record<TripStage, string> = {
  client: "Client",
  stay: "Stay",
  rates: "Rates",
  package: "Package",
  quote: "Quote",
};

function stayComplete(detail: TripDetail): boolean {
  return Boolean(
    detail.stay?.check_in &&
      detail.stay?.check_out &&
      detail.stay.property_name,
  );
}

/** Derive the current Phase 1 stage from trip detail. */
export function resolveTripStage(detail: TripDetail | null): TripStage {
  if (!detail?.client) return "client";
  if (!stayComplete(detail)) return "stay";
  if (!detail.rates.selected) return "rates";
  if (detail.quote.document?.status === "ready") return "quote";
  // Selected rate ⇒ Package until a quote PDF is ready.
  return "package";
}

/** Human next-step copy for the status strip. */
export function resolveNextStep(detail: TripDetail | null): string {
  if (!detail) return "Start a trip";
  if (!detail.client) return "Choose a client";
  if (!stayComplete(detail)) return "Set hotel, city, and dates";
  if (!detail.rates.selected) return "Search rates or paste a hotel quote";
  if (detail.quote.document?.status !== "ready") {
    return "Edit the quote draft, then generate the PDF";
  }
  return "Quote PDF is ready";
}

export function formatStayDates(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): string | null {
  if (!checkIn || !checkOut) return null;
  try {
    const from = new Date(`${checkIn}T12:00:00`);
    const to = new Date(`${checkOut}T12:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return `${checkIn} → ${checkOut}`;
    }
    const opts: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
    };
    const fromLabel = from.toLocaleDateString("en-US", opts);
    const toLabel = to.toLocaleDateString("en-US", {
      ...opts,
      year: from.getFullYear() === to.getFullYear() ? undefined : "numeric",
    });
    return `${fromLabel} – ${toLabel}`;
  } catch {
    return `${checkIn} → ${checkOut}`;
  }
}
