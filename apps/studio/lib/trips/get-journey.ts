import {
  findClientById,
  findClientTierById,
  findTeamMemberNamesByIds,
  findTripById,
  listJourneyPieces,
  listTripDocuments,
  listTripLegs,
  listTripTravellers,
  type JourneyBookingRow,
  type JourneyLineItemRow,
  type Trip,
  type TripDocument,
  type TripLeg,
} from "@pureluxe/db";
import {
  AppError,
  classifyJourney,
  journeyToday,
  tripMessages,
  type JourneyPhase,
  type JourneyWorkStage,
} from "@pureluxe/shared";

import { formatBookingDate, formatBookingMoney } from "@/lib/bookings";

import {
  formatJourneyParty,
  formatJourneyPhase,
  formatJourneyRoute,
  formatTripStatus,
  journeyStage,
} from "./journey-format";
import { journeyNextStep, statusNextStep } from "./journey-next-step";

export type JourneyStopKind = "flight" | "stay" | "transfer" | "gap";

export type JourneyStopStatus =
  | "Confirmed"
  | "Pending"
  | "Not booked"
  | "Cancelled";

export type JourneyStop = {
  id: string;
  kind: JourneyStopKind;
  title: string;
  detail: string | null;
  status: JourneyStopStatus | null;
  /** Linked inventory row, when this stop has been booked. */
  bookingId: string | null;
  /** Filled mark when the stop has a name and dates. */
  complete: boolean;
};

export type JourneyPageModel = {
  id: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  tierSlug: string;
  ownerName: string | null;
  routeLabel: string | null;
  partyLabel: string;
  datesLabel: string | null;
  nightsLabel: string | null;
  phase: JourneyPhase;
  work: JourneyWorkStage | null;
  phaseLabel: string;
  status: Trip["status"];
  statusLabel: string;
  /** Same label as the list pill. */
  stageLabel: string;
  /** Where the trip sits in time, e.g. "Starts in 12 days". */
  travelLabel: string;
  quoteReady: boolean;
  quoteFile: boolean;
  visibilityLabel: string;
  nextStep: string;
  travellers: Array<{ id: string; name: string; roleLabel: string }>;
  documents: Array<{
    id: string;
    type: TripDocument["type"];
    label: string;
    statusLabel: string;
    stale: boolean;
  }>;
  stops: JourneyStop[];
  sellLabel: string;
  costLabel: string | null;
  marginLabel: string | null;
  priceHint: string;
};

const DOCUMENT_LABELS: Record<TripDocument["type"], string> = {
  itinerary: "Itinerary",
  rates: "Rates",
  options: "Quote",
};

const DOCUMENT_STATUS: Record<TripDocument["status"], string> = {
  ready: "Ready",
  stale: "Out of date",
  generating: "Generating",
};

const VISIBILITY_LABELS = {
  draft: "Draft",
  ready: "Ready to share",
  shared: "Shared with guest",
} as const;

