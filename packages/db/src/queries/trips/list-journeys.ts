import type { ListJourneysQuery } from "@pureluxe/shared";
import {
  classifyJourney,
  JOURNEY_WORK_STAGES,
  journeyToday,
  type JourneyPhase,
  type JourneyTravelStage,
  type JourneyWorkStage,
} from "@pureluxe/shared";

import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { TripClientVisibility, TripStatus } from "../../schema";
import { escapeIlike } from "../../utils/ilike";
import { findTeamMemberNamesByIds } from "../bookings/bookings";
import { findClientIdsByDisplayName } from "../clients/clients";

const TRIP_COLUMNS = [
  "id",
  "primary_client_id",
  "relationship_owner_id",
  "title",
  "starts_on",
  "ends_on",
  "status",
  "client_visibility",
  "sell_total",
  "sell_currency",
  "margin_internal",
  "amount_received",
  "payment_status",
  "pricing_locked_at",
  "updated_at",
].join(", ");

type TripListRow = {
  id: string;
  primary_client_id: string | null;
  relationship_owner_id: string | null;
  title: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: TripStatus;
  client_visibility: TripClientVisibility;
  sell_total: number | string | null;
  sell_currency: string | null;
  margin_internal: number | string | null;
  amount_received: number | string | null;
  payment_status: string | null;
  pricing_locked_at: string | null;
  updated_at: string;
};

type LegRow = {
  trip_id: string;
  destination: string;
  check_in: string | null;
  check_out: string | null;
  sequence_order: number;
};

type ClientRow = {
  id: string;
  display_name: string;
  tier_id: string | null;
};

type TierRow = {
  id: string;
  slug: string;
  label: string;
};

const VIP_SLUGS = ["vip", "vvip"];
const WORK_STAGES = new Set<string>(JOURNEY_WORK_STAGES);

/** One row on the trip board. Enough for a card; not the full journey. */
export type JourneyCard = {
  id: string;
  title: string | null;
  status: TripStatus;
  visibility: TripClientVisibility;
  phase: JourneyPhase;
  work: JourneyWorkStage | null;
  travel: JourneyTravelStage | null;
  client: {
    id: string;
    display_name: string;
    tier_slug: string;
    tier_label: string;
    vip: boolean;
  } | null;
  /** People on the trip, including the lead. */
  traveller_count: number;
  owner: {
    id: string;
    name: string;
  } | null;
  /** First day and last day. Trip dates, or the stay span when those are empty. */
  starts_on: string | null;
  ends_on: string | null;
  /** Cities in stay order. A repeat is kept only when the guest leaves and comes back. */
  destinations: string[];
  sell_total: number | null;
  sell_currency: string | null;
  /** Client price minus team cost, in the sell currency. Null until priced. */
  margin_internal: number | null;
  amount_received: number | null;
  payment_status: string;
  pricing_locked: boolean;
  /** A proposal PDF exists and is out of date. */
  proposal_stale: boolean;
  updated_at: string;
};

export type ListJourneysResult = {
  journeys: JourneyCard[];
  total: number;
  limit: number;
  offset: number;
};

export type ListJourneysInput = ListJourneysQuery & {
  actorMemberId?: string | null;
  /** Only trips where this client is the lead or a traveller. */
  clientId?: string | null;
  /** Override the calendar day. Tests and previews pass this; the board uses today. */
  today?: string;
};

function money(value: number | string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ilikeOr(
  q: string,
  clientIds: string[],
  tripIds: string[],
): string {
  const pattern = `%${escapeIlike(q)}%`.replaceAll('"', '\\"');
  const parts = [`title.ilike."${pattern}"`];
  if (clientIds.length > 0) {
    parts.push(`primary_client_id.in.(${clientIds.join(",")})`);
  }
  if (tripIds.length > 0) {
    parts.push(`id.in.(${tripIds.join(",")})`);
  }
  return parts.join(",");
}

/** Trip ids whose client quote PDF (options) is out of date. */
async function findStaleTripIds(): Promise<string[]> {
  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_documents")
      .select("trip_id")
      .eq("type", "options")
      .eq("status", "stale"),
  );
  if (error) throw dbQueryError(error);
  return [
    ...new Set(
      ((data as Array<{ trip_id: string }> | null) ?? []).map((row) => row.trip_id),
    ),
  ];
}

