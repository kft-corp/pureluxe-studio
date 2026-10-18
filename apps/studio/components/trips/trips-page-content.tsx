"use client";

import Link from "next/link";
import { LuListFilter, LuSparkles } from "react-icons/lu";

import {
  ContentSection,
  PageStack,
  PageToolbar,
  studioButtonClass,
} from "@/components/ui";
import { listSectionCopy } from "@/config/page-copy";
import type { JourneyDirectoryData } from "@/lib/api/trips";
import { pageRoutes } from "@/lib/routes";
import type { TripOwnerFilterOption } from "@/lib/trips";

import { TripFiltersDialog } from "./trip-filters-panel";
import { TripQuickChips } from "./trip-quick-chips";
import { TripSearch } from "./trip-search";
import { TripsPagination } from "./trips-pagination";
import { TripsTable } from "./trips-table";
import { useTripsDirectory } from "./use-trips-directory";

type TripsPageContentProps = {
  initialDirectory: JourneyDirectoryData;
  ownerOptions: TripOwnerFilterOption[];
  canStartTrip: boolean;
};

/** Directory — search, quick chips, more filters; a row opens the trip page. */
export function TripsPageContent({
  initialDirectory,
  ownerOptions,
  canStartTrip,
}: TripsPageContentProps) {
  const directory = useTripsDirectory({ initialDirectory });

  const sectionDescription = directory.hasActiveFilters
    ? "Showing trips that match your search or filters."
    : listSectionCopy.trips.description;

  return (
    <>
      <PageStack>
      <PageToolbar className="gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 sm:max-w-xl sm:flex-1">
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink uppercase">
              Find a trip
            </p>
            <TripSearch
              value={directory.search}
              onChange={directory.setSearch}
              className="w-full"
            />
          </div>
          {canStartTrip ? (
            <Link
              href={pageRoutes.tripBuilder}
              className={studioButtonClass(
                "primary",
                "md",
                "w-full shrink-0 sm:w-auto sm:self-end",
              )}
            >
              <LuSparkles className="h-3.5 w-3.5" aria-hidden />
              New trip
            </Link>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-border/70 pt-4 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink uppercase">
              Quick filters
            </p>
            <TripQuickChips
              value={directory.quickFilters}
              onChange={directory.setQuickFilters}
            />
          </div>

          <div className="flex w-full shrink-0 flex-row flex-wrap items-center gap-2 sm:w-auto lg:justify-end">
            {directory.hasActiveFilters ? (
              <button
                type="button"
                onClick={directory.clearAllFilters}
                className={studioButtonClass(
                  "dangerSoft",
                  "sm",
                  "min-w-0 flex-1 sm:flex-none",
                )}
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => directory.setFiltersDialogOpen(true)}
              className={studioButtonClass(
                directory.advancedCount > 0 ? "primary" : "secondary",
                "md",
                "min-w-0 flex-1 sm:flex-none",
              )}
            >
              <LuListFilter className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">More filters</span>
              {directory.advancedCount > 0 ? (
                <span className="rounded bg-on-dark/20 px-1 py-0.5 text-[10px] tabular-nums">
                  {directory.advancedCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </PageToolbar>

      <ContentSection
        title={listSectionCopy.trips.title}
        description={sectionDescription}
        count={directory.total}
        countLabel={directory.total === 1 ? "trip" : "trips"}
      >
        <TripsTable
          journeys={directory.journeys}
          loading={directory.loading}
          hasActiveFilters={directory.hasActiveFilters}
          searchQuery={directory.search}
          canStartTrip={canStartTrip}
          onShowAll={() => directory.setQuickFilters([])}
        />
        {directory.total > 0 || !directory.loading ? (
          <TripsPagination
            page={directory.page}
            pageSize={directory.pageSize}
            total={directory.total}
            onPageChange={directory.setPage}
          />
        ) : null}
      </ContentSection>
      </PageStack>

      <TripFiltersDialog
        open={directory.filtersDialogOpen}
        value={directory.advancedFilters}
        ownerOptions={ownerOptions}
        onClose={() => directory.setFiltersDialogOpen(false)}
        onApply={directory.setAdvancedFilters}
      />
    </>
  );
}
