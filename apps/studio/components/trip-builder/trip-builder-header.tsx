"use client";

import {
  LuMessageSquarePlus,
  LuPanelRightClose,
  LuPanelRightOpen,
} from "react-icons/lu";

import type { TripDetail, TripListItem } from "@/lib/trip-builder";
import { studioFocusRing } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

import { AgentPurivaMark } from "./agent-puriva-mark";
import { TripBuilderTripsMenu } from "./trip-builder-trips-menu";
import {
  formatStayDates,
  formatTripDates,
  legPillLabel,
  stayGapNotes,
  tripStays,
} from "./stages";

type TripBuilderHeaderProps = {
  trips: TripListItem[];
  detail: TripDetail | null;
  /** False on empty desk — Puriva lives in the chat hero until chat starts. */
  conversationStarted: boolean;
  summaryOpen: boolean;
  canWrite: boolean;
  busy: boolean;
  onOpenTrip: (tripId: string) => void;
  /** Clear to home draft chat — does not create a trip. */
  onNewChat: () => void;
  onToggleSummary: () => void;
};

/** Quiet travel-desk icon — thin stroke, soft ink, light accent hover. */
function HeaderIconButton({
  active = false,
  disabled,
  title,
  "aria-label": ariaLabel,
  "aria-pressed": ariaPressed,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  "aria-label": string;
  "aria-pressed"?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted transition lg:h-8 lg:w-8",
        studioFocusRing,
        "disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-accent-soft/60 text-ink"
          : "bg-transparent hover:bg-accent-soft/40 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function HeaderItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="inline-flex min-w-0 shrink-0 items-baseline gap-2">
      <span className="studio-type-eyebrow shrink-0 uppercase text-ink-subtle">
        {label}
      </span>
      <strong className="max-w-[14rem] truncate font-serif text-[0.95rem] leading-none font-semibold tracking-[-0.01em] text-ink sm:max-w-[18rem] sm:text-[1.05rem]">
        {value?.trim() || "—"}
      </strong>
    </div>
  );
}

/** Stay chips are display-only — switching legs from the header caused wrong quote/rate attach. */
function LegPills({ stays }: { stays: ReturnType<typeof tripStays> }) {
  if (stays.length === 0) return null;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="studio-type-eyebrow shrink-0 uppercase text-ink-subtle">
        Stays
      </span>
      {stays.map((stay) => (
        <span
          key={stay.leg_id}
          className="inline-flex min-h-7 shrink-0 items-center rounded-full border border-border/80 bg-surface-raised/80 px-2.5 py-1 text-[12px] leading-none font-medium text-ink"
        >
          {legPillLabel(stay)}
        </span>
      ))}
    </div>
  );
}

/**
 * Puriva left after chat starts; Dates + stay chips as before (no client — summary has it).
 */
export function TripBuilderHeader({
  trips,
  detail,
  conversationStarted,
  summaryOpen,
  canWrite,
  busy,
  onOpenTrip,
  onNewChat,
  onToggleSummary,
}: TripBuilderHeaderProps) {
  const SummaryIcon = summaryOpen ? LuPanelRightClose : LuPanelRightOpen;
  const tripOpen = Boolean(detail);
  const stays = detail ? tripStays(detail) : [];
  const gaps = stayGapNotes(stays);
  const dates = detail
    ? (formatStayDates(detail.trip.starts_on, detail.trip.ends_on) ??
      formatTripDates(stays))
    : null;

  return (
    <header className="relative z-40 w-full shrink-0 border-b border-border/50 bg-linear-to-r from-surface-raised via-surface-raised to-accent-soft/25">
      <div className="flex w-full flex-col gap-1 px-2 py-1.5 sm:px-3 lg:flex-row lg:items-center lg:gap-3 lg:px-4 lg:py-2.5">
        <div
          className={cn(
            "order-2 flex min-w-0 items-center gap-3 lg:order-1 lg:flex-1",
            !detail && !conversationStarted && "hidden lg:flex",
          )}
        >
          {conversationStarted ? (
            <div className="shrink-0">
              <AgentPurivaMark size="xs" />
              <span
                className="mt-1 block h-px w-8 bg-accent opacity-70"
                aria-hidden
              />
            </div>
          ) : null}

          {detail ? (
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center gap-3 overflow-x-auto overscroll-x-contain pr-6",
                "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                "[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]",
              )}
            >
              <HeaderItem label="Dates" value={dates} />
              <LegPills stays={stays} />
              {gaps.length > 0 ? (
                <span
                  title={gaps.join(" · ")}
                  className="inline-flex shrink-0 items-center rounded-full bg-warning-soft px-2.5 py-1 text-[12px] leading-none font-medium text-warning-ink ring-1 ring-inset ring-warning-line"
                >
                  {gaps.length === 1 ? "1 gap" : `${gaps.length} gaps`}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="order-1 flex min-w-0 items-center justify-end gap-2 lg:order-2 lg:shrink-0">
          <div className="flex shrink-0 items-center gap-0.5">
            <HeaderIconButton
              active={summaryOpen}
              disabled={!tripOpen}
              aria-pressed={summaryOpen}
              aria-label={summaryOpen ? "Close summary" : "Open summary"}
              title={tripOpen ? "Summary" : "Summary (open a trip first)"}
              onClick={onToggleSummary}
            >
              <SummaryIcon className="size-4 lg:size-[17px]" strokeWidth={1.5} aria-hidden />
            </HeaderIconButton>

            <TripBuilderTripsMenu
              trips={trips}
              activeTripId={detail?.trip.id ?? null}
              onSelect={onOpenTrip}
              disabled={busy}
            />

            {canWrite ? (
              <HeaderIconButton
                disabled={busy}
                aria-label="New chat"
                title="New chat"
                onClick={onNewChat}
              >
                <LuMessageSquarePlus
                  className="size-4 lg:size-[17px]"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </HeaderIconButton>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
