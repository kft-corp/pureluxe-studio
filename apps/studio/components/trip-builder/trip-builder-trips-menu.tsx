"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LuHistory } from "react-icons/lu";

import { formatRelativeTime } from "@/lib/team/format-relative-time";
import type { TripListItem } from "@/lib/trip-builder";
import { cn } from "@/lib/utils/cn";

type TripBuilderTripsMenuProps = {
  trips: TripListItem[];
  activeTripId: string | null;
  onSelect: (tripId: string) => void;
  disabled?: boolean;
};

function tripTitle(trip: TripListItem) {
  return trip.title?.trim() || trip.client_display_name || "Untitled trip";
}

/** Assigned trips switcher — fills dark only while the menu is open. */
export function TripBuilderTripsMenu({
  trips,
  activeTripId,
  onSelect,
  disabled,
}: TripBuilderTripsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

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

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const active = trips.find((trip) => trip.id === activeTripId);
  const tooltip = active
    ? `Latest trips · ${tripTitle(active)}`
    : "Latest trips";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Latest trips"
        title={tooltip}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open ? "bg-black/10" : "bg-transparent hover:bg-black/5",
        )}
      >
        <LuHistory className="size-[18px]" strokeWidth={2} aria-hidden />
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Assigned trips"
          className="absolute top-full right-0 z-40 mt-1.5 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="text-[11px] font-semibold tracking-wide text-ink-subtle uppercase">
              Latest trips
            </p>
          </div>

          {trips.length === 0 ? (
            <p className="px-3 py-4 text-xs text-ink-muted">
              No assigned trips yet. Start with New trip.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {trips.map((trip) => {
                const selected = trip.id === activeTripId;
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
                        "flex w-full items-start gap-2 px-3 py-2.5 text-left transition",
                        selected
                          ? "bg-surface-hover"
                          : "hover:bg-surface-hover",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-ink">
                          {tripTitle(trip)}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
                          {trip.client_display_name ?? "No client yet"}
                          {trip.last_studio_message_preview
                            ? ` · ${trip.last_studio_message_preview}`
                            : ""}
                        </span>
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