/** Lead clients on the VIP or VVIP tier. */
async function findVipClientIds(): Promise<string[]> {
  const supabase = getServiceClient();
  const tiersResult = await runSupabaseQuery(() =>
    supabase.from("client_tiers").select("id").in("slug", VIP_SLUGS),
  );
  if (tiersResult.error) throw dbQueryError(tiersResult.error);
  const tierIds = ((tiersResult.data as Array<{ id: string }> | null) ?? []).map(
    (row) => row.id,
  );
  if (tierIds.length === 0) return [];

  const clientsResult = await runSupabaseQuery(() =>
    supabase.from("clients").select("id").in("tier_id", tierIds),
  );
  if (clientsResult.error) throw dbQueryError(clientsResult.error);
  return ((clientsResult.data as Array<{ id: string }> | null) ?? []).map((row) => row.id);
}

/** Trip ids whose stay city matches the search. */
async function findTripIdsByDestination(q: string): Promise<string[]> {
  const pattern = `%${escapeIlike(q.trim())}%`;
  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_legs")
      .select("trip_id")
      .ilike("destination", pattern)
      .limit(200),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return [
    ...new Set(
      ((data as Array<{ trip_id: string }> | null) ?? []).map((row) => row.trip_id),
    ),
  ];
}

/** Trip ids where this client is the lead or a traveller. */
async function findTripIdsForClient(clientId: string): Promise<string[]> {
  const supabase = getServiceClient();
  const [leadResult, travellerResult] = await Promise.all([
    runSupabaseQuery(() =>
      supabase.from("trips").select("id").eq("primary_client_id", clientId).limit(500),
    ),
    runSupabaseQuery(() =>
      supabase.from("trip_clients").select("trip_id").eq("client_id", clientId).limit(500),
    ),
  ]);
  if (leadResult.error) throw dbQueryError(leadResult.error);
  if (travellerResult.error) throw dbQueryError(travellerResult.error);
  return [
    ...new Set([
      ...((leadResult.data as Array<{ id: string }> | null) ?? []).map((row) => row.id),
      ...((travellerResult.data as Array<{ trip_id: string }> | null) ?? []).map(
        (row) => row.trip_id,
      ),
    ]),
  ];
}

function earliest(values: Array<string | null>): string | null {
  const dates = values.filter((value): value is string => Boolean(value)).sort();
  return dates[0] ?? null;
}

function latest(values: Array<string | null>): string | null {
  const dates = values.filter((value): value is string => Boolean(value)).sort();
  return dates[dates.length - 1] ?? null;
}

/** Cities in order. "Male, Male, Dubai" becomes Male, then Dubai. */
function routeFromLegs(legs: LegRow[]): string[] {
  const route: string[] = [];
  for (const leg of legs) {
    const city = leg.destination.trim();
    if (!city) continue;
    const previous = route[route.length - 1];
    if (previous?.toLowerCase() === city.toLowerCase()) continue;
    route.push(city);
  }
  return route;
}

function emptyResult(input: ListJourneysInput): ListJourneysResult {
  return {
    journeys: [],
    total: 0,
    limit: input.limit,
    offset: input.offset,
  };
}

/**
 * Portfolio for the Trips board.
 * Mine is the signed-in owner. Search matches the title, the lead client, or a stay city.
 * Travel filters use the trip start and end. A card with no trip dates falls back to its stays.
 */
