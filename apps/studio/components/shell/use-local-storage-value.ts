"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Raw localStorage string for `key` ("" when unset), shared across components and tabs. */
export function useLocalStorageValue(key: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) ?? "",
    () => "",
  );

  const setValue = useCallback(
    (next: string) => {
      window.localStorage.setItem(key, next);
      for (const listener of listeners) listener();
    },
    [key],
  );

  return [value, setValue];
}
