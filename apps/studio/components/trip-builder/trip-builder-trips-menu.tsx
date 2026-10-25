"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LuFolderOpen } from "react-icons/lu";

import { formatRelativeTime } from "@/lib/team/format-relative-time";
import type { TripListItem } from "@/lib/trip-builder";
import {
  displayTripSubtitle,
  displayTripTitle,
  tripTitleInitial,
} from "@/lib/trip-builder/trip/trip-title";
import { studioFocusRing } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

type TripBuilderTripsMenuProps = {
  trips: TripListItem[];
  activeTripId: string | null;
  onSelect: (tripId: string) => void;
  disabled?: boolean;
};

/** Assigned trips switcher — fills dark only while the menu is open. */
export function TripBuilderTripsMenu({
  trips,
  activeTripId,
  onSelect,
  disabled,
}: TripBuilderTripsMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  function placeMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuBox({
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }
    placeMenu();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onScroll(event: Event) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const active = trips.find((trip) => trip.id === activeTripId);
  const tooltip = active
    ? `Switch trip · ${displayTripTitle(active)}`
    : "Switch trip";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Switch trip"
        title={tooltip}
        onClick={toggleMenu}
        className={cn(
          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink transition lg:h-8 lg:w-8",
          studioFocusRing,
          "disabled:cursor-not-allowed disabled:opacity-50",
          open ? "bg-neutral-soft" : "bg-transparent hover:bg-surface-hover",
        )}
      >
        <LuFolderOpen className="size-4 lg:size-[18px]" strokeWidth={2} aria-hidden />
      </button>

      {open && menuBox ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Trips"
          style={{ top: menuBox.top, right: menuBox.right }}
          className="fixed z-50 w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-[13px] font-medium text-ink">Trips</p>
          </div>

          {trips.length === 0 ? (
            <p className="px-3 py-5 text-[13px] text-ink-muted">
              No assigned trips yet. Tell the agent who a trip is for to start one.
            </p>
          ) : (
            <ul className="max-h-[min(24rem,calc(100dvh-7rem))] overflow-y-auto py-1">
              {trips.map((trip) => {
                const selected = trip.id === activeTripId;
                const subtitle = displayTripSubtitle(trip);
                return (
                  <li key={trip.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onSelect(trip.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-start gap-2.5 px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-l-2 border-l-sky-ink bg-sky-soft pl-[10px]"
                          : "border-l-2 border-l-transparent hover:bg-surface-hover",
                      )}
                    >
                      <span
                        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-avatar text-[11px] font-semibold text-avatar-ink"
                        aria-hidden
                      >
                        {tripTitleInitial(trip)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">
                          {displayTripTitle(trip)}
                        </span>
                        {subtitle ? (
                          <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
                            {subtitle}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 pt-0.5 text-[10px] text-ink-subtle">
                        {formatRelativeTime(trip.updated_at)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
