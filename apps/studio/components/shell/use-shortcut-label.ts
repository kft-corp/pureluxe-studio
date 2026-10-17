"use client";

import { useSyncExternalStore } from "react";

function subscribeNoop() {
  return () => {};
}

/** "⌘K" on Apple devices, "Ctrl K" elsewhere. */
export function useShortcutLabel(key: string): string {
  const isApple = useSyncExternalStore(
    subscribeNoop,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
  return isApple ? `⌘${key}` : `Ctrl ${key}`;
}
