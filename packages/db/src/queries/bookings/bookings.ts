import type { ListBookingsQuery } from "@pureluxe/shared";
import {
  BOOKING_CANCEL_SOON_DAYS,
  BOOKING_DEPART_SOON_DAYS,
  BOOKING_TICKET_SOON_DAYS,
} from "@pureluxe/shared";

import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { Booking, BookingServiceType, BookingStatus } from "../../schema";
import { escapeIlike } from "../../utils/ilike";
import {
  findClientDisplayNamesByIds,
  findClientIdsByDisplayName,
} from "../clients/clients";

/** Slim directory columns — no embeds (avoids ambiguous FK / schema-cache 503s). */
const DIRECTORY_SELECT = [
  "id",
  "client_id",
  "trip_id",
  "service_type",
  "relationship_owner_id",
  "title",
  "hotel_name",
  "city",
  "start_date",
  "end_date",
  "nights",
  "supplier_ref",
  "status",
  "cancellation_deadline",
  "ticket_time_limit",
  "vip_flag",
].join(", ");

const ACTIVE_BOOKING_STATUSES = ["pending", "on_hold", "confirmed"] as const;
const NEEDS_CONFIRM_STATUSES = ["pending", "on_hold"] as const;

export type BookingDirectoryRow = Pick<
  Booking,
  | "id"
  | "client_id"
  | "trip_id"
  | "service_type"
  | "relationship_owner_id"
  | "title"
  | "hotel_name"
  | "city"
  | "start_date"
  | "end_date"
  | "nights"
  | "supplier_ref"
  | "status"
  | "cancellation_deadline"
  | "ticket_time_limit"
  | "vip_flag"
> & {
  client_name: string | null;
  owner_name: string | null;
};

export type ListBookingsResult = {
  bookings: BookingDirectoryRow[];
  total: number;
  limit: number;
  offset: number;
};

