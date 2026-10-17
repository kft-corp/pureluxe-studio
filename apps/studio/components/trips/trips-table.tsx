"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuChevronRight, LuLuggage } from "react-icons/lu";

import { ClientVipBadge } from "@/components/clients/client-vip-badge";
import { SkeletonRegion, TableSkeleton } from "@/components/feedback";
import { studioButtonClass } from "@/components/ui";
import {
  MobileCard,
  ResponsiveTable,
  TableCell,
  TableRow,
} from "@/components/ui/responsive-table";
import type { JourneyCardItem } from "@/lib/api/trips";
import { formatBookingDate } from "@/lib/bookings";
import {
  formatJourneyParty,
  formatJourneyRoute,
  formatJourneySell,
  journeyNextStep,
} from "@/lib/trips";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

import { JourneyPhasePill } from "./journey-phase-pill";

const COLUMNS = ["Client", "Trip", "Dates", "Stage", "Sell", "Owner", ""];
const MIN_WIDTH = "min-w-[52rem]";

export function TripsTableSkeleton() {
  return (
    <TableSkeleton
      columns={COLUMNS}
      lead="text"
      breakpoint="lg"
      minWidthClassName={MIN_WIDTH}
    />
  );
}

type TripsTableProps = {
  journeys: JourneyCardItem[];
  loading: boolean;
  hasActiveFilters?: boolean;
  searchQuery?: string;
  canStartTrip?: boolean;
  onShowAll?: () => void;
};

function emptyMessage(hasActiveFilters: boolean, searchQuery: string): string {
  const q = searchQuery.trim();
  if (q) {
    return `No trips match “${q}”. Try another search or clear filters.`;
  }
  if (hasActiveFilters) {
    return "No trips match these filters. Clear them or try a different search.";
  }
  return "No trips on your list yet. Turn off Mine to see the whole team, or start one in Trip Builder.";
}

function whenLabel(journey: JourneyCardItem): string {
  if (journey.starts_on && journey.ends_on) {
    return `${formatBookingDate(journey.starts_on)} – ${formatBookingDate(journey.ends_on)}`;
  }
  if (journey.starts_on || journey.ends_on) {
    return formatBookingDate(journey.starts_on ?? journey.ends_on);
  }
  return "—";
}

function tripTitle(journey: JourneyCardItem): string {
  return journey.title?.trim() || formatJourneyRoute(journey.destinations) || "Untitled trip";
}

function tripSubtitle(journey: JourneyCardItem): string {
  const route = journey.title?.trim() ? formatJourneyRoute(journey.destinations) : null;
  const party = formatJourneyParty(journey.traveller_count);
  return [route, party].filter(Boolean).join(" · ");
}

function NextStep({ journey, className }: { journey: JourneyCardItem; className?: string }) {
  return (
    <p className={cn("truncate text-xs", className)}>
      <span className="font-semibold tracking-wide text-ink-muted uppercase">Next</span>{" "}
      <span className="text-ink">{journeyNextStep(journey)}</span>
    </p>
  );
}

