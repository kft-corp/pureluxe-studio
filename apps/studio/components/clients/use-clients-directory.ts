"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  parseClientDirectoryUrlState,
  serializeClientDirectoryUrlState,
  type ClientAdvancedFilters,
  type ClientDirectoryUrlState,
} from "@/lib/clients";
import { useDirectoryQuerySync } from "@/lib/directory";
import { showApiError } from "@/lib/feedback/toast";

type UseClientsDirectoryOptions = {
  initialDirectory: ClientDirectoryData;
};

/** Directory list state — search, chips, filters, and server-side pagination. */
export function useClientsDirectory({
  initialDirectory,
}: UseClientsDirectoryOptions) {
  const searchParams = useSearchParams();
  const initialUrlState = useMemo(
    () => parseClientDirectoryUrlState(searchParams),
    // Intentionally once — URL sync owns later updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [clients, setClients] = useState<ClientDirectoryItem[]>(
    initialDirectory.clients,
  );
  const [total, setTotal] = useState(initialDirectory.total);
  const [search, setSearch] = useState(initialUrlState.search);
  const [debouncedSearch, setDebouncedSearch] = useState(
    initialUrlState.search.trim(),
  );
  const [quickFilters, setQuickFiltersState] = useState<ClientQuickFilter[]>(
    initialUrlState.quickFilters,
  );
  const [advancedFilters, setAdvancedFiltersState] =
    useState<ClientAdvancedFilters>(initialUrlState.advancedFilters);
  const [page, setPage] = useState(initialUrlState.page);
  const [loading, setLoading] = useState(false);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  // Server page already loaded rows for the current URL filters.
  const skipFirstFetch = useRef(true);
  const requestIdRef = useRef(0);

  const urlState: ClientDirectoryUrlState = {
    search: debouncedSearch,
    quickFilters,
    advancedFilters,
    page,
  };

  const applyUrlState = useCallback((next: ClientDirectoryUrlState) => {
    setSearch(next.search);
    setDebouncedSearch(next.search.trim());
    setQuickFiltersState(next.quickFilters);
    setAdvancedFiltersState(next.advancedFilters);
    setPage(next.page);
  }, []);

  useDirectoryQuerySync({
    state: urlState,
    serialize: serializeClientDirectoryUrlState,
    parse: parseClientDirectoryUrlState,
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
