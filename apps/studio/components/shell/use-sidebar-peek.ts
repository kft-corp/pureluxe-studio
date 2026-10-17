"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

const OPEN_DELAY_MS = 180;
const CLOSE_DELAY_MS = 220;

/**
 * Hover "peek" for the collapsed sidebar: a mouse resting on the rail slides the full
 * sidebar out over the page; moving away tucks it back. Touch and pen never peek.
 */
export function useSidebarPeek(enabled: boolean) {
  const [peeking, setPeeking] = useState(false);
  const state = useRef({ open: 0, close: 0, inside: false, suppressed: false });

  useEffect(() => {
    const timers = state.current;
    return () => {
      window.clearTimeout(timers.open);
      window.clearTimeout(timers.close);
    };
  }, []);

  const onPointerEnter = useCallback(
    (event: PointerEvent) => {
      const current = state.current;
      current.inside = true;
      if (!enabled || event.pointerType !== "mouse" || current.suppressed) return;
      window.clearTimeout(current.close);
      current.open = window.setTimeout(() => setPeeking(true), OPEN_DELAY_MS);
    },
    [enabled],
  );

  const onPointerLeave = useCallback(() => {
    const current = state.current;
    current.inside = false;
    current.suppressed = false;
    window.clearTimeout(current.open);
    current.close = window.setTimeout(() => setPeeking(false), CLOSE_DELAY_MS);
  }, []);

  /** End any peek now. `suppress` keeps it closed until the pointer leaves the sidebar. */
  const stopPeek = useCallback((suppress: boolean) => {
    const current = state.current;
    window.clearTimeout(current.open);
    window.clearTimeout(current.close);
    current.suppressed = suppress && current.inside;
    setPeeking(false);
  }, []);

  return { peeking: enabled && peeking, onPointerEnter, onPointerLeave, stopPeek };
}
