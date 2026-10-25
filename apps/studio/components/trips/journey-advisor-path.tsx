"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LuCheck, LuCircle } from "react-icons/lu";

import { ContentSection } from "@/components/ui";
import { getTripBuilderReadiness } from "@/lib/api";
import {
  buildAdvisorPath,
  type AdvisorPath,
  type AdvisorPathStep,
} from "@/lib/trips/advisor-path";
import type { JourneyPageModel } from "@/lib/trips";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

function stepHref(
  step: AdvisorPathStep,
  tripId: string,
): string | null {
  if (step.hrefKind === "trip_builder") {
    return pageRoutes.tripBuilderTrip(tripId);
  }
  if (step.hrefKind === "bookings") return pageRoutes.bookings;
  if (step.hrefKind === "trip_payment") {
    return `${pageRoutes.trip(tripId)}#client-payment`;
  }
  return null;
}

/** Ordered advisor path — one current step, clear handoffs. */
export function JourneyAdvisorPath({
  journey,
}: {
  journey: JourneyPageModel;
}) {
  const [path, setPath] = useState<AdvisorPath>(journey.advisorPath);

  useEffect(() => {
    setPath(journey.advisorPath);
  }, [journey.advisorPath]);

  useEffect(() => {
    let live = true;
    void getTripBuilderReadiness(journey.id)
      .then((response) => {
        if (!live) return;
        setPath(
          buildAdvisorPath({
            status: journey.status,
            quoteFile: journey.quoteFile,
            quoteReady: journey.quoteReady,
            roomsChosen: journey.advisorPath.roomsChosen,
            staysConfirmed: journey.advisorPath.staysConfirmed,
            paymentStatus: journey.paymentStatus,
            travelPrepCount: response.data.readiness.length,
          }),
        );
      })
      .catch(() => {
        /* keep server path */
      });
    return () => {
      live = false;
    };
  }, [
    journey.id,
    journey.status,
    journey.quoteFile,
    journey.quoteReady,
    journey.paymentStatus,
    journey.advisorPath.roomsChosen,
    journey.advisorPath.staysConfirmed,
  ]);

  if (path.steps.length === 0) return null;

  return (
    <ContentSection
      title="Advisor path"
      description={
        path.progressLabel
          ? `${path.progressLabel}. Follow these steps in order.`
          : "Follow these steps in order. One current step at a time."
      }
      className="min-w-0"
    >
      <ol className="divide-y divide-border/70">
        {path.steps.map((step, index) => {
          const href = stepHref(step, journey.id);
          return (
            <li
              key={step.id}
              className={cn(
                "flex gap-3 px-5 py-3 sm:px-6",
                step.current && "bg-accent-soft/50",
              )}
            >
              <span className="mt-0.5 shrink-0" aria-hidden>
                {step.done ? (
                  <LuCheck className="h-4 w-4 text-success-ink" strokeWidth={2.5} />
                ) : (
                  <LuCircle
                    className={cn(
                      "h-4 w-4",
                      step.current ? "text-accent-ink" : "text-ink-muted",
                    )}
                    strokeWidth={2}
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.current ? "text-ink" : step.done ? "text-ink-muted" : "text-ink",
                  )}
                >
                  <span className="text-ink-muted">{index + 1}. </span>
                  {step.label}
                  {step.current ? (
                    <span className="ml-2 text-[11px] font-semibold tracking-wide text-accent-ink uppercase">
                      Now
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  {step.hint}
                </p>
                {href && (step.current || !step.done) ? (
                  <Link
                    href={href}
                    className="mt-1 inline-flex text-xs font-semibold text-ink underline-offset-2 hover:underline"
                  >
                    {step.hrefKind === "trip_builder"
                      ? "Open Trip Builder"
                      : step.hrefKind === "bookings"
                        ? "Open Bookings"
                        : "Record payment"}
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </ContentSection>
  );
}