/** Read-only journey for /trips/[id]. Does not change the plan. */
export async function getJourney(tripId: string): Promise<JourneyPageModel> {
  const trip = await findTripById(tripId);
  if (!trip || trip.is_demo || trip.archived_at) {
    throw new AppError({
      userMessage: tripMessages.error.notFound,
      code: "trips.not_found",
      status: 404,
    });
  }

  const [legs, travellers, documents, pieces, client] = await Promise.all([
    listTripLegs(tripId),
    listTripTravellers(tripId),
    listTripDocuments(tripId),
    listJourneyPieces(tripId),
    trip.primary_client_id ? findClientById(trip.primary_client_id) : Promise.resolve(null),
  ]);

  const [owners, tier] = await Promise.all([
    trip.relationship_owner_id
      ? findTeamMemberNamesByIds([trip.relationship_owner_id])
      : Promise.resolve(new Map<string, string>()),
    client?.tier_id ? findClientTierById(client.tier_id) : Promise.resolve(null),
  ]);

  const startsOn = trip.starts_on ?? earliest(legs.map((leg) => leg.check_in));
  const endsOn = trip.ends_on ?? latest(legs.map((leg) => leg.check_out));
  const stage = classifyJourney({
    status: trip.status,
    startsOn,
    endsOn,
    today: journeyToday(),
  });
  const places = routePlaces(legs);
  const lead = travellers.find((person) => person.role === "primary");
  const clientName = client?.display_name ?? lead?.display_name ?? null;
  const pricingLocked = Boolean(trip.pricing_locked_at);
  const quote = documents.find((document) => document.type === "options") ?? null;
  const proposalStale = quote?.status === "stale";
  const quoteReady = quote?.status === "ready" && Boolean(quote.file_path);
  const planDone = trip.status !== "building" || quoteReady || proposalStale;
  const travelPhase =
    stage.phase === "cancelled" || stage.phase === "on_trip" || stage.phase === "past";
  const nextStep =
    travelPhase || !planDone
      ? journeyNextStep({
          status: trip.status,
          client: trip.primary_client_id && clientName,
          phase: stage.phase,
          starts_on: startsOn,
          ends_on: endsOn,
          destinations: places,
          proposal_stale: proposalStale,
        })
      : statusNextStep({
          status: trip.status,
          quoteReady,
          quoteStale: proposalStale,
          roomsChosen:
            legs.length > 0 &&
            legs.every((leg) =>
              pieces.lineItems.some(
                (item) =>
                  item.category === "accommodation" &&
                  item.selected &&
                  item.leg_id === leg.id &&
                  !isStayShell(item),
              ),
            ),
        });

  return {
    id: trip.id,
    title: trip.title?.trim() || clientName || "Untitled trip",
    clientId: trip.primary_client_id,
    clientName,
    tierSlug: tier?.slug ?? "standard",
    ownerName: trip.relationship_owner_id
      ? (owners.get(trip.relationship_owner_id) ?? null)
      : null,
    routeLabel: formatJourneyRoute(places),
    partyLabel: formatJourneyParty(travellers.length) ?? "No travellers",
    datesLabel: dateSpan(startsOn, endsOn),
    nightsLabel: nightsLabel(startsOn, endsOn),
    phase: stage.phase,
    work: stage.work,
    phaseLabel: formatJourneyPhase(stage),
    status: trip.status,
    statusLabel: formatTripStatus(trip.status),
    quoteReady,
    quoteFile: Boolean(quote?.file_path) && quote?.status !== "generating",
    visibilityLabel: VISIBILITY_LABELS[trip.client_visibility],
    stageLabel: journeyStage({ phase: stage.phase, status: trip.status }).label,
    travelLabel: travelLabel(stage.phase, startsOn, endsOn),
    nextStep,
    travellers: travellers.map((person) => ({
      id: person.client_id,
      name: person.display_name || "Unnamed traveller",
      roleLabel: person.role === "primary" ? "Lead" : person.party_role === "child" ? "Child" : "Adult",
    })),
    documents: documents
      .filter((document) => document.type === "options")
      .map((document) => ({
        id: document.id,
        type: document.type,
        label: DOCUMENT_LABELS[document.type],
        statusLabel: DOCUMENT_STATUS[document.status],
        stale: document.status === "stale",
      })),
    stops: buildStops(trip, legs, pieces.lineItems, pieces.bookings),
    sellLabel: moneyLabel(trip.sell_total, trip.sell_currency) ?? "Not set",
    costLabel: moneyLabel(trip.cost_total_internal, trip.sell_currency),
    marginLabel: moneyLabel(trip.margin_internal, trip.sell_currency),
    priceHint: pricingLocked ? "Price locked" : "Team sell price",
  };
}

type PlannedStop = JourneyStop & {
  sortDate: string;
  sortRank: number;
  endDate: string | null;
  place: string | null;
};

