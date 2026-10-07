"use client";

import { LuX } from "react-icons/lu";

import { studioButtonClass } from "@/components/ui";
import type { TripDetail } from "@/lib/trip-builder";

import { formatStayDates, resolveNextStep } from "./stages";

type TripBuilderSummaryPanelProps = {
  detail: TripDetail | null;
  open: boolean;
  onClose: () => void;
};

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-ink-subtle uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm text-ink">{value?.trim() || "—"}</p>
    </div>
  );
}

/**
 * Optional peek — sits beside chat, below the trip header/status strip
 * (matches prototype `.cols > .right`). Never covers those headers.
 */
export function TripBuilderSummaryPanel({
  detail,
  open,
  onClose,
}: TripBuilderSummaryPanelProps) {
  if (!open) return null;

  return (
    <>
      {/* Mobile scrim — only over the chat/composer row, not the trip header */}
      <button
        type="button"
        className="absolute inset-0 z-20 bg-brand-dark/25 backdrop-blur-[1px] lg:hidden"
        aria-label="Close summary"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 z-30 flex w-[min(22rem,100%)] flex-col border-l border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-xl lg:static lg:z-0 lg:w-80 lg:shrink-0 lg:pb-0 lg:shadow-none">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-ink-subtle uppercase">
              Optional
            </p>
            <h2 className="text-sm font-semibold text-ink">Summary</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={studioButtonClass("ghost", "sm", "h-10 w-10 !px-0 sm:h-8 sm:w-8")}
            aria-label="Close summary"
          >
            <LuX className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {!detail ? (
            <p className="text-xs leading-relaxed text-ink-muted">
              Open or start a trip to see client, stay, and quote details here.
            </p>
          ) : (
            <>
              <section className="space-y-4">
                <Row label="Client" value={detail.client?.display_name} />
                <Row
                  label="Dates"
                  value={formatStayDates(
                    detail.stay?.check_in,
                    detail.stay?.check_out,
                  )}
                />
                <Row label="Hotel" value={detail.stay?.property_name} />
                <Row label="City" value={detail.stay?.city} />
                <Row
                  label="Status"
                  value={detail.trip.status.replaceAll("_", " ")}
                />
                <Row
                  label="Pricing"
                  value={detail.pricing_locked ? "Locked" : "Open"}
                />
                <Row
                  label="Selected rate"
                  value={
                    detail.rates.selected
                      ? `${detail.rates.selected.title}${
                          detail.rates.selected.cost_internal != null
                            ? ` · ${detail.rates.selected.currency ?? ""} ${detail.rates.selected.cost_internal}`
                            : ""
                        }`
                      : null
                  }
                />
              </section>

              <div className="rounded-lg border border-border bg-surface-raised px-3 py-3">
                <p className="text-[11px] font-semibold tracking-wide text-ink-subtle uppercase">
                  Next
                </p>
                <p className="mt-1 text-xs font-medium text-ink">
                  {resolveNextStep(detail)}
                </p>
              </div>

              <p className="text-[11px] leading-relaxed text-ink-subtle">
                Build in chat — confirm client, stay, rates, and PDF with chips.
              </p>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
