"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuCalendarDays, LuChevronRight } from "react-icons/lu";

import { SkeletonRegion, TableSkeleton } from "@/components/feedback";
import { studioButtonClass } from "@/components/ui";
import {
  MobileCard,
  ResponsiveTable,
  TableCell,
  TableRow,
} from "@/components/ui/responsive-table";
import type { BookingDirectoryItem } from "@/lib/api/bookings";
import {
  bookingDurationLabel,
  formatBookingDate,
  formatBookingServiceType,
  formatTripLinked,
  resolveBookingDeadline,
} from "@/lib/bookings";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

import { BookingStatusPill, BookingVipBadge } from "./booking-status-pill";

const COLUMNS = ["Client", "Service", "Start", "Status", "Ref", "Deadline", "Owner", ""];
const MIN_WIDTH = "min-w-[52rem]";

export function BookingsTableSkeleton() {
  return (
    <TableSkeleton
      columns={COLUMNS}
      lead="text"
      breakpoint="lg"
      minWidthClassName={MIN_WIDTH}
    />
  );
}

type BookingsTableProps = {
  bookings: BookingDirectoryItem[];
  loading: boolean;
  hasActiveFilters?: boolean;
  searchQuery?: string;
  canWrite?: boolean;
  onShowAll?: () => void;
};

function BookingDeadlineCell({
  cancellationDeadline,
  ticketTimeLimit,
}: {
  cancellationDeadline: string | null;
  ticketTimeLimit: string | null;
}) {
  const deadline = resolveBookingDeadline(
    cancellationDeadline,
    ticketTimeLimit,
  );

  if (!deadline.kind) {
    return <span className="text-[15px] text-ink-muted">—</span>;
  }

  return (
    <div className="whitespace-nowrap">
      <p className="text-[15px] text-ink">{deadline.label}</p>
      <p className="text-[13px] text-ink-muted">
        {deadline.kind === "ticket" ? "Ticket" : "Cancel"}
      </p>
    </div>
  );
}

function durationLabel(booking: BookingDirectoryItem): string | null {
  return bookingDurationLabel({
    startDate: booking.start_date,
    endDate: booking.end_date,
    nights: booking.nights,
    serviceType: booking.service_type,
  });
}

/** Place / stay first; type · dates · length second. */
function bookingLead(booking: BookingDirectoryItem): {
  primary: string;
  secondary: string | null;
} {
  const place = booking.city?.trim() || null;
  const primary = place || booking.title;
  const dates = formatBookingDate(booking.start_date);
  const duration = durationLabel(booking);
  const secondary = [
    place ? booking.title : null,
    formatBookingServiceType(booking.service_type),
    dates,
    duration,
  ]
    .filter(Boolean)
    .join(" · ");
  return { primary, secondary: secondary || null };
}

function emptyMessage(hasActiveFilters: boolean, searchQuery: string): string {
  const q = searchQuery.trim();
  if (q) {
    return `No bookings match “${q}”. Try another search or clear filters.`;
  }
  if (hasActiveFilters) {
    return "No bookings match these filters. Clear them or try a different search.";
  }
  return "No bookings on your list yet. Turn off Mine to see the full ledger, or create one.";
}

