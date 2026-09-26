"use client";

import Link from "next/link";
import { LuCalendarPlus, LuListFilter } from "react-icons/lu";

import {
  ContentSection,
  PageStack,
  PageToolbar,
  studioButtonClass,
} from "@/components/ui";
import type { BookingDirectoryData } from "@/lib/api/bookings";
import { pageRoutes } from "@/lib/routes";
import type { BookingOwnerFilterOption } from "@/lib/bookings";

import { BookingFiltersDialog } from "./booking-filters-panel";
import { BookingQuickChips } from "./booking-quick-chips";
import { BookingSearch } from "./booking-search";
import { BookingsPagination } from "./bookings-pagination";
import { BookingsTable } from "./bookings-table";
import { useBookingsDirectory } from "./use-bookings-directory";

type BookingsPageContentProps = {
  initialDirectory: BookingDirectoryData;
  ownerOptions: BookingOwnerFilterOption[];
  canWrite: boolean;
};

/** Calm ledger — search, quick chips, Filters panel, open a booking. */
export function BookingsPageContent({
  initialDirectory,
  ownerOptions,
  canWrite,
}: BookingsPageContentProps) {
  const directory = useBookingsDirectory({ initialDirectory });

  const sectionDescription = directory.hasActiveFilters
    ? "Showing bookings that match your search or filters."
    : "Confirmed stays and flights — check refs, deadlines, and what needs follow-up.";

  return (
    <>
      <PageStack>
        <PageToolbar className="gap-5 bg-[linear-gradient(180deg,var(--surface-raised)_0%,var(--surface)_100%)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 sm:max-w-xl sm:flex-1">
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink uppercase">
                Find a booking
              </p>
              <BookingSearch
                value={directory.search}
                onChange={directory.setSearch}
                className="w-full"
              />
            </div>
            {canWrite ? (
              <Link
                href={pageRoutes.bookingNew}
                className={studioButtonClass(
                  "primary",
                  "md",
                  "w-full shrink-0 sm:w-auto sm:self-end",
                )}
              >
                <LuCalendarPlus className="h-3.5 w-3.5" aria-hidden />
                New booking
              </Link>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 pt-4 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink uppercase">
                Quick filters
              </p>
              <BookingQuickChips
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
                  <span className="rounded bg-white/20 px-1 py-0.5 text-[10px] tabular-nums">
                    {directory.advancedCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </PageToolbar>

        <ContentSection
          title="Booking list"
          description={sectionDescription}
          count={directory.total}
          countLabel={directory.total === 1 ? "booking" : "bookings"}
        >
          <BookingsTable
            bookings={directory.bookings}
            loading={directory.loading}
            hasActiveFilters={directory.hasActiveFilters}
            searchQuery={directory.search}
            canWrite={canWrite}
            onShowAll={() => directory.setQuickFilters([])}
          />
          {directory.total > 0 || !directory.loading ? (
            <BookingsPagination
              page={directory.page}
              pageSize={directory.pageSize}
              total={directory.total}
              onPageChange={directory.setPage}
            />
          ) : null}
        </ContentSection>
      </PageStack>

      <BookingFiltersDialog
        open={directory.filtersDialogOpen}
        value={directory.advancedFilters}
        ownerOptions={ownerOptions}
        onClose={() => directory.setFiltersDialogOpen(false)}
        onApply={directory.setAdvancedFilters}
      />
    </>
  );
}
