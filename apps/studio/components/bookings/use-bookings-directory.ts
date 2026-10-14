"use client";

import { useEffect, useRef, useState } from "react";
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
  syncQuickFiltersWithAdvanced,
  workFromQuickFilters,
  type BookingAdvancedFilters,
} from "@/lib/bookings";
import { showApiError } from "@/lib/feedback/toast";

type UseBookingsDirectoryOptions = {
  initialDirectory: BookingDirectoryData;
};

/** Directory list state — search, chips, filters dialog, pagination. */
export function useBookingsDirectory({
  initialDirectory,
}: UseBookingsDirectoryOptions) {
  const [bookings, setBookings] = useState<BookingDirectoryItem[]>(
    initialDirectory.bookings,
  );
  const [total, setTotal] = useState(initialDirectory.total);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [quickFilters, setQuickFiltersState] = useState<BookingQuickFilter[]>([
    "mine",
  ]);
  const [advancedFilters, setAdvancedFiltersState] =
    useState<BookingAdvancedFilters>(EMPTY_BOOKING_ADVANCED_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const skipFirstFetch = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
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
