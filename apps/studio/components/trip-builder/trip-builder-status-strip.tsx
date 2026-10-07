"use client";

import type { TripDetail } from "@/lib/trip-builder";

import { formatStayDates, resolveNextStep } from "./stages";

type TripBuilderStatusStripProps = {
  detail: TripDetail | null;
};

function moneyLabel(amount: number | null, currency: string | null) {
  if (amount == null) return null;
  const code = currency?.trim() || "";
  return code ? `${code} ${amount}` : String(amount);
}

/** Matches mockup `.status-strip` — facts scroll on mobile, Next stays visible. */
export function TripBuilderStatusStrip({ detail }: TripBuilderStatusStripProps) {
  if (!detail) return null;

  const dates = formatStayDates(detail.stay?.check_in, detail.stay?.check_out);
  const hotel = detail.stay?.property_name?.trim() || null;
  const sell = moneyLabel(detail.quote.sell_total, detail.quote.sell_currency);
  const next = resolveNextStep(detail);

  return (
    <div
      className="flex shrink-0 items-stretch gap-2 border-b border-border bg-surface px-2 py-2 sm:gap-3 sm:px-4"
      aria-label="Trip status"
    >
      <div className="flex min-w-0 flex-1 items-center gap-x-3 gap-y-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <StripItem label="Client" value={detail.client?.display_name} />
        <StripItem label="Dates" value={dates} />
        <StripItem label="Hotel" value={hotel} />
        <StripItem label="Sell" value={sell} />
      </div>
      <div className="flex shrink-0 items-center">
        <div className="max-w-[9.5rem] truncate rounded-full bg-[#f7f1e6] px-2.5 py-1 text-[11px] font-semibold text-[#5c4a32] sm:max-w-none">
          Next: {next}
        </div>
      </div>
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
      <strong className="max-w-[7rem] truncate text-[12px] font-semibold text-ink sm:max-w-[12rem]">
        {value?.trim() || "—"}
      </strong>
    </div>
  );
}
