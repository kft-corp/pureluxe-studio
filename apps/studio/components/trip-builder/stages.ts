import type { TripDetail, TripStaySnapshot } from "@/lib/trip-builder";

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

/** Nights overlap. A checkout that is the next check-in does not. */
export function findOverlappingStay(
  stays: TripStaySnapshot[],
  checkIn: string,
  checkOut: string,
  ignoreLegId?: string | null,
): TripStaySnapshot | null {
  return (
    stays.find(
      (stay) =>
        stay.leg_id !== ignoreLegId &&
        stay.check_in &&
        stay.check_out &&
        checkIn < stay.check_out &&
        checkOut > stay.check_in,
    ) ?? null
  );
}

export function staysOutsideWindow(
  stays: TripStaySnapshot[],
  start: string,
  end: string,
): TripStaySnapshot[] {
  return stays.filter(
    (stay) =>
      stay.check_in &&
      stay.check_out &&
      (stay.check_in < start || stay.check_out > end || stay.check_out <= stay.check_in),
  );
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

function ratesComplete(detail: TripDetail): boolean {
  const stays = tripStays(detail).filter(stayIsComplete);
  if (stays.length === 0) return false;
  return stays.every((stay) =>
    detail.rates.candidates.some(
      (rate) => rate.selected && rate.leg_id === stay.leg_id,
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

/** Derive the current Phase 1 stage from trip detail. */
export function resolveTripStage(detail: TripDetail | null): TripStage {
  if (!detail?.client) return "client";
  if (!travellersConfirmed(detail)) return "client";
  if (!tripDatesReady(detail) || !legsConfirmed(detail)) return "stay";
  if (!staysComplete(detail)) return "stay";
  if (!ratesComplete(detail)) return "rates";
  return "package";
}

export function tripDatesReady(detail: TripDetail | null): boolean {
  return Boolean(detail?.trip.starts_on && detail.trip.ends_on);
}

export function legsConfirmed(detail: TripDetail | null): boolean {
  return Boolean(detail?.trip.legs_confirmed_at);
}

/** Human next-step copy for the summary. */
export function resolveNextStep(detail: TripDetail | null): string {
  if (!detail) return "Start a trip";
  if (!detail.client) return "Select a client";
  if (!travellersConfirmed(detail)) return "Name the travellers";
  if (!tripDatesReady(detail)) return "Set the trip dates";
  if (!legsConfirmed(detail)) return "List each stay";
  if (!staysComplete(detail)) return "Set hotel & party";
  if (!ratesComplete(detail)) return "Select a rate";
  return "Review bookings";
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
