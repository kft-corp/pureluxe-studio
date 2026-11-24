"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  listJourneyCards,
  type JourneyCardItem,
  type JourneyDirectoryData,
} from "@/lib/api/trips";
import {
  JOURNEY_DIRECTORY_PAGE_SIZE,
  countTripAdvancedFilters,
  directoryStage,
  EMPTY_TRIP_ADVANCED_FILTERS,
  parseTripDirectoryUrlState,
  serializeTripDirectoryUrlState,
  stageDetailForChips,
  syncTripQuickFilters,
  type JourneyQuickFilter,
  type TripAdvancedFilters,
  type TripDirectoryUrlState,
} from "@/lib/trips";
import { useDirectoryQuerySync } from "@/lib/directory";
import { showApiError } from "@/lib/feedback/toast";

type UseTripsDirectoryOptions = {
  initialDirectory: JourneyDirectoryData;
};

/** Directory list state — search, quick chips, pagination. */
export function useTripsDirectory({ initialDirectory }: UseTripsDirectoryOptions) {
  const searchParams = useSearchParams();
  const initialUrlState = useMemo(
    () => parseTripDirectoryUrlState(searchParams),
    // Intentionally once — URL sync owns later updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [journeys, setJourneys] = useState<JourneyCardItem[]>(
    initialDirectory.journeys,
  );
  const [total, setTotal] = useState(initialDirectory.total);
  const [search, setSearch] = useState(initialUrlState.search);
  const [debouncedSearch, setDebouncedSearch] = useState(
    initialUrlState.search.trim(),
  );
  const [quickFilters, setQuickFiltersState] = useState<JourneyQuickFilter[]>(
    initialUrlState.quickFilters,
  );
  const [advancedFilters, setAdvancedFiltersState] = useState<TripAdvancedFilters>(
    initialUrlState.advancedFilters,
  );
  const [page, setPage] = useState(initialUrlState.page);
  const [loading, setLoading] = useState(false);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  // Server page already loaded rows for the current URL filters.
  const skipFirstFetch = useRef(true);
  const requestIdRef = useRef(0);

  const urlState: TripDirectoryUrlState = {
    search: debouncedSearch,
    quickFilters,
    advancedFilters,
    page,
  };

  const applyUrlState = useCallback((next: TripDirectoryUrlState) => {
    setSearch(next.search);
    setDebouncedSearch(next.search.trim());
    setQuickFiltersState(next.quickFilters);
    setAdvancedFiltersState(next.advancedFilters);
    setPage(next.page);
  }, []);

  useDirectoryQuerySync({
    state: urlState,
    serialize: serializeTripDirectoryUrlState,
    parse: parseTripDirectoryUrlState,
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
    const stage = directoryStage(quickFilters, advancedFilters.stage);

    void listJourneyCards({
      q: debouncedSearch || undefined,
      scope: quickFilters.includes("mine") ? undefined : "all",
      stage: stage === "any" ? undefined : stage,
      client_tier:
        advancedFilters.client_tier !== "any" ? advancedFilters.client_tier : undefined,
      price: advancedFilters.price !== "any" ? advancedFilters.price : undefined,
      quote: advancedFilters.quote !== "any" ? advancedFilters.quote : undefined,
      payment:
        advancedFilters.payment !== "any" ? advancedFilters.payment : undefined,
      owner: advancedFilters.owner !== "any" ? advancedFilters.owner : undefined,
      starts_from: advancedFilters.starts_from || undefined,
      starts_to: advancedFilters.starts_to || undefined,
      limit: JOURNEY_DIRECTORY_PAGE_SIZE,
      offset: (page - 1) * JOURNEY_DIRECTORY_PAGE_SIZE,
    })
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        setJourneys(response.data.journeys);
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

  const advancedCount = countTripAdvancedFilters(advancedFilters);
  const atDefaultFilters =
    debouncedSearch.length === 0 &&
    advancedCount === 0 &&
    quickFilters.length === 1 &&
    quickFilters[0] === "mine";
  const hasActiveFilters = !atDefaultFilters;

  function setQuickFilters(value: JourneyQuickFilter[]) {
    setPage(1);
    const mineOn = value.includes("mine");
    const wasMineOn = quickFilters.includes("mine");
    setQuickFiltersState(value);
    setAdvancedFiltersState((current) => {
      let nextOwner = current.owner;
      if (mineOn && !wasMineOn && nextOwner !== "any" && nextOwner !== "me") {
        nextOwner = "any";
      }
      if (!mineOn && wasMineOn && nextOwner === "me") {
        nextOwner = "any";
      }
      return {
        ...current,
        owner: nextOwner,
        stage: stageDetailForChips(value, current.stage),
      };
    });
  }

  function clearAllFilters() {
    setPage(1);
    setSearch("");
    setDebouncedSearch("");
    setQuickFiltersState(["mine"]);
    setAdvancedFiltersState(EMPTY_TRIP_ADVANCED_FILTERS);
  }

  function applyAdvancedFilters(value: TripAdvancedFilters) {
    setPage(1);
    setAdvancedFiltersState(value);
    setQuickFiltersState((current) => syncTripQuickFilters(current, value));
  }

  return {
    journeys,
    total,
    page,
    setPage,
    pageSize: JOURNEY_DIRECTORY_PAGE_SIZE,
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
