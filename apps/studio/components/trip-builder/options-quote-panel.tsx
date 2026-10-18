"use client";

import { studioButtonClass } from "@/components/ui";
import type { TripDetail, TripRateSnapshot, TripStaySnapshot } from "@/lib/trip-builder";
import { isQuoteAccepted, isQuoteWithClient } from "@/lib/trips/trip-status";
import { cn } from "@/lib/utils/cn";

type OptionsQuotePanelProps = {
  detail: TripDetail;
  stays: TripStaySnapshot[];
  canWrite: boolean;
  canChoose: boolean;
  busy: boolean;
  onOpen: () => void;
  onRegenerate: () => void;
  onChoose: (lineItemId: string) => void;
};

function moneyLabel(amount: number | null, currency: string | null): string {
  if (amount == null) return "To be confirmed";
  const code = currency?.trim() || "";
  return code ? `${code} ${amount}` : String(amount);
}

export function OptionsQuotePanel({
  detail,
  stays,
  canWrite,
  canChoose,
  busy,
  onOpen,
  onRegenerate,
  onChoose,
}: OptionsQuotePanelProps) {
  const candidates = detail.rates.candidates;
  const options = candidates.filter(
    (row) =>
      !row.selected ||
      candidates.some((other) => !other.selected && other.leg_id === row.leg_id),
  );
  const hasRoom = candidates.length > 0;
  const status = detail.options_quote.document?.status;
  const hasFile = Boolean(detail.options_quote.document?.has_file);
  const ready = status === "ready" && hasFile;
  const stale = status === "stale";
  const accepted = isQuoteAccepted(detail.trip.status);
  const withClient = isQuoteWithClient(detail.trip.status);
  if (options.length === 0 && !hasFile && !hasRoom) return null;

  return (
    <section className="mb-3">
      <h3 className="mb-1 text-[10px] font-medium tracking-[0.05em] text-ink-muted uppercase">
        Options for the client
      </h3>
      <p className="mb-2 text-[12px] leading-relaxed text-ink-muted">
        {accepted
          ? options.length > 0
            ? "The client accepted this quote. Tap Client chose this on the room they picked. Its client price from the quote becomes the trip price."
            : "The client accepted this quote. It opens as sent. To change it, reopen the quote on the trip page."
          : withClient
            ? "This quote is with the client. Changing or regenerating it moves the trip back to Building."
            : options.length > 0
            ? "Tap Client chose this only after the client has picked. The other rooms come off and a pending booking is created."
            : "Open or regenerate the options quote to check the rooms saved on this trip."}
      </p>
      <div className="space-y-2">
        {options.map((row) => (
          <OptionRow
            key={row.id}
            row={row}
            stays={stays}
            canWrite={canChoose && (!detail.pricing_locked || row.sell_amount != null)}
            busy={busy}
            onChoose={onChoose}
          />
        ))}
      </div>
      {detail.options_quote.notes?.trim() ? (
        <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
          Note: {detail.options_quote.notes.trim()}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-between rounded-[10px] border border-border bg-surface-raised px-2.5 py-2.5">
        <strong className="text-[12px] text-ink">Options quote PDF</strong>
        <span className={cn("text-[11px] font-semibold", ready ? "text-success-ink" : stale ? "text-warning-ink" : "text-ink-muted")}>
          {ready ? "Ready" : stale ? "Out of date" : "Not generated"}
        </span>
      </div>
      <button
        type="button"
        disabled={busy || (!hasFile && !hasRoom)}
        onClick={onOpen}
        className={cn(studioButtonClass("secondary", "sm"), "mt-1.5 h-11 w-full lg:h-8")}
      >
        Open options quote
      </button>
      {canWrite && hasRoom && !accepted ? (
        <button
          type="button"
          disabled={busy}
          onClick={onRegenerate}
          className={cn(studioButtonClass("primary", "sm"), "mt-1.5 h-11 w-full lg:h-8")}
        >
          Regenerate options quote
        </button>
      ) : null}
    </section>
  );
}

function OptionRow({
  row,
  stays,
  canWrite,
  busy,
  onChoose,
}: {
  row: TripRateSnapshot;
  stays: TripStaySnapshot[];
  canWrite: boolean;
  busy: boolean;
  onChoose: (lineItemId: string) => void;
}) {
  const stay = stays.find((item) => item.leg_id === row.leg_id);
  const hotel = row.property_name?.trim() || stay?.city || "Hotel";
  const room = row.subtitle?.trim() || row.title;
  const team = moneyLabel(row.cost_internal, row.currency);
  return (
    <div className="rounded-[10px] border border-border bg-surface-raised px-2.5 py-2">
      <p className="text-[12px] font-semibold text-ink">{hotel}</p>
      <p className="text-[12px] text-ink-muted">{room}</p>
      <p className="mt-1 text-[12px] text-ink">Team cost {team}</p>
      <p className="text-[12px] text-ink">
        Client price {moneyLabel(row.sell_amount, row.currency)}
      </p>
      {row.selected ? (
        <p className="mt-1 text-[11px] font-semibold text-success-ink">Client&apos;s current choice</p>
      ) : canWrite ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onChoose(row.id)}
          className={cn(studioButtonClass("secondary", "sm"), "mt-1.5 h-11 w-full lg:h-8 lg:w-auto")}
        >
          Client chose this
        </button>
      ) : null}
    </div>
  );
}
