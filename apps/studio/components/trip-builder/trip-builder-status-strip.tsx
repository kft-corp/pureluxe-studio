"use client";

import type { TripDetail } from "@/lib/trip-builder";

import { formatStayDates, resolveNextStep } from "./trip-stages";

type TripBuilderStatusStripProps = {
  detail: TripDetail | null;
};

function StripPart({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1">
      <span className="shrink-0 text-[10px] font-semibold tracking-wide text-ink-subtle uppercase">
        {label}
      </span>
      <span className="truncate text-xs text-ink">
        {value?.trim() || "—"}
      </span>
    </span>
  );
}

/** Client · dates · hotel · Next: … */
export function TripBuilderStatusStrip({ detail }: TripBuilderStatusStripProps) {
  if (!detail) return null;

  const dates = formatStayDates(detail.stay?.check_in, detail.stay?.check_out);
  const hotel = detail.stay?.property_name;
  const next = resolveNextStep(detail);

  return (
    <div className="shrink-0 border-b border-border/80 bg-[linear-gradient(180deg,var(--surface-raised)_0%,var(--surface)_100%)] px-3 py-2 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <StripPart label="Client" value={detail.client?.display_name} />
        <StripPart label="Dates" value={dates} />
        <StripPart label="Hotel" value={hotel} />
        <p className="min-w-0 text-xs font-medium text-ink">
          <span className="text-ink-muted">Next:</span> {next}
        </p>
      </div>
    </div>
  );
}
