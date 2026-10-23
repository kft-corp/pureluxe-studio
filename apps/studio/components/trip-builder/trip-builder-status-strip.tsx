"use client";

import Link from "next/link";

import type { TripDetail } from "@/lib/trip-builder";
import { isQuoteAccepted, isQuoteWithClient, isTripClosed } from "@/lib/trips/trip-status";
import { formatTripStatus } from "@/lib/trips/journey-format";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

import { staysAwaitingRoom } from "./stages";

/**
 * Banner under the header once the quote has left Trip Builder.
 * Renders nothing while the trip is still being built.
 */
export function TripBuilderStatusStrip({ detail }: { detail: TripDetail | null }) {
  if (!detail) return null;
  const message = statusNoticeMessage(detail);
  if (!message) return null;

  return (
    <div className="shrink-0 border-b border-border bg-surface-raised px-2 py-1.5 sm:px-4">
      <p
        role="status"
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-2.5 py-1.5 text-[12px] leading-snug",
          isTripClosed(detail.trip.status)
            ? "bg-neutral-soft text-neutral-ink"
            : "bg-warning-soft text-warning-ink",
        )}
      >
        <span className="min-w-0">{message}</span>
        <Link
          href={pageRoutes.trip(detail.trip.id)}
          className="shrink-0 font-semibold underline underline-offset-2"
        >
          Open trip page
        </Link>
      </p>
    </div>
  );
}

/** Tells the advisor what an edit does once the quote has left Trip Builder. */
function statusNoticeMessage(detail: TripDetail): string | null {
  const status = detail.trip.status;
  const unchosen = staysAwaitingRoom(detail) > 0;
  return isTripClosed(status)
    ? "This trip is cancelled. It is read-only."
    : isQuoteAccepted(status)
      ? unchosen
        ? "The client accepted this quote. Tap Client chose this on the room they picked for each stay, then check today's price before booking."
        : "The client accepted this quote. Check availability and today's price before you book. You can update the team cost or the client price on the chosen room here."
      : isQuoteWithClient(status)
        ? `${formatTripStatus(status)}. The client has the options quote. Changing the trip makes it out of date and moves the trip back to Building.`
        : null;
}