function buildStops(
  trip: Trip,
  legs: TripLeg[],
  lineItems: JourneyLineItemRow[],
  bookings: JourneyBookingRow[],
): JourneyStop[] {
  const usedBookingIds = new Set<string>();
  const stays = [...legs].sort(byLegOrder).map((leg) => stayStop(leg, lineItems, bookings, usedBookingIds));
  const moves = lineItems
    .filter((item) => item.category === "flight" || item.category === "transfer")
    .filter((item) => item.selected && item.status !== "rejected")
    .map((item) => moveStop(item, legs, bookings, usedBookingIds, trip.starts_on));

  const ordered = [...stays, ...moves].sort(byStop);
  return insertGaps(ordered);
}

function stayStop(
  leg: TripLeg,
  lineItems: JourneyLineItemRow[],
  bookings: JourneyBookingRow[],
  usedBookingIds: Set<string>,
): PlannedStop {
  const rooms = lineItems.filter(
    (item) =>
      item.leg_id === leg.id &&
      item.category === "accommodation" &&
      item.status !== "rejected",
  );
  const chosen =
    rooms.find((item) => item.selected && !isStayShell(item)) ??
    rooms.find((item) => item.selected) ??
    rooms.find((item) => isStayShell(item)) ??
    null;
  const hotel = chosen?.property_name?.trim() || chosen?.title?.trim() || "";
  const booking = takeBooking(bookings, usedBookingIds, {
    lineItemId: chosen?.id,
    legId: leg.id,
    serviceType: "hotel",
  });
  const place = leg.destination.trim() || null;
  const dates = dateSpan(leg.check_in, leg.check_out);
  const city = place ?? "Stay";

  return {
    id: `stay-${leg.id}`,
    kind: "stay",
    title: hotel || "Hotel not set",
    detail: dates ? `${city} · ${dates}` : city,
    status: stopStatus(booking?.status ?? null),
    bookingId: booking?.id ?? null,
    complete: Boolean(hotel && leg.check_in && leg.check_out),
    sortDate: leg.check_in ?? "9999-99-99",
    sortRank: 2,
    endDate: leg.check_out,
    place,
  };
}

function moveStop(
  item: JourneyLineItemRow,
  legs: TripLeg[],
  bookings: JourneyBookingRow[],
  usedBookingIds: Set<string>,
  tripStart: string | null,
): PlannedStop {
  const leg = legs.find((row) => row.id === item.leg_id) ?? null;
  const booking = takeBooking(bookings, usedBookingIds, {
    lineItemId: item.id,
    legId: item.leg_id,
    serviceType: item.category === "flight" ? "flight" : "transfer",
  });
  const sortDate = booking?.start_date ?? leg?.check_in ?? tripStart ?? "9999-99-99";
  const title = item.title.trim() || (item.category === "flight" ? "Flight" : "Transfer");

  return {
    id: `${item.category}-${item.id}`,
    kind: item.category === "flight" ? "flight" : "transfer",
    title,
    detail: item.subtitle?.trim() || leg?.destination.trim() || null,
    status: stopStatus(booking?.status ?? null),
    bookingId: booking?.id ?? null,
    complete: Boolean(item.title.trim()),
    sortDate,
    sortRank: item.category === "flight" ? 0 : 1,
    endDate: null,
    place: leg?.destination.trim() || null,
  };
}

function takeBooking(
  bookings: JourneyBookingRow[],
  usedBookingIds: Set<string>,
  match: {
    lineItemId?: string | null;
    legId?: string | null;
    serviceType: JourneyBookingRow["service_type"];
  },
): JourneyBookingRow | null {
  const open = bookings.filter((booking) => !usedBookingIds.has(booking.id));
  const found =
    open.find((booking) => match.lineItemId && booking.trip_line_item_id === match.lineItemId) ??
    open.find(
      (booking) =>
        booking.service_type === match.serviceType &&
        match.legId != null &&
        booking.trip_leg_id === match.legId,
    ) ??
    null;
  if (found) usedBookingIds.add(found.id);
  return found;
}

