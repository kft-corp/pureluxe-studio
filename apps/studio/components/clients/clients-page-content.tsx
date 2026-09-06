"use client";

import Link from "next/link";
import { LuListFilter, LuUserPlus } from "react-icons/lu";

import {
  ContentSection,
  PageStack,
  PageToolbar,
  studioButtonClass,
} from "@/components/ui";
import type { ClientDirectoryData } from "@/lib/api/clients";
import type { ClientDirectoryFilters } from "@/lib/clients";
import { pageRoutes } from "@/lib/routes";

import { ClientFiltersDialog } from "./client-filters-panel";
import { ClientQuickChips } from "./client-quick-chips";
import { ClientSearch } from "./client-search";
import { ClientsPagination } from "./clients-pagination";
import { ClientsTable } from "./clients-table";
import { useClientsDirectory } from "./use-clients-directory";

type ClientsPageContentProps = {
  initialDirectory: ClientDirectoryData;
  canWrite: boolean;
  filterOptions: ClientDirectoryFilters;
};

/** Calm directory — search, quick chips, Filters panel, open a profile. */
export function ClientsPageContent({
  initialDirectory,
  canWrite,
  filterOptions,
}: ClientsPageContentProps) {
  const directory = useClientsDirectory({ initialDirectory });

  const sectionDescription = directory.hasActiveFilters
    ? "Showing people who match your search or filters."
    : "Pick someone to open their profile and prep the next trip.";

  return (
    <>
      <PageStack>
        <PageToolbar className="gap-5 bg-[linear-gradient(180deg,var(--surface-raised)_0%,var(--surface)_100%)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 sm:max-w-xl sm:flex-1">
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink uppercase">
                Find someone
              </p>
              <ClientSearch
                value={directory.search}
                onChange={directory.setSearch}
                className="w-full"
              />
            </div>
            {canWrite ? (
              <Link
                href={pageRoutes.clientNew}
                className={studioButtonClass(
                  "primary",
                  "md",
                  "w-full shrink-0 sm:w-auto sm:self-end",
                )}
              >
                <LuUserPlus className="h-4 w-4" aria-hidden />
                New client
              </Link>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink uppercase">
                Quick filters
              </p>
              <ClientQuickChips
                value={directory.quickFilters}
                onChange={directory.setQuickFilters}
              />
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              {directory.hasActiveFilters ? (
                <button
                  type="button"
                  onClick={directory.clearAllFilters}
                  className={studioButtonClass(
                    "secondary",
                    "sm",
                    "w-full sm:w-auto",
                  )}
                >
                  Clear search & filters
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => directory.setFiltersDialogOpen(true)}
                className={studioButtonClass(
                  directory.advancedCount > 0 ? "primary" : "secondary",
                  "md",
                  "w-full sm:w-auto",
                )}
              >
                <LuListFilter className="h-4 w-4" aria-hidden />
                More filters
                {directory.advancedCount > 0 ? (
                  <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] tabular-nums">
                    {directory.advancedCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </PageToolbar>

        <ContentSection
          title="Client list"
          description={sectionDescription}
          count={directory.total}
          countLabel={directory.total === 1 ? "client" : "clients"}
        >
          <ClientsTable
            clients={directory.clients}
            loading={directory.loading}
            hasActiveFilters={directory.hasActiveFilters}
            searchQuery={directory.search}
          />
          {directory.total > 0 || !directory.loading ? (
            <ClientsPagination
              page={directory.page}
              pageSize={directory.pageSize}
              total={directory.total}
              onPageChange={directory.setPage}
            />
          ) : null}
        </ContentSection>
      </PageStack>

      <ClientFiltersDialog
        open={directory.filtersDialogOpen}
        value={directory.advancedFilters}
        options={filterOptions}
        onClose={() => directory.setFiltersDialogOpen(false)}
        onApply={directory.setAdvancedFilters}
      />
    </>
  );
}
