"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { BookingQuickFilter } from "@pureluxe/shared";

import {
  listBookings,
  type BookingDirectoryData,
  type BookingDirectoryItem,
} from "@/lib/api/bookings";
import {
  BOOKING_DIRECTORY_PAGE_SIZE,
  countBookingAdvancedFilters,
  EMPTY_BOOKING_ADVANCED_FILTERS,
  parseBookingDirectoryUrlState,
  serializeBookingDirectoryUrlState,
  syncQuickFiltersWithAdvanced,
  workFromQuickFilters,
  type BookingAdvancedFilters,
  type BookingDirectoryUrlState,
} from "@/lib/bookings";
import { useDirectoryQuerySync } from "@/lib/directory";
import { showApiError } from "@/lib/feedback/toast";

type UseBookingsDirectoryOptions = {
  initialDirectory: BookingDirectoryData;
};

/** Directory list state — search, chips, filters dialog, pagination. */
export function useBookingsDirectory({
  initialDirectory,
}: UseBookingsDirectoryOptions) {
  const searchParams = useSearchParams();
  const initialUrlState = useMemo(
    () => parseBookingDirectoryUrlState(searchParams),
    // Intentionally once — URL sync owns later updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [bookings, setBookings] = useState<BookingDirectoryItem[]>(
    initialDirectory.bookings,
  );
  const [total, setTotal] = useState(initialDirectory.total);
  const [search, setSearch] = useState(initialUrlState.search);
  const [debouncedSearch, setDebouncedSearch] = useState(
    initialUrlState.search.trim(),
  );
  const [quickFilters, setQuickFiltersState] = useState<BookingQuickFilter[]>(
    initialUrlState.quickFilters,
  );
  const [advancedFilters, setAdvancedFiltersState] =
    useState<BookingAdvancedFilters>(initialUrlState.advancedFilters);
  const [page, setPage] = useState(initialUrlState.page);
  const [loading, setLoading] = useState(false);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  // Server page already loaded rows for the current URL filters.
  const skipFirstFetch = useRef(true);
  const requestIdRef = useRef(0);

  const urlState: BookingDirectoryUrlState = {
    search: debouncedSearch,
    quickFilters,
    advancedFilters,
    page,
  };

  const applyUrlState = useCallback((next: BookingDirectoryUrlState) => {
    setSearch(next.search);
    setDebouncedSearch(next.search.trim());
    setQuickFiltersState(next.quickFilters);
    setAdvancedFiltersState(next.advancedFilters);
    setPage(next.page);
  }, []);

  useDirectoryQuerySync({
    state: urlState,
    serialize: serializeBookingDirectoryUrlState,
    parse: parseBookingDirectoryUrlState,
    onExternalUrl: applyUrlState,
  });

  const debouncedSearchRef = useRef(debouncedSearch);
  debouncedSearchRef.current = debouncedSearch;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = search.trim();
      if (next === debouncedSearchRef.current) return;
      setDebouncedSearch(next);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);

    const work = workFromQuickFilters(quickFilters);

    void listBookings({
      q: debouncedSearch || undefined,
      scope: quickFilters.includes("mine") ? undefined : "all",
      type: advancedFilters.type !== "any" ? advancedFilters.type : undefined,
      work: work !== "any" ? work : undefined,
      status:
        advancedFilters.status !== "any" ? advancedFilters.status : undefined,
      missing_ref: advancedFilters.missing_ref || undefined,
      no_trip: advancedFilters.no_trip || undefined,
      ticket_deadline_soon: advancedFilters.ticket_deadline_soon || undefined,
      owner: advancedFilters.owner !== "any" ? advancedFilters.owner : undefined,
      start_from: advancedFilters.start_from || undefined,
      start_to: advancedFilters.start_to || undefined,
      limit: BOOKING_DIRECTORY_PAGE_SIZE,
      offset: (page - 1) * BOOKING_DIRECTORY_PAGE_SIZE,
    })
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        setBookings(response.data.bookings);
        setTotal(response.data.total);
      })
      .catch((error) => {
        if (requestId !== requestIdRef.current) return;
        showApiError(error);
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });
  }, [debouncedSearch, quickFilters, advancedFilters, page]);

  const advancedCount = countBookingAdvancedFilters(advancedFilters);
  const atDefaultFilters =
    debouncedSearch.length === 0 &&
    advancedCount === 0 &&
    quickFilters.length === 1 &&
    quickFilters[0] === "mine";
  const hasActiveFilters = !atDefaultFilters;

  function setQuickFilters(value: BookingQuickFilter[]) {
    setPage(1);
    const mineOn = value.includes("mine");
    const wasMineOn = quickFilters.includes("mine");
    setQuickFiltersState(value);
    setAdvancedFiltersState((current) => {
      let nextOwner = current.owner;
      // Turning Mine on clears a conflicting specific-owner filter.
      if (mineOn && !wasMineOn && nextOwner !== "any" && nextOwner !== "me") {
        nextOwner = "any";
      }
      return {
        ...current,
        work: workFromQuickFilters(value),
        owner: nextOwner,
      };
    });
  }

  function clearAllFilters() {
    setPage(1);
    setSearch("");
    setDebouncedSearch("");
    setQuickFiltersState(["mine"]);
    setAdvancedFiltersState(EMPTY_BOOKING_ADVANCED_FILTERS);
  }

  function applyAdvancedFilters(value: BookingAdvancedFilters) {
    setPage(1);
    setAdvancedFiltersState(value);
    setQuickFiltersState((current) =>
      syncQuickFiltersWithAdvanced(current, value),
    );
  }

  return {
    bookings,
    total,
    page,
    setPage,
    pageSize: BOOKING_DIRECTORY_PAGE_SIZE,
    search,
    setSearch,
    quickFilters,
    setQuickFilters,
    advancedFilters,
    setAdvancedFilters: applyAdvancedFilters,
    advancedCount,
    hasActiveFilters,
    clearAllFilters,
    loading,
    filtersDialogOpen,
    setFiltersDialogOpen,
  };
}
