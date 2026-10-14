"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientQuickFilter } from "@pureluxe/shared";

import {
  listClients,
  type ClientDirectoryData,
  type ClientDirectoryItem,
} from "@/lib/api/clients";
import {
  CLIENT_DIRECTORY_PAGE_SIZE,
  countAdvancedFilters,
  EMPTY_ADVANCED_FILTERS,
  type ClientAdvancedFilters,
} from "@/lib/clients";
import { showApiError } from "@/lib/feedback/toast";

type UseClientsDirectoryOptions = {
  initialDirectory: ClientDirectoryData;
};

/** Directory list state — search, chips, filters, and server-side pagination. */
export function useClientsDirectory({
  initialDirectory,
}: UseClientsDirectoryOptions) {
  const [clients, setClients] = useState<ClientDirectoryItem[]>(
    initialDirectory.clients,
  );
  const [total, setTotal] = useState(initialDirectory.total);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [quickFilters, setQuickFiltersState] = useState<ClientQuickFilter[]>(
    [],
  );
  const [advancedFilters, setAdvancedFiltersState] =
    useState<ClientAdvancedFilters>(EMPTY_ADVANCED_FILTERS);
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

    void listClients({
      q: debouncedSearch || undefined,
      filters: quickFilters,
      tier: advancedFilters.tier,
      review_status: advancedFilters.review_status,
      has_family: advancedFilters.has_family,
      missing_contact: advancedFilters.missing_contact,
      owner: advancedFilters.owner,
      sources: advancedFilters.sources,
      completeness: advancedFilters.completeness,
      created_from: advancedFilters.created_from || undefined,
      created_to: advancedFilters.created_to || undefined,
      sort: "name_asc",
      limit: CLIENT_DIRECTORY_PAGE_SIZE,
      offset: (page - 1) * CLIENT_DIRECTORY_PAGE_SIZE,
    })
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        setClients(response.data.clients);
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

  const advancedCount = countAdvancedFilters(advancedFilters);
  const hasActiveFilters =
    quickFilters.length > 0 ||
    advancedCount > 0 ||
    debouncedSearch.length > 0;

  function setQuickFilters(value: ClientQuickFilter[]) {
    setPage(1);
    setQuickFiltersState(value);
  }

  function clearAllFilters() {
    setPage(1);
    setSearch("");
    setDebouncedSearch("");
    setQuickFiltersState([]);
    setAdvancedFiltersState(EMPTY_ADVANCED_FILTERS);
  }

  /** Applying the dialog clears quick chips so only dialog filters apply. */
  function applyAdvancedFilters(value: ClientAdvancedFilters) {
    setPage(1);
    setQuickFiltersState([]);
    setAdvancedFiltersState(value);
  }

  return {
    clients,
    total,
    page,
    setPage,
    pageSize: CLIENT_DIRECTORY_PAGE_SIZE,
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
