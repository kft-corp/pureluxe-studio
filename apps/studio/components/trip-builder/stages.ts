import type { TripDetail, TripStaySnapshot } from "@/lib/trip-builder";
import { isQuoteAccepted, isQuoteWithClient } from "@/lib/trips/trip-status";
import { statusNextStep } from "@/lib/trips/journey-next-step";

export const TRIP_STAGES = [
  "client",
  "stay",
  "rates",
  "quote",
  "booking",
] as const;

export type TripStage = (typeof TRIP_STAGES)[number];

export const TRIP_STAGE_LABELS: Record<TripStage, string> = {
  client: "Client",
  stay: "Stay",
  rates: "Rates",
  quote: "Quote",
  booking: "Booking",
};

/** Stages where rooms, rates, and the client price are worked on. */
export function isRateStage(stage: TripStage): boolean {
  return stage === "rates" || stage === "quote" || stage === "booking";
}

/** Confirmed or completed: every stage is done. */
export function tripStagesFinished(detail: TripDetail | null): boolean {
  const status = detail?.trip.status;
  return status === "confirmed" || status === "completed";
}

function byCheckIn(a: TripStaySnapshot, b: TripStaySnapshot): number {
  const aIn = a.check_in || "9999-99-99";
  const bIn = b.check_in || "9999-99-99";
  if (aIn !== bIn) return aIn < bIn ? -1 : 1;
  return a.city.localeCompare(b.city);
}

export function tripStays(detail: TripDetail | null): TripStaySnapshot[] {
  if (!detail) return [];
  const stays = detail.stays.length > 0 ? detail.stays : detail.stay ? [detail.stay] : [];
  return [...stays].sort(byCheckIn);
}