function insertGaps(stops: PlannedStop[]): JourneyStop[] {
  const stays = stops.filter((stop) => stop.kind === "stay").sort(byStop);
  const gaps: PlannedStop[] = [];
  for (let index = 1; index < stays.length; index += 1) {
    const gap = gapBetween(stays[index - 1]!, stays[index]!);
    if (gap) gaps.push(gap);
  }

  return [...stops, ...gaps].sort(byStop).map((stop) => ({
    id: stop.id,
    kind: stop.kind,
    title: stop.title,
    detail: stop.detail,
    status: stop.status,
    bookingId: stop.bookingId,
    complete: stop.complete,
  }));
}

function gapBetween(previous: PlannedStop, next: PlannedStop): PlannedStop | null {
  const from = previous.endDate;
  const to = next.sortDate;
  if (!from || to === "9999-99-99" || to <= from) return null;
  const nights = daySpan(from, to);
  if (nights <= 0) return null;
  const label = nights === 1 ? "1 night" : `${nights} nights`;
  const fromPlace = previous.place;
  const toPlace = next.place;
  const between =
    fromPlace && toPlace ? ` between ${fromPlace} and ${toPlace}` : " between stays";
  return {
    id: `gap-${previous.id}-${next.id}`,
    kind: "gap",
    title: `${label}${between}`,
    detail: null,
    status: null,
    bookingId: null,
    complete: false,
    sortDate: from,
    sortRank: 3,
    endDate: null,
    place: null,
  };
}

function byLegOrder(a: TripLeg, b: TripLeg): number {
  const aIn = a.check_in ?? "9999-99-99";
  const bIn = b.check_in ?? "9999-99-99";
  if (aIn !== bIn) return aIn < bIn ? -1 : 1;
  return a.sequence_order - b.sequence_order;
}

function byStop(
  a: { sortDate: string; sortRank: number },
  b: { sortDate: string; sortRank: number },
): number {
  if (a.sortDate !== b.sortDate) return a.sortDate < b.sortDate ? -1 : 1;
  return a.sortRank - b.sortRank;
}

function stopStatus(status: JourneyBookingRow["status"] | null): JourneyStopStatus {
  if (status === "confirmed" || status === "completed") return "Confirmed";
  if (status === "pending" || status === "on_hold") return "Pending";
  if (status === "cancelled") return "Cancelled";
  return "Not booked";
}

function isStayShell(row: JourneyLineItemRow): boolean {
  return row.extracted_json?.stay_shell === true;
}

function nightsLabel(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const nights = daySpan(start, end);
  if (nights <= 0) return null;
  return nights === 1 ? "1 night" : `${nights} nights`;
}

function travelLabel(
  phase: JourneyPhase,
  start: string | null,
  end: string | null,
): string {
  if (phase === "cancelled") return "Trip cancelled";
  if (!start || !end) return "Dates not set";
  const today = journeyToday();
  if (today > end) return "Trip finished";
  if (today >= start) return "Guest is travelling";
  const days = daySpan(today, start);
  return days === 1 ? "Starts tomorrow" : `Starts in ${days} days`;
}

function routePlaces(legs: TripLeg[]): string[] {
  const places: string[] = [];
  for (const leg of [...legs].sort(byLegOrder)) {
    const place = leg.destination.trim();
    if (!place || places[places.length - 1] === place) continue;
    places.push(place);
  }
  return places;
}

function dateSpan(start: string | null, end: string | null): string | null {
  if (start && end) return `${formatBookingDate(start)} – ${formatBookingDate(end)}`;
  if (start || end) return formatBookingDate(start ?? end);
  return null;
}

function moneyLabel(amount: number | null, currency: string | null): string | null {
  const value = asNumber(amount);
  if (value == null) return null;
  return formatBookingMoney(value, currency);
}

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function earliest(values: Array<string | null>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort()[0] ?? null;
}

function latest(values: Array<string | null>): string | null {
  const dates = values.filter((value): value is string => Boolean(value)).sort();
  return dates[dates.length - 1] ?? null;
}

function daySpan(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}
