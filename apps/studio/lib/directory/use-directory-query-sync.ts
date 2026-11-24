"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { rememberDirectoryReturn } from "./directory-return";

type UseDirectoryQuerySyncOptions<TState> = {
  /** Current directory UI state to persist. */
  state: TState;
  serialize: (state: TState) => string;
  parse: (params: URLSearchParams) => TState;
  /** Apply parsed URL state when the address bar changes externally. */
  onExternalUrl: (next: TState) => void;
};

function hrefFor(pathname: string, query: string): string {
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * Keeps directory filters in the URL via replace (no history spam).
 * Browser back from a detail page restores the filtered list URL.
 */
export function useDirectoryQuerySync<TState>({
  state,
  serialize,
  parse,
  onExternalUrl,
}: UseDirectoryQuerySyncOptions<TState>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastWrittenQs = useRef<string | null>(null);

  const serializeRef = useRef(serialize);
  const parseRef = useRef(parse);
  const onExternalUrlRef = useRef(onExternalUrl);
  serializeRef.current = serialize;
  parseRef.current = parse;
  onExternalUrlRef.current = onExternalUrl;

  const stateQs = serialize(state);
  // Normalize so key order from the browser cannot trigger replace loops.
  const urlQs = serialize(parse(searchParams));

  useEffect(() => {
    rememberDirectoryReturn(pathname, hrefFor(pathname, stateQs));
  }, [pathname, stateQs]);

  useEffect(() => {
    if (stateQs === urlQs) {
      lastWrittenQs.current = stateQs;
      return;
    }

    // Address bar changed (back/forward or sidebar) — hydrate UI from URL.
    if (lastWrittenQs.current !== null && urlQs !== lastWrittenQs.current) {
      lastWrittenQs.current = urlQs;
      onExternalUrlRef.current(parseRef.current(searchParams));
      return;
    }

    lastWrittenQs.current = stateQs;
    router.replace(hrefFor(pathname, stateQs), { scroll: false });
  }, [stateQs, urlQs, pathname, router, searchParams]);
}
