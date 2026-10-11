"use client";

import type { TripDetail } from "@/lib/trip-builder";
import { cn } from "@/lib/utils/cn";

import {
  formatStayDates,
  formatTripDates,
  legPillLabel,
  resolveNextStep,
  stayGapNotes,
  tripStays,
} from "./stages";

type TripBuilderStatusStripProps = {
  detail: TripDetail | null;
  activeLegId: string | null;
  onSelectLeg: (legId: string) => void;
};

/**
 * Secondary header — client, trip dates, and one pill per stay.
 * On a wide screen the stays sit beside the dates. On a phone they
 * stay on their own row. Hotel and sell stay in the summary.
 */
export function TripBuilderStatusStrip({
  detail,
  activeLegId,
  onSelectLeg,
}: TripBuilderStatusStripProps) {
  if (!detail) return null;

  const stays = tripStays(detail);
  const dates =
    formatStayDates(detail.trip.starts_on, detail.trip.ends_on) ??
    formatTripDates(stays);
  const next = resolveNextStep(detail);
  const gaps = stayGapNotes(stays);

  return (
    <div
      className="flex shrink-0 flex-col gap-1 border-b border-border bg-surface px-2 py-2 sm:px-4"
      aria-label="Trip status"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StripItem label="Client" value={detail.client?.display_name} />
        <StripItem label="Dates" value={dates} />
        <LegPills
          stays={stays}
          activeLegId={activeLegId}
          onSelectLeg={onSelectLeg}
          className="hidden min-w-0 lg:flex"
        />
        <div className="w-fit max-w-full rounded-full bg-[#f7f1e6] px-2.5 py-1 text-[11px] leading-snug font-semibold break-words text-[#5c4a32] sm:ml-auto sm:max-w-[16rem] lg:max-w-none">
          Next: {next}
        </div>
      </div>
      <LegPills
        stays={stays}
        activeLegId={activeLegId}
        onSelectLeg={onSelectLeg}
        className="lg:hidden"
      />
      {gaps.length > 0 ? (
        <p className="text-[11px] leading-snug break-words text-ink-muted">{gaps.join(" · ")}</p>
      ) : null}
    </div>
  );
}

function LegPills({
  stays,
  activeLegId,
  onSelectLeg,
  className,
}: {
  stays: ReturnType<typeof tripStays>;
  activeLegId: string | null;
  onSelectLeg: (legId: string) => void;
  className?: string;
}) {
  if (stays.length === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <span className="shrink-0 text-[10px] tracking-wide text-ink-muted uppercase">
        Legs
      </span>
      {stays.map((stay) => {
        const on = stay.leg_id === activeLegId;
        return (
          <button
            key={stay.leg_id}
            type="button"
            onClick={() => onSelectLeg(stay.leg_id)}
            aria-pressed={on}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center rounded-md border px-2.5 text-[12px] leading-none lg:min-h-8 lg:rounded-full lg:py-1",
              on
                ? "border-[#1a4d3e] bg-[#e8f2ee] font-semibold text-[#1a4d3e]"
                : "border-border bg-white font-medium text-ink hover:bg-[#faf9f7]",
            )}
          >
            {legPillLabel(stay)}
          </button>
        );
      })}
    </div>
  );
}

function StripItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="inline-flex min-w-0 shrink-0 items-center gap-1.5 text-[12px] text-ink">
      <span className="shrink-0 text-[10px] tracking-wide text-ink-muted uppercase">
        {label}
      </span>
      <strong className="max-w-[14rem] truncate text-[12px] font-semibold text-ink sm:max-w-[18rem]">
        {value?.trim() || "—"}
      </strong>
    </div>
  );
}
