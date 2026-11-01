"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { studioFocusRing } from "@/components/ui";
import { sidebarCopy } from "@/config/page-copy";
import { listJourneyCards, type JourneyCardItem } from "@/lib/api/trips";
import { formatBookingDate } from "@/lib/bookings";
import { formatJourneyRoute } from "@/lib/trips";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

type SidebarRecentTripsProps = {
  compact: boolean;
  onNavigate?: () => void;
};

function tripCue(journey: JourneyCardItem): { primary: string; secondary: string | null } {
  const route = formatJourneyRoute(journey.destinations);
  const client = journey.client?.display_name?.trim() || null;
  const primary = route || journey.title?.trim() || client || "Untitled trip";
  const dates =
    journey.starts_on && journey.ends_on
      ? `${formatBookingDate(journey.starts_on)} – ${formatBookingDate(journey.ends_on)}`
      : journey.starts_on
        ? formatBookingDate(journey.starts_on)
        : null;
  const secondary = [client && route ? client : null, dates].filter(Boolean).join(" · ");
  return { primary, secondary: secondary || null };
}

/** Up to three of the advisor's trips — destination · dates under Search. */
export function SidebarRecentTrips({ compact, onNavigate }: SidebarRecentTripsProps) {
  const [trips, setTrips] = useState<JourneyCardItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listJourneyCards({ limit: 3, scope: "mine" })
      .then((data) => {
        if (!cancelled) setTrips(data.journeys.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setTrips([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (compact || trips.length === 0) return null;

  return (
    <div className="studio-nav-reveal pt-1">
      <p className="mb-1.5 truncate px-2.5 text-[12px] font-semibold tracking-[0.04em] text-nav-label">
        {sidebarCopy.recent}
      </p>
      <ul className="space-y-0.5">
        {trips.map((trip) => {
          const cue = tripCue(trip);
          return (
            <li key={trip.id}>
              <Link
                href={pageRoutes.trip(trip.id)}
                onClick={onNavigate}
                className={cn(
                  "block rounded-lg px-2.5 py-2 transition-colors hover:bg-nav-hover",
                  studioFocusRing,
                )}
              >
                <span className="block truncate text-[13px] font-semibold text-nav-ink-strong">
                  {cue.primary}
                </span>
                {cue.secondary ? (
                  <span className="mt-0.5 block truncate text-[12px] text-nav-muted">
                    {cue.secondary}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
