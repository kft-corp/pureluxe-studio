"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getTripBuilderReadiness } from "@/lib/api";
import type { TripDetail } from "@/lib/trip-builder";
import {
  buildAdvisorPath,
  type AdvisorPath,
} from "@/lib/trips/advisor-path";
import { isQuoteAccepted, isQuoteWithClient, isTripClosed } from "@/lib/trips/trip-status";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

import { staysAwaitingRoom } from "./stages";

/**
 * Banner under the header once the quote has left Trip Builder.
 * Shows the single current advisor step.
 */
export function TripBuilderStatusStrip({ detail }: { detail: TripDetail | null }) {
  const [path, setPath] = useState<AdvisorPath | null>(null);

  useEffect(() => {
    if (!detail || detail.trip.status === "building") {
      setPath(null);
      return;
    }
    const status = detail.trip.status;
    const tripDone = status === "confirmed" || status === "completed";
    const roomsChosen = staysAwaitingRoom(detail) === 0 && detail.stays.length > 0;
    // TB detail has no booking confirm flags — once the trip is confirmed, treat stays as done.
    const base = buildAdvisorPath({
      status,
      quoteFile: Boolean(detail.options_quote.document?.has_file),
      quoteReady: detail.options_quote.document?.status === "ready",
      roomsChosen: roomsChosen || tripDone,
      staysConfirmed: tripDone,
      paymentStatus: "not_started",
      travelPrepCount: 0,
    });
    setPath(base);

    if (tripDone) return;

    let live = true;
    void getTripBuilderReadiness(detail.trip.id)
      .then((response) => {
        if (!live) return;
        setPath(
          buildAdvisorPath({
            status,
            quoteFile: Boolean(detail.options_quote.document?.has_file),
            quoteReady: detail.options_quote.document?.status === "ready",
            roomsChosen,
            staysConfirmed: false,
            paymentStatus: "not_started",
            travelPrepCount: response.data.readiness.length,
          }),
        );
      })
      .catch(() => {
        /* keep base path */
      });
    return () => {
      live = false;
    };
  }, [detail]);

  if (!detail) return null;
  const message = statusNoticeMessage(detail, path);
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
        <span className="min-w-0 break-words">{message}</span>
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

/** Tells the advisor the single current step once the quote has left Trip Builder. */
function statusNoticeMessage(
  detail: TripDetail,
  path: AdvisorPath | null,
): string | null {
  const status = detail.trip.status;
  if (isTripClosed(status)) {
    return "This trip is cancelled. It is read-only.";
  }
  if (status === "confirmed" || status === "completed") {
    return "Trip ready for travel. Bookings hold the stays.";
  }
  if (path?.progressLabel) {
    const prep =
      path.travelPrepCount > 0 && isQuoteAccepted(status)
        ? ` Travel prep: ${path.travelPrepCount} item${path.travelPrepCount === 1 ? "" : "s"} to clear.`
        : "";
    return `${path.progressLabel}.${prep}`;
  }
  if (isQuoteWithClient(status)) {
    return "Quote is with the client. On the trip page, mark Client said yes when they agree — then record their room here.";
  }
  return null;
}
