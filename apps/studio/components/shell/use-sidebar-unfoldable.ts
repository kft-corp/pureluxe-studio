"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "studio-sidebar-unfoldable";

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

function getServerSnapshot() {
  return false;
}

export function useSidebarUnfoldable() {
  const unfoldable = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setUnfoldable = useCallback((value: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, String(value));
    emitChange();
  }, []);

  const toggleUnfoldable = useCallback(() => {
    setUnfoldable(!unfoldable);
  }, [unfoldable, setUnfoldable]);

  return { unfoldable, toggleUnfoldable };
}
