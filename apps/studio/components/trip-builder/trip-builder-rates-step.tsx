"use client";

import { useState } from "react";
import { LuBadgeDollarSign } from "react-icons/lu";

import type { NormalizedRateOption } from "@pureluxe/rates";

import { studioButtonClass, studioControl } from "@/components/ui";
import type { TripRateSnapshot, TripStaySnapshot } from "@/lib/trip-builder";
import { cn } from "@/lib/utils/cn";

type TripBuilderRatesStepProps = {
  stay: TripStaySnapshot;
  selected: TripRateSnapshot | null;
  candidates: TripRateSnapshot[];
  searchOptions: NormalizedRateOption[];
  searchMessage: string | null;
  canWrite: boolean;
  busy: boolean;
  onSearch: () => void;
  onSelectOption: (option: NormalizedRateOption) => void;
  onSelectCandidate: (lineItemId: string) => void;
  onPaste: (text: string) => void;
};

function formatMoney(amount: number | null, currency: string | null) {
  if (amount == null) return "—";
  const code = currency?.trim() || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${code} ${amount}`;
  }
}

/** Phase 1 rates — search, paste, or pick a saved candidate. */
export function TripBuilderRatesStep({
  stay,
  selected,
  candidates,
  searchOptions,
  searchMessage,
  canWrite,
  busy,
  onSearch,
  onSelectOption,
  onSelectCandidate,
  onPaste,
}: TripBuilderRatesStepProps) {
  const [pasteText, setPasteText] = useState("");

  return (
    <section className="rounded-xl border border-border bg-surface-raised p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-muted">
          <LuBadgeDollarSign className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">Find a rate</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Search for {stay.property_name || "this hotel"} in {stay.city}, or
            paste a hotel quote. Selecting a rate moves the trip to Package.
          </p>

          {selected ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
              <p className="text-[11px] font-semibold tracking-wide text-emerald-900 uppercase">
                Selected
              </p>
              <p className="mt-1 text-sm font-medium text-ink">
                {selected.title}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {formatMoney(selected.cost_internal, selected.currency)}
                {selected.rate_source_code
                  ? ` · ${selected.rate_source_code.replaceAll("_", " ")}`
                  : ""}
              </p>
            </div>
          ) : null}

          {canWrite ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onSearch}
                className={studioButtonClass("primary", "md")}
              >
                Search rates
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-muted">
              You can view rates, but selecting needs write access.
            </p>
          )}

          {searchMessage && searchOptions.length === 0 ? (
            <p className="mt-3 text-xs text-ink-muted">{searchMessage}</p>
          ) : null}

          {searchOptions.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {searchOptions.map((option, index) => (
                <li key={`${option.rate_source_code}-${index}`}>
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-ink">
                        {option.property_name || stay.property_name || "Rate"}
                        {option.room_name ? ` · ${option.room_name}` : ""}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        {formatMoney(option.cost_internal, option.currency)}
                        {option.board ? ` · ${option.board}` : ""}
                        {option.recommended ? " · Recommended" : ""}
                      </p>
                    </div>
                    {canWrite ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onSelectOption(option)}
                        className={studioButtonClass("secondary", "sm", "shrink-0")}
                      >
                        Use
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {candidates.filter((row) => !row.selected).length > 0 ? (
            <div className="mt-5">
              <p className="text-[11px] font-semibold tracking-wide text-ink-subtle uppercase">
                Saved on trip
              </p>
              <ul className="mt-2 space-y-2">
                {candidates
                  .filter((row) => !row.selected)
                  .map((row) => (
                    <li key={row.id}>
                      <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-ink">
                            {row.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-ink-muted">
                            {formatMoney(row.cost_internal, row.currency)}
                            {` · ${row.status.replaceAll("_", " ")}`}
                          </p>
                        </div>
                        {canWrite ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onSelectCandidate(row.id)}
                            className={studioButtonClass(
                              "secondary",
                              "sm",
                              "shrink-0",
                            )}
                          >
                            Select
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          {canWrite ? (
            <div className="mt-5">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
                  Paste hotel quote
                </span>
                <textarea
                  rows={3}
                  value={pasteText}
                  disabled={busy}
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder="Paste the hotel email or quote text…"
                  className={cn(studioControl.field, "min-h-[4.5rem] px-3 py-2")}
                />
              </label>
              <button
                type="button"
                disabled={busy || !pasteText.trim()}
                onClick={() => {
                  const text = pasteText.trim();
                  if (!text) return;
                  onPaste(text);
                  setPasteText("");
                }}
                className={studioButtonClass("secondary", "md", "mt-2")}
              >
                Paste & select
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
