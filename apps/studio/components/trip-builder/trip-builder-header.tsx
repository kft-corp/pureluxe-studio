"use client";

import { LuPanelRightClose, LuPanelRightOpen, LuPlus } from "react-icons/lu";

import type { TripDetail, TripListItem } from "@/lib/trip-builder";
import { cn } from "@/lib/utils/cn";

import { TripBuilderStages } from "./trip-builder-stages";
import { TripBuilderTripsMenu } from "./trip-builder-trips-menu";
import { resolveTripStage } from "./stages";

type TripBuilderHeaderProps = {
  trips: TripListItem[];
  detail: TripDetail | null;
  summaryOpen: boolean;
  canWrite: boolean;
  busy: boolean;
  onOpenTrip: (tripId: string) => void;
  /** Clear to home draft chat — does not create a trip. */
  onNewChat: () => void;
  onToggleSummary: () => void;
};

/**
 * Cursor-style header icon:
 * - idle: transparent, dark outline
 * - active: soft fill behind the icon
 */
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
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink transition lg:h-8 lg:w-8",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active ? "bg-black/10" : "bg-transparent hover:bg-black/5",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Below the desktop breakpoint the actions sit on the first row and the
 * stage names wrap underneath, so none of them are clipped. On a wide
 * screen the stages lead and the actions sit on the right.
 * Stages stay disabled until a trip is open.
 */
export function TripBuilderHeader({
  trips,
  detail,
  summaryOpen,
  canWrite,
  busy,
  onOpenTrip,
  onNewChat,
  onToggleSummary,
}: TripBuilderHeaderProps) {
  const stage = detail ? resolveTripStage(detail) : null;
  const SummaryIcon = summaryOpen ? LuPanelRightClose : LuPanelRightOpen;
  const tripOpen = Boolean(detail);

  return (
    <header className="w-full shrink-0 border-b border-border bg-surface-raised">
      <div className="flex w-full flex-col gap-1 px-2 py-1.5 lg:flex-row lg:items-center lg:gap-3 lg:px-4 lg:py-2.5">
        <div className="order-2 min-w-0 lg:order-1 lg:flex-1">
          <TripBuilderStages current={stage} />
        </div>

        <div className="order-1 flex items-center justify-end gap-0.5 lg:order-2 lg:shrink-0">
          <HeaderIconButton
            active={summaryOpen}
            disabled={!tripOpen}
            aria-pressed={summaryOpen}
            aria-label={summaryOpen ? "Close summary" : "Open summary"}
            title={tripOpen ? "Summary" : "Summary (open a trip first)"}
            onClick={onToggleSummary}
          >
            <SummaryIcon className="size-4 lg:size-[18px]" strokeWidth={2} aria-hidden />
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
              <LuPlus className="size-4 lg:size-[18px]" strokeWidth={2} aria-hidden />
            </HeaderIconButton>
          ) : null}
        </div>
      </div>
    </header>
  );
}
