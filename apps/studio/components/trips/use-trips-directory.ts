"use client";

import { useEffect, useRef, useState } from "react";

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
  stageDetailForChips,
  syncTripQuickFilters,
  type JourneyQuickFilter,
  type TripAdvancedFilters,
} from "@/lib/trips";
import { showApiError } from "@/lib/feedback/toast";

type UseTripsDirectoryOptions = {
  initialDirectory: JourneyDirectoryData;
};

/** Directory list state — search, quick chips, pagination. */
export function useTripsDirectory({ initialDirectory }: UseTripsDirectoryOptions) {
  const [journeys, setJourneys] = useState<JourneyCardItem[]>(
    initialDirectory.journeys,
  );
  const [total, setTotal] = useState(initialDirectory.total);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [quickFilters, setQuickFiltersState] = useState<JourneyQuickFilter[]>([
    "mine",
  ]);
  const [advancedFilters, setAdvancedFiltersState] = useState<TripAdvancedFilters>(
    EMPTY_TRIP_ADVANCED_FILTERS,
  );
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
    const stage = directoryStage(quickFilters, advancedFilters.stage);

    void listJourneyCards({
      q: debouncedSearch || undefined,
      scope: quickFilters.includes("mine") ? undefined : "all",
      stage: stage === "any" ? undefined : stage,
      client_tier:
        advancedFilters.client_tier !== "any" ? advancedFilters.client_tier : undefined,
      price: advancedFilters.price !== "any" ? advancedFilters.price : undefined,
      quote: advancedFilters.quote !== "any" ? advancedFilters.quote : undefined,
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
