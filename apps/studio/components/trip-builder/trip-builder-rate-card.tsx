"use client";

import { studioFocusRing } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

/** Hotel facts already on file for these dates. Shown once above the rate cards. */
export type TripBuilderStayNotes = {
  checkIn: string | null;
  checkOut: string | null;
  payment: string[];
  offers: string[];
  required: string[];
  markup: string | null;
};

/** One rate on the agent reply. Matches the trip-builder mock, without a photo. */
export type TripBuilderRateCard = {
  id: string;
  index: number;
  recommended: boolean;
  room: string;
  board: string | null;
  price: string;
  /** How this team cost covers the stay. Null when the rate has no price rule on file. */
  priceRule: string | null;
  occupancy: string | null;
  inclusions: string[];
  cancellation: string | null;
  /** Ask for the client price, then a confirm chip saves the room. */
  onAddToOptions?: () => void;
  /** The client already picked this saved room. A confirm chip finishes it. */
  onSelect?: () => void;
};

export function TripBuilderStayNotesCard({ notes }: { notes: TripBuilderStayNotes }) {
  const times =
    notes.checkIn || notes.checkOut
      ? `Check-in ${notes.checkIn ?? "not on file"} · Check-out ${notes.checkOut ?? "not on file"}`
      : null;
  const lines = [
    times,
    notes.payment.length > 0 ? `Payment: ${notes.payment.join(" ")}` : null,
    notes.offers.length > 0 ? `Offers: ${notes.offers.join(" ")}` : null,
    notes.required.length > 0 ? `Must add: ${notes.required.join(" ")}` : null,
    notes.markup,
  ].filter((line): line is string => Boolean(line));
  if (lines.length === 0) return null;
  return (
    <div className="rounded-[10px] border border-border bg-surface-subtle px-3 py-2.5 text-[12px] leading-snug break-words text-ink">
      <p className="mb-1 text-[11px] font-bold tracking-wide text-ink-muted uppercase">
        On file for this stay
      </p>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

export function TripBuilderRateCard({
  card,
  disabled,
}: {
  card: TripBuilderRateCard;
  disabled?: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-[10px] border px-3 py-2.5 text-[13px] leading-snug break-words text-ink",
        card.recommended
          ? "border-accent bg-accent-soft"
          : "border-border bg-surface-raised",
      )}
    >
      {card.recommended ? (
        <p className="mb-1 text-[11px] font-bold tracking-wide text-accent-ink uppercase">
          Recommended
        </p>
      ) : null}
      <p className="text-[11px] font-medium text-ink-muted">Cost (team)</p>
      <p className="text-[18px] font-semibold leading-6 text-ink">{card.price}</p>
      {card.priceRule ? (
        <p className="mt-0.5 text-[12px] text-ink-muted">{card.priceRule}</p>
      ) : null}
      <p className="mt-1.5">
        <span className="font-semibold">Room: </span>
        {card.room}
        {card.board ? ` · ${card.board}` : ""}
      </p>
      {card.occupancy ? (
        <p>
          <span className="font-semibold">Occupancy: </span>
          {card.occupancy}
        </p>
      ) : null}
      {card.inclusions.length > 0 ? (
        <p>
          <span className="font-semibold">Included: </span>
          {card.inclusions.join(", ")}
        </p>
      ) : null}
      {card.cancellation ? (
        <p>
          <span className="font-semibold">Cancellation: </span>
          {card.cancellation}
        </p>
      ) : null}
      {card.onAddToOptions || card.onSelect ? (
        <div className="mt-2 flex flex-col gap-1.5 lg:flex-row lg:flex-wrap">
          {card.onAddToOptions ? (
            <button
              type="button"
              disabled={disabled}
              onClick={card.onAddToOptions}
              className={cn(
                "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-cta px-3 text-[13px] font-medium text-white hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-8 lg:w-auto",
                studioFocusRing,
              )}
            >
              Add for the client
            </button>
          ) : null}
          {card.onSelect ? (
            <button
              type="button"
              disabled={disabled}
              onClick={card.onSelect}
              className={cn(
                "inline-flex min-h-11 w-full items-center justify-center rounded-full px-3 text-[13px] font-medium lg:min-h-8 lg:w-auto",
                studioFocusRing,
                card.onAddToOptions
                  ? "bg-surface-raised text-accent-ink ring-1 ring-accent-line hover:bg-accent-soft"
                  : "bg-cta text-white hover:bg-cta-hover",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              Client chose this
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
