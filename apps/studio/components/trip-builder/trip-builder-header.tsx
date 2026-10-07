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
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink transition sm:h-8 sm:w-8",
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
 * Header layout (LTR):
 * Stages · … · Summary · Latest trips · New chat
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
    <header className="w-full shrink-0 border-b border-border bg-surface-raised px-3 py-2.5 sm:px-4">
      <div className="flex w-full items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 overflow-hidden">
          <TripBuilderStages current={stage} />
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <HeaderIconButton
            active={summaryOpen}
            disabled={!tripOpen}
            aria-pressed={summaryOpen}
            aria-label={summaryOpen ? "Close summary" : "Open summary"}
            title={tripOpen ? "Summary" : "Summary (open a trip first)"}
            onClick={onToggleSummary}
          >
            <SummaryIcon className="size-[18px]" strokeWidth={2} aria-hidden />
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
              <LuPlus className="size-[18px]" strokeWidth={2} aria-hidden />
            </HeaderIconButton>
          ) : null}
        </div>
      </div>
    </header>
  );
}
