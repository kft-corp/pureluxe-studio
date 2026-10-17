"use client";

import { useCallback, useSyncExternalStore } from "react";

import { pageRoutes } from "@/lib/routes";

import { useLocalStorageValue } from "./use-local-storage-value";

const STORAGE_KEY = "studio-sidebar-unfoldable";
const WIDE_QUERY = "(min-width: 1280px)";

function subscribeWide(listener: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/**
 * Icon-rail vs full sidebar.
 * A manual toggle always wins; otherwise smaller laptops and Trip Builder default to the rail.
 */
export function useSidebarUnfoldable(pathname: string) {
  const [stored, setStored] = useLocalStorageValue(STORAGE_KEY);
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );

  const autoRail = !wide || pathname.startsWith(pageRoutes.tripBuilder);
  const unfoldable = stored === "" ? autoRail : stored === "true";

  const toggleUnfoldable = useCallback(() => {
    setStored(String(!unfoldable));
  }, [unfoldable, setStored]);

  return { unfoldable, toggleUnfoldable };
}
