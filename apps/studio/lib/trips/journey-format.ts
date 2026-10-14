import type { JourneyCard } from "@pureluxe/db";
import type { JourneyPhase } from "@pureluxe/shared";

const PHASE_LABELS: Record<JourneyPhase, string> = {
  planning: "Planning",
  upcoming: "Upcoming",
  on_trip: "On trip",
  past: "Past",
  cancelled: "Cancelled",
};

const STATUS_LABELS: Record<JourneyCard["status"], string> = {
  building: "Building",
  quote_sent: "Sent to client",
  waiting_on_client: "Waiting on client",
  booking: "Booking",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Short label for the card. Planning trips use the work status. */
export function formatJourneyPhase(card: Pick<JourneyCard, "phase" | "work">): string {
  if (card.phase === "planning" && card.work) {
    return STATUS_LABELS[card.work];
  }
  return PHASE_LABELS[card.phase];
}

export function formatTripStatus(status: JourneyCard["status"]): string {
  return STATUS_LABELS[status];
}

export type JourneyStageTone = "neutral" | "waiting" | "active" | "done" | "muted";

/**
 * One stage for list rows and the trip page.
 * Away today, finished, or cancelled wins; otherwise the stored status.
 */
export function journeyStage(card: Pick<JourneyCard, "phase" | "status">): {
  label: string;
  tone: JourneyStageTone;
} {
  if (card.phase === "on_trip") return { label: PHASE_LABELS.on_trip, tone: "active" };
  if (card.phase === "past") return { label: PHASE_LABELS.past, tone: "muted" };
  if (card.phase === "cancelled") return { label: PHASE_LABELS.cancelled, tone: "muted" };
  const label = STATUS_LABELS[card.status];
  if (card.status === "quote_sent" || card.status === "waiting_on_client") {
    return { label, tone: "waiting" };
  }
  if (card.status === "booking") return { label, tone: "active" };
  if (card.status === "confirmed") return { label, tone: "done" };
  return { label, tone: "neutral" };
}

export function formatJourneyParty(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 traveller" : `${count} travellers`;
}

/** Cities in travel order, e.g. Dubai → Malé. */
export function formatJourneyRoute(destinations: string[]): string | null {
  if (destinations.length === 0) return null;
  return destinations.join(" → ");
}

export function formatJourneySell(
  amount: number | null,
  currency: string | null,
): string | null {
  if (amount == null || Number.isNaN(amount)) return null;
  const code = currency?.trim().toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(0)}`;
  }
}