function BookingDirectoryRow({ booking }: { booking: BookingDirectoryItem }) {
  const router = useRouter();
  const lead = bookingLead(booking);

  return (
    <TableRow
      onClick={() => {
        router.push(pageRoutes.booking(booking.id));
      }}
    >
      <TableCell className="min-w-0">
        {booking.client_id ? (
          <Link
            href={pageRoutes.client(booking.client_id)}
            onClick={(event) => event.stopPropagation()}
            className="block min-w-0 max-w-56"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <p
                className="truncate font-medium text-ink underline-offset-2 hover:underline"
                title={booking.client_name ?? undefined}
              >
                {booking.client_name ?? "—"}
              </p>
              {booking.vip_flag ? <BookingVipBadge /> : null}
            </div>
          </Link>
        ) : (
          <div className="flex min-w-0 max-w-56 flex-wrap items-center gap-1.5">
            <p className="truncate font-medium text-ink-muted">—</p>
            {booking.vip_flag ? <BookingVipBadge /> : null}
          </div>
        )}
      </TableCell>
      <TableCell className="min-w-0 max-w-72">
        <p className="truncate text-[15px] font-semibold text-ink" title={lead.primary}>
          {lead.primary}
        </p>
        {lead.secondary ? (
          <p className="mt-0.5 truncate text-[14px] text-ink-muted">{lead.secondary}</p>
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap text-[15px] text-ink">
        {formatBookingDate(booking.start_date)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <BookingStatusPill status={booking.status} />
      </TableCell>
      <TableCell
        className={
          booking.supplier_ref
            ? "max-w-32 truncate text-[15px] text-ink"
            : "text-[15px] text-ink-muted"
        }
      >
        <span title={booking.supplier_ref ?? undefined}>
          {booking.supplier_ref ?? "—"}
        </span>
      </TableCell>
      <TableCell>
        <BookingDeadlineCell
          cancellationDeadline={booking.cancellation_deadline}
          ticketTimeLimit={booking.ticket_time_limit}
        />
      </TableCell>
      <TableCell
        className={
          booking.owner_name
            ? "max-w-32 truncate text-[15px] text-ink"
            : "text-[15px] text-ink-muted"
        }
      >
        <span title={booking.owner_name ?? undefined}>
          {booking.owner_name ?? "—"}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right">
        <Link
          href={pageRoutes.booking(booking.id)}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex text-ink-muted"
          aria-label={`Open ${lead.primary}`}
        >
          <LuChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </TableCell>
    </TableRow>
  );
}

export function BookingsTable({
  bookings,
  loading,
  hasActiveFilters = false,
  searchQuery = "",
  canWrite = false,
  onShowAll,
}: BookingsTableProps) {
  if (loading && bookings.length === 0) {
    return (
      <SkeletonRegion label="Loading bookings">
        <BookingsTableSkeleton />
      </SkeletonRegion>
    );
  }

  if (!loading && bookings.length === 0) {
    const showDefaultEmptyActions = !hasActiveFilters && !searchQuery.trim();
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-ink-muted">
          <LuCalendarDays className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <p className="max-w-sm text-pretty text-[15px] leading-relaxed text-ink-muted">
          {emptyMessage(hasActiveFilters, searchQuery)}
        </p>
        {showDefaultEmptyActions ? (
          <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
            {onShowAll ? (
              <button
                type="button"
                onClick={onShowAll}
                className={cn(
                  studioButtonClass("secondary", "sm"),
                  "w-full justify-center sm:w-auto",
                )}
              >
                Show all bookings
              </button>
            ) : null}
            {canWrite ? (
              <Link
                href={pageRoutes.bookingNew}
                className={cn(
                  studioButtonClass("primary", "sm"),
                  "w-full justify-center sm:w-auto",
                )}
              >
                New booking
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  const mobileCards = bookings.map((booking) => {
    const deadline = resolveBookingDeadline(
      booking.cancellation_deadline,
      booking.ticket_time_limit,
    );
    const lead = bookingLead(booking);

    return (
      <MobileCard key={booking.id} className="relative">
        <Link
          href={pageRoutes.booking(booking.id)}
          className="absolute inset-0 z-0 rounded-none"
          aria-label={`Open ${lead.primary}`}
        />
        <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 truncate text-[15px] font-semibold text-ink">
                {lead.primary}
              </p>
              {booking.vip_flag ? <BookingVipBadge /> : null}
            </div>
            {lead.secondary ? (
              <p className="mt-1 truncate text-[14px] text-ink-muted">{lead.secondary}</p>
            ) : null}
            <p className="mt-1 truncate text-[14px] text-ink-muted">
              {booking.client_id && booking.client_name ? (
                <Link
                  href={pageRoutes.client(booking.client_id)}
                  onClick={(event) => event.stopPropagation()}
                  className="pointer-events-auto relative z-20 font-medium text-ink underline-offset-2 hover:underline"
                >
                  {booking.client_name}
                </Link>
              ) : (
                <span>{booking.client_name ?? "No client"}</span>
              )}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
              <span>
                {booking.supplier_ref
                  ? `Ref ${booking.supplier_ref}`
                  : "No ref"}
              </span>
              <span aria-hidden>·</span>
              <span>{formatTripLinked(booking.trip_id)}</span>
              {deadline.kind ? (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {deadline.kind === "ticket" ? "Ticket" : "Cancel"}{" "}
                    {deadline.label}
                  </span>
                </>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <BookingStatusPill status={booking.status} />
              {booking.owner_name ? (
                <span className="truncate text-[13px] text-ink-muted">
                  {booking.owner_name}
                </span>
              ) : null}
            </div>
          </div>
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted"
            aria-hidden
          >
            <LuChevronRight className="h-4 w-4" />
          </span>
        </div>
      </MobileCard>
    );
  });

  return (
    <div
      className={cn(
        "transition-opacity",
        loading && bookings.length > 0 && "pointer-events-none opacity-60",
      )}
      aria-busy={loading}
    >
      <ResponsiveTable
        breakpoint="lg"
        minWidthClassName={MIN_WIDTH}
        columns={COLUMNS}
        mobile={mobileCards}
      >
        {bookings.map((booking) => (
          <BookingDirectoryRow key={booking.id} booking={booking} />
        ))}
      </ResponsiveTable>
    </div>
  );
}