function TripDirectoryRow({ journey }: { journey: JourneyCardItem }) {
  const router = useRouter();
  const title = tripTitle(journey);
  const subtitle = tripSubtitle(journey);
  const sell = formatJourneySell(journey.sell_total, journey.sell_currency);

  return (
    <TableRow
      onClick={() => {
        router.push(pageRoutes.trip(journey.id));
      }}
    >
      <TableCell className="min-w-0">
        {journey.client ? (
          <Link
            href={pageRoutes.client(journey.client.id)}
            onClick={(event) => event.stopPropagation()}
            className="block min-w-0 max-w-56"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <p
                className="truncate font-medium text-ink underline-offset-2 hover:underline"
                title={journey.client.display_name}
              >
                {journey.client.display_name}
              </p>
              {journey.client.vip ? (
                <ClientVipBadge tier={journey.client.tier_slug} />
              ) : null}
            </div>
          </Link>
        ) : (
          <p className="truncate font-medium text-ink-muted">No client</p>
        )}
      </TableCell>
      <TableCell className="min-w-0 max-w-64">
        <p className="truncate font-medium text-ink" title={title}>
          {title}
        </p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-sm text-ink-muted">{subtitle}</p>
        ) : null}
        <NextStep journey={journey} className="mt-1" />
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-ink">
        {whenLabel(journey)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <JourneyPhasePill journey={journey} />
        {journey.proposal_stale && journey.status === "building" ? (
          <p className="mt-1 text-[11px] text-warning-ink">Quote out of date</p>
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-ink">
        {sell ?? "—"}
        {journey.pricing_locked ? (
          <p className="text-[11px] text-ink-muted">Locked</p>
        ) : null}
      </TableCell>
      <TableCell
        className={
          journey.owner
            ? "max-w-32 truncate text-sm text-ink"
            : "text-sm text-ink-muted"
        }
      >
        <span title={journey.owner?.name}>{journey.owner?.name ?? "—"}</span>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right">
        <Link
          href={pageRoutes.trip(journey.id)}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex text-ink-muted"
          aria-label={`Open ${title}`}
        >
          <LuChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </TableCell>
    </TableRow>
  );
}

export function TripsTable({
  journeys,
  loading,
  hasActiveFilters = false,
  searchQuery = "",
  canStartTrip = false,
  onShowAll,
}: TripsTableProps) {
  if (loading && journeys.length === 0) {
    return (
      <SkeletonRegion label="Loading trips">
        <TripsTableSkeleton />
      </SkeletonRegion>
    );
  }

  if (!loading && journeys.length === 0) {
    const showDefaultEmptyActions = !hasActiveFilters && !searchQuery.trim();
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-ink-muted">
          <LuLuggage className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <p className="max-w-sm text-pretty text-sm leading-relaxed text-ink-muted">
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
                Show all trips
              </button>
            ) : null}
            {canStartTrip ? (
              <Link
                href={pageRoutes.tripBuilder}
                className={cn(
                  studioButtonClass("primary", "sm"),
                  "w-full justify-center sm:w-auto",
                )}
              >
                New trip
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  const mobileCards = journeys.map((journey) => {
    const title = tripTitle(journey);
    const route = journey.title?.trim()
      ? formatJourneyRoute(journey.destinations)
      : null;
    const sell = formatJourneySell(journey.sell_total, journey.sell_currency);

    return (
      <MobileCard key={journey.id} className="relative">
        <Link
          href={pageRoutes.trip(journey.id)}
          className="absolute inset-0 z-0 rounded-none"
          aria-label={`Open ${title}`}
        />
        <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 truncate font-medium text-ink">{title}</p>
              {journey.client?.vip ? (
                <ClientVipBadge tier={journey.client.tier_slug} />
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm text-ink-muted">
              {journey.client ? (
                <Link
                  href={pageRoutes.client(journey.client.id)}
                  className="pointer-events-auto relative z-20 font-medium text-ink underline-offset-2 hover:underline"
                >
                  {journey.client.display_name}
                </Link>
              ) : (
                <span>No client</span>
              )}
              {route ? ` · ${route}` : ""}
            </p>
            <p className="mt-1 text-xs text-ink-muted">{whenLabel(journey)}</p>
            <NextStep journey={journey} className="mt-1" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <JourneyPhasePill journey={journey} />
              {sell ? (
                <span className="text-xs text-ink-muted">{sell}</span>
              ) : null}
              {journey.owner ? (
                <span className="truncate text-xs text-ink-muted">
                  {journey.owner.name}
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
        loading && journeys.length > 0 && "pointer-events-none opacity-60",
      )}
      aria-busy={loading}
    >
      <ResponsiveTable
        breakpoint="lg"
        minWidthClassName={MIN_WIDTH}
        columns={COLUMNS}
        mobile={mobileCards}
      >
        {journeys.map((journey) => (
          <TripDirectoryRow key={journey.id} journey={journey} />
        ))}
      </ResponsiveTable>
    </div>
  );
}