function daySpan(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Travel nights between stays, in check-in order. Empty when stays touch. */
export function stayGapNotes(stays: TripStaySnapshot[]): string[] {
  const dated = stays.filter((stay) => stay.check_in && stay.check_out);
  const notes: string[] = [];
  for (let index = 1; index < dated.length; index += 1) {
    const prev = dated[index - 1]!;
    const next = dated[index]!;
    if (!prev.check_out || !next.check_in || next.check_in <= prev.check_out) continue;
    const nights = daySpan(prev.check_out, next.check_in);
    if (nights <= 0) continue;
    const label = nights === 1 ? "1 night" : `${nights} nights`;
    notes.push(`${label} between ${prev.city} and ${next.city}`);
  }
  return notes;
}

export function stayIsComplete(stay: TripStaySnapshot): boolean {
  return Boolean(stay.check_in && stay.check_out && stay.property_name?.trim());
}

function staysComplete(detail: TripDetail): boolean {
  const stays = tripStays(detail);
  return stays.length > 0 && stays.every(stayIsComplete);
}

/** Every stay has the client's chosen room. */
function roomsChosen(detail: TripDetail): boolean {
  const stays = tripStays(detail).filter(stayIsComplete);
  if (stays.length === 0) return false;
  return stays.every((stay) =>
    detail.rates.candidates.some(
      (rate) => rate.selected && rate.leg_id === stay.leg_id,
    ),
  );
}

/** How many stays still need the client's chosen room. */
export function staysAwaitingRoom(detail: TripDetail): number {
  return detail.stays.filter(
    (stay) =>
      !detail.rates.candidates.some((rate) => rate.selected && rate.leg_id === stay.leg_id),
  ).length;
}

/** Every stay has a room with a client price, so the options quote can go out. */
function roomsPriced(detail: TripDetail): boolean {
  const stays = tripStays(detail).filter(stayIsComplete);
  if (stays.length === 0) return false;
  const tripPriced = detail.trip.sell_total != null;
  return stays.every((stay) =>
    detail.rates.candidates.some(
      (rate) =>
        rate.leg_id === stay.leg_id &&
        (rate.sell_amount != null || (rate.selected && tripPriced)),
    ),
  );
}

export function travellersConfirmed(detail: TripDetail | null): boolean {
  return Boolean(detail?.trip.travellers_confirmed_at);
}

export function partyFromTravellers(detail: TripDetail | null): {
  adults: number;
  children: number;
} {
  const rows = detail?.travellers ?? [];
  const children = rows.filter((row) => row.party_role === "child").length;
  const adults = rows.filter((row) => row.party_role !== "child").length;
  return { adults, children };
}

/**
 * Current stage. Once the quote is with the client or accepted, the trip status decides.
 * Before that, the plan does.
 */
export function resolveTripStage(detail: TripDetail | null): TripStage {
  if (!detail?.client) return "client";
  const status = detail.trip.status;
  if (isQuoteAccepted(status)) return "booking";
  if (isQuoteWithClient(status)) return "quote";
  if (!travellersConfirmed(detail)) return "client";
  if (!tripDatesReady(detail) || !legsConfirmed(detail)) return "stay";
  if (!staysComplete(detail)) return "stay";
  if (!roomsPriced(detail)) return "rates";
  return "quote";
}

export function tripDatesReady(detail: TripDetail | null): boolean {
  return Boolean(detail?.trip.starts_on && detail.trip.ends_on);
}

export function legsConfirmed(detail: TripDetail | null): boolean {
  return Boolean(detail?.trip.legs_confirmed_at);
}

/** Next step for the header. Matches the trip page once the plan is in place. */
export function resolveNextStep(detail: TripDetail | null): string {
  if (!detail) return "Start a trip";
  const status = detail.trip.status;
  const document = detail.options_quote.document;
  const fromStatus = () =>
    statusNextStep({
      status,
      quoteReady: document?.status === "ready" && Boolean(document.has_file),
      quoteStale: document?.status === "stale",
      roomsChosen: roomsChosen(detail),
    });
  if (status !== "building") return fromStatus();
  if (!detail.client) return "Select a client";
  if (!travellersConfirmed(detail)) return "Name the travellers";
  if (!tripDatesReady(detail)) return "Set the trip dates";
  if (!legsConfirmed(detail)) return "List each stay";
  if (!staysComplete(detail)) return "Set hotel & party";
  if (!roomsPriced(detail)) return "Add rooms with a client price";
  return fromStatus();
}

/** Earliest check-in through latest check-out. */
export function formatTripDates(stays: TripStaySnapshot[]): string | null {
  const checkIn = stays
    .map((stay) => stay.check_in)
    .filter((value): value is string => Boolean(value))
    .sort();
  const checkOut = stays
    .map((stay) => stay.check_out)
    .filter((value): value is string => Boolean(value))
    .sort();
  if (!checkIn[0] || !checkOut.length) return null;
  return formatStayDates(checkIn[0], checkOut[checkOut.length - 1] ?? null);
}

/** Pill label: "Maldives 10–15 Oct". */
export function legPillLabel(stay: TripStaySnapshot): string {
  const city = stay.city.trim() || "Stay";
  if (!stay.check_in || !stay.check_out) return city;
  const from = new Date(`${stay.check_in}T12:00:00`);
  const to = new Date(`${stay.check_out}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return city;
  const day = (date: Date) => date.toLocaleDateString("en-US", { day: "numeric" });
  const month = (date: Date) => date.toLocaleDateString("en-US", { month: "short" });
  const sameMonth =
    from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  const range = sameMonth
    ? `${day(from)}–${day(to)} ${month(to)}`
    : `${day(from)} ${month(from)} – ${day(to)} ${month(to)}`;
  return `${city} ${range}`;
}

/** "Dec 15 – Dec 20, 2026", or "Dec 28, 2026 – Jan 3, 2027" across a new year. */
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
    const fromLabel = from.toLocaleDateString("en-US", {
      ...opts,
      year: from.getFullYear() === to.getFullYear() ? undefined : "numeric",
    });
    const toLabel = to.toLocaleDateString("en-US", { ...opts, year: "numeric" });
    return `${fromLabel} – ${toLabel}`;
  } catch {
    return `${checkIn} → ${checkOut}`;
  }
}