export async function listJourneys(
  input: ListJourneysInput,
): Promise<ListJourneysResult> {
  if (input.scope === "mine" && !input.actorMemberId) {
    return emptyResult(input);
  }

  const today = input.today ?? journeyToday();
  const q = input.q.trim();
  const needsClientTier = input.client_tier === "vip" || input.client_tier === "standard";
  const needsQuote = input.quote === "stale" || input.quote === "current";
  const [clientIds, destinationTripIds, vipClientIds, staleTripIds, clientTripIds] =
    await Promise.all([
      q ? findClientIdsByDisplayName(q) : Promise.resolve([]),
      q ? findTripIdsByDestination(q) : Promise.resolve([]),
      needsClientTier ? findVipClientIds() : Promise.resolve([]),
      needsQuote ? findStaleTripIds() : Promise.resolve([]),
      input.clientId ? findTripIdsForClient(input.clientId) : Promise.resolve([]),
    ]);

  if (input.clientId && clientTripIds.length === 0) {
    return emptyResult(input);
  }
  if (input.client_tier === "vip" && vipClientIds.length === 0) {
    return emptyResult(input);
  }
  if (input.quote === "stale" && staleTripIds.length === 0) {
    return emptyResult(input);
  }
  if (input.owner === "me" && !input.actorMemberId) {
    return emptyResult(input);
  }

  const supabase = getServiceClient();
  const { data, error, count } = await runSupabaseQuery(() => {
    let request = supabase
      .from("trips")
      .select(TRIP_COLUMNS, { count: "exact" })
      .eq("is_demo", false)
      .is("archived_at", null);

    if (input.scope === "mine" && input.actorMemberId) {
      request = request.eq("relationship_owner_id", input.actorMemberId);
    }

    if (q) {
      request = request.or(ilikeOr(q, clientIds, destinationTripIds));
    }

    if (input.clientId) {
      request = request.in("id", clientTripIds);
    }

    if (input.stage === "working") {
      request = request.in("status", [...JOURNEY_WORK_STAGES]);
    } else if (WORK_STAGES.has(input.stage) || input.stage === "cancelled") {
      request = request.eq("status", input.stage);
    } else if (input.stage === "upcoming") {
      request = request
        .neq("status", "cancelled")
        .neq("status", "completed")
        .gt("starts_on", today);
    } else if (input.stage === "on_trip") {
      request = request
        .neq("status", "cancelled")
        .lte("starts_on", today)
        .gte("ends_on", today);
    } else if (input.stage === "past") {
      request = request.neq("status", "cancelled").or(
        `ends_on.lt.${today},and(status.eq.completed,or(starts_on.is.null,starts_on.gt.${today},ends_on.is.null,ends_on.lt.${today}))`,
      );
    } else {
      request = request.neq("status", "cancelled");
    }

    if (input.client_tier === "vip") {
      request = request.in("primary_client_id", vipClientIds);
    } else if (input.client_tier === "standard") {
      request = request.not("primary_client_id", "is", null);
      if (vipClientIds.length > 0) {
        request = request.not("primary_client_id", "in", `(${vipClientIds.join(",")})`);
      }
    }
    if (input.price === "locked") {
      request = request.not("pricing_locked_at", "is", null);
    } else if (input.price === "open") {
      request = request.is("pricing_locked_at", null);
    }
    if (input.payment && input.payment !== "any") {
      request = request.eq("payment_status", input.payment);
    }
    if (input.quote === "stale") {
      request = request.in("id", staleTripIds);
    } else if (input.quote === "current" && staleTripIds.length > 0) {
      request = request.not("id", "in", `(${staleTripIds.join(",")})`);
    }
    if (input.owner === "me" && input.actorMemberId) {
      request = request.eq("relationship_owner_id", input.actorMemberId);
    } else if (input.owner === "unassigned") {
      request = request.is("relationship_owner_id", null);
    } else if (input.owner !== "any") {
      request = request.eq("relationship_owner_id", input.owner);
    }
    if (input.starts_from) {
      request = request.gte("starts_on", input.starts_from);
    }
    if (input.starts_to) {
      request = request.lte("starts_on", input.starts_to);
    }

    if (input.stage === "upcoming" || input.stage === "on_trip") {
      request = request.order("starts_on", { ascending: true, nullsFirst: false });
    } else if (input.stage === "past") {
      request = request.order("ends_on", { ascending: false, nullsFirst: false });
    } else {
      request = request.order("updated_at", { ascending: false });
    }

    return request.range(input.offset, input.offset + input.limit - 1);
  });

  if (error) {
    throw dbQueryError(error);
  }

  const trips = (data as TripListRow[] | null) ?? [];
  if (trips.length === 0) {
    return {
      journeys: [],
      total: count ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  const facts = await loadCardFacts(trips);

  return {
    journeys: trips.map((trip) => toCard(trip, facts, today)),
    total: count ?? 0,
    limit: input.limit,
    offset: input.offset,
  };
}

type CardFacts = {
  legs: Map<string, LegRow[]>;
  travellerCounts: Map<string, number>;
  staleTripIds: Set<string>;
  clients: Map<string, ClientRow>;
  tiers: Map<string, TierRow>;
  owners: Map<string, string>;
};

async function loadCardFacts(trips: TripListRow[]): Promise<CardFacts> {
  const tripIds = trips.map((trip) => trip.id);
  const supabase = getServiceClient();

  const [legsResult, travellersResult, documentsResult] = await Promise.all([
    runSupabaseQuery(() =>
      supabase
        .from("trip_legs")
        .select("trip_id, destination, check_in, check_out, sequence_order")
        .in("trip_id", tripIds)
        .order("sequence_order", { ascending: true }),
    ),
    runSupabaseQuery(() =>
      supabase.from("trip_clients").select("trip_id").in("trip_id", tripIds),
    ),
    runSupabaseQuery(() =>
      supabase
        .from("trip_documents")
        .select("trip_id")
        .in("trip_id", tripIds)
        .eq("type", "options")
        .eq("status", "stale"),
    ),
  ]);

  if (legsResult.error) throw dbQueryError(legsResult.error);
  if (travellersResult.error) throw dbQueryError(travellersResult.error);
  if (documentsResult.error) throw dbQueryError(documentsResult.error);

  const legs = new Map<string, LegRow[]>();
  for (const leg of (legsResult.data as LegRow[] | null) ?? []) {
    const list = legs.get(leg.trip_id) ?? [];
    list.push(leg);
    legs.set(leg.trip_id, list);
  }

  const travellerCounts = new Map<string, number>();
  for (const row of (travellersResult.data as Array<{ trip_id: string }> | null) ?? []) {
    travellerCounts.set(row.trip_id, (travellerCounts.get(row.trip_id) ?? 0) + 1);
  }

  const staleTripIds = new Set(
    ((documentsResult.data as Array<{ trip_id: string }> | null) ?? []).map(
      (row) => row.trip_id,
    ),
  );

  const clientIds = [
    ...new Set(
      trips
        .map((trip) => trip.primary_client_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const ownerIds = trips
    .map((trip) => trip.relationship_owner_id)
    .filter((id): id is string => Boolean(id));

  const [clients, owners] = await Promise.all([
    loadClients(clientIds),
    findTeamMemberNamesByIds(ownerIds),
  ]);

  return {
    legs,
    travellerCounts,
    staleTripIds,
    clients: clients.clients,
    tiers: clients.tiers,
    owners,
  };
}

async function loadClients(clientIds: string[]): Promise<{
  clients: Map<string, ClientRow>;
  tiers: Map<string, TierRow>;
}> {
  if (clientIds.length === 0) {
    return { clients: new Map(), tiers: new Map() };
  }

  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase.from("clients").select("id, display_name, tier_id").in("id", clientIds),
  );

  if (error) {
    throw dbQueryError(error);
  }

  const clients = new Map<string, ClientRow>();
  for (const row of (data as ClientRow[] | null) ?? []) {
    clients.set(row.id, row);
  }

  const tierIds = [
    ...new Set(
      [...clients.values()]
        .map((client) => client.tier_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (tierIds.length === 0) {
    return { clients, tiers: new Map() };
  }

  const tiersResult = await runSupabaseQuery(() =>
    supabase.from("client_tiers").select("id, slug, label").in("id", tierIds),
  );

  if (tiersResult.error) {
    throw dbQueryError(tiersResult.error);
  }

  const tiers = new Map<string, TierRow>();
  for (const tier of (tiersResult.data as TierRow[] | null) ?? []) {
    tiers.set(tier.id, tier);
  }

  return { clients, tiers };
}

function toCard(trip: TripListRow, facts: CardFacts, today: string): JourneyCard {
  const legs = facts.legs.get(trip.id) ?? [];
  const hasTripWindow = Boolean(trip.starts_on && trip.ends_on);
  const startsOn = hasTripWindow
    ? trip.starts_on
    : (earliest(legs.map((leg) => leg.check_in)) ?? trip.starts_on);
  const endsOn = hasTripWindow
    ? trip.ends_on
    : (latest(legs.map((leg) => leg.check_out)) ?? trip.ends_on);
  const stage = classifyJourney({
    status: trip.status,
    startsOn,
    endsOn,
    today,
  });

  const clientRow = trip.primary_client_id
    ? facts.clients.get(trip.primary_client_id)
    : undefined;
  const tier = clientRow?.tier_id ? facts.tiers.get(clientRow.tier_id) : undefined;
  const ownerName = trip.relationship_owner_id
    ? facts.owners.get(trip.relationship_owner_id)
    : undefined;

  const linkedTravellers = facts.travellerCounts.get(trip.id) ?? 0;

  return {
    id: trip.id,
    title: trip.title,
    status: trip.status,
    visibility: trip.client_visibility,
    phase: stage.phase,
    work: stage.work,
    travel: stage.travel,
    client: clientRow
      ? {
          id: clientRow.id,
          display_name: clientRow.display_name,
          tier_slug: tier?.slug ?? "standard",
          tier_label: tier?.label ?? "Standard",
          vip: VIP_SLUGS.includes(tier?.slug ?? ""),
        }
      : null,
    traveller_count: Math.max(linkedTravellers, clientRow ? 1 : 0),
    owner:
      trip.relationship_owner_id && ownerName
        ? { id: trip.relationship_owner_id, name: ownerName }
        : null,
    starts_on: startsOn,
    ends_on: endsOn,
    destinations: routeFromLegs(legs),
    sell_total: money(trip.sell_total),
    sell_currency: trip.sell_currency,
    margin_internal: money(trip.margin_internal),
    amount_received: money(trip.amount_received),
    payment_status: trip.payment_status?.trim() || "not_started",
    pricing_locked: Boolean(trip.pricing_locked_at),
    proposal_stale: facts.staleTripIds.has(trip.id),
    updated_at: trip.updated_at,
  };
}