function bookingSearchFilter(q: string): string {
  const pattern = `%${escapeIlike(q)}%`.replaceAll('"', '\\"');
  return [
    `title.ilike."${pattern}"`,
    `hotel_name.ilike."${pattern}"`,
    `supplier_ref.ilike."${pattern}"`,
    `city.ilike."${pattern}"`,
  ].join(",");
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addUtcDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function findTeamMemberNamesByIds(
  memberIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(memberIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase.from("team_members").select("id, name").in("id", uniqueIds),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return new Map(
    ((data as Array<{ id: string; name: string }> | null) ?? []).map((row) => [
      row.id,
      row.name,
    ]),
  );
}

function toBaseRow(
  row: Record<string, unknown>,
): Omit<BookingDirectoryRow, "client_name" | "owner_name"> {
  return {
    id: row.id as string,
    client_id: (row.client_id as string | null) ?? null,
    trip_id: (row.trip_id as string | null) ?? null,
    service_type: row.service_type as BookingServiceType,
    relationship_owner_id: (row.relationship_owner_id as string | null) ?? null,
    title: row.title as string,
    hotel_name: (row.hotel_name as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    start_date: (row.start_date as string | null) ?? null,
    end_date: (row.end_date as string | null) ?? null,
    nights: (row.nights as number | null) ?? null,
    supplier_ref: (row.supplier_ref as string | null) ?? null,
    status: row.status as BookingStatus,
    cancellation_deadline: (row.cancellation_deadline as string | null) ?? null,
    ticket_time_limit: (row.ticket_time_limit as string | null) ?? null,
    vip_flag: Boolean(row.vip_flag),
  };
}

/** Directory list — search, Mine/All, type, work, status, ops filters, paginate. */
export async function listBookings(
  query: ListBookingsQuery & { actorMemberId?: string | null },
): Promise<ListBookingsResult> {
  const supabase = getServiceClient();
  const {
    q,
    scope,
    type,
    work,
    status,
    missing_ref,
    no_trip,
    ticket_deadline_soon,
    owner,
    start_from,
    start_to,
    limit,
    offset,
    actorMemberId,
  } = query;

  const today = todayUtcDate();
  const cancelSoonEnd = addUtcDays(today, BOOKING_CANCEL_SOON_DAYS);
  const departSoonEnd = addUtcDays(today, BOOKING_DEPART_SOON_DAYS);
  const nowIso = new Date().toISOString();
  const ticketSoonEnd = new Date(
    Date.now() + BOOKING_TICKET_SOON_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const matchingClientIds = q ? await findClientIdsByDisplayName(q) : [];

  const { data, error, count } = await runSupabaseQuery(() => {
    let request = supabase
      .from("bookings")
      .select(DIRECTORY_SELECT, { count: "exact" })
      .eq("is_demo", false);

    if (q) {
      const fieldFilter = bookingSearchFilter(q);
      request =
        matchingClientIds.length > 0
          ? request.or(
              `${fieldFilter},client_id.in.(${matchingClientIds.join(",")})`,
            )
          : request.or(fieldFilter);
    }

    if (scope === "mine" && actorMemberId) {
      request = request.eq("relationship_owner_id", actorMemberId);
    }

    if (owner === "unassigned") {
      request = request.is("relationship_owner_id", null);
    } else if (owner === "me" && actorMemberId) {
      request = request.eq("relationship_owner_id", actorMemberId);
    } else if (owner !== "any" && owner !== "me") {
      request = request.eq("relationship_owner_id", owner);
    }

    if (type !== "any") {
      request = request.eq("service_type", type);
    }

    if (status !== "any") {
      request = request.eq("status", status);
    } else if (work === "any" && !missing_ref && !ticket_deadline_soon) {
      request = request.neq("status", "superseded");
    }

    if (work === "needs_confirm") {
      request = request.in("status", [...NEEDS_CONFIRM_STATUSES]);
    } else if (work === "cancel_soon") {
      request = request
        .in("status", [...ACTIVE_BOOKING_STATUSES])
        .gte("cancellation_deadline", today)
        .lte("cancellation_deadline", cancelSoonEnd);
    } else if (work === "depart_soon") {
      request = request
        .in("status", [...ACTIVE_BOOKING_STATUSES])
        .gte("start_date", today)
        .lte("start_date", departSoonEnd);
    } else if (work === "arriving") {
      request = request
        .in("status", [...ACTIVE_BOOKING_STATUSES])
        .eq("start_date", today);
    } else if (work === "in_house") {
      request = request
        .eq("status", "confirmed")
        .lte("start_date", today)
        .gte("end_date", today);
    }

    if (missing_ref) {
      if (status === "any" && work === "any") {
        request = request.in("status", [...ACTIVE_BOOKING_STATUSES]);
      }
      request = request.or('supplier_ref.is.null,supplier_ref.eq.""');
    }

    if (no_trip) {
      request = request.is("trip_id", null);
    }

    if (ticket_deadline_soon) {
      request = request
        .eq("service_type", "flight")
        .in("status", [...ACTIVE_BOOKING_STATUSES])
        .gte("ticket_time_limit", nowIso)
        .lte("ticket_time_limit", ticketSoonEnd);
    }

    if (start_from) {
      request = request.gte("start_date", start_from);
    }

    if (start_to) {
      request = request.lte("start_date", start_to);
    }

    return request
      .order("start_date", { ascending: true })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
  });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[db] listBookings failed", error);
    }
    throw dbQueryError(error);
  }

  const rows = ((data as unknown as Record<string, unknown>[] | null) ?? []).map(
    toBaseRow,
  );

  const [clientNames, ownerNames] = await Promise.all([
    findClientDisplayNamesByIds(
      rows.map((row) => row.client_id).filter((id): id is string => Boolean(id)),
    ),
    findTeamMemberNamesByIds(
      rows
        .map((row) => row.relationship_owner_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]);

  return {
    bookings: rows.map((row) => ({
      ...row,
      client_name: row.client_id
        ? (clientNames.get(row.client_id) ?? null)
        : null,
      owner_name: row.relationship_owner_id
        ? (ownerNames.get(row.relationship_owner_id) ?? null)
        : null,
    })),
    total: count ?? 0,
    limit,
    offset,
  };
}
