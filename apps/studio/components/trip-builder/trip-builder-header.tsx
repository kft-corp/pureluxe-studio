"use client";

import { LuPanelRightClose, LuPanelRightOpen, LuPlus } from "react-icons/lu";

import type { TripDetail, TripListItem } from "@/lib/trip-builder";
import { cn } from "@/lib/utils/cn";

import { TripBuilderStages } from "./trip-builder-stages";
import { TripBuilderTripsMenu } from "./trip-builder-trips-menu";
import { resolveTripStage } from "./trip-stages";

type TripBuilderHeaderProps = {
  trips: TripListItem[];
  detail: TripDetail | null;
  summaryOpen: boolean;
  canWrite: boolean;
  busy: boolean;
  onOpenTrip: (tripId: string) => void;
  onNewTrip: () => void;
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
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink transition",
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
 * Stages · … · Summary · Latest trips · New trip
 */
export function TripBuilderHeader({
  trips,
  detail,
  summaryOpen,
  canWrite,
  busy,
  onOpenTrip,
  onNewTrip,
  onToggleSummary,
}: TripBuilderHeaderProps) {
  const stage = resolveTripStage(detail);
  const SummaryIcon = summaryOpen ? LuPanelRightClose : LuPanelRightOpen;

  return (
    <header className="w-full shrink-0 border-b border-border bg-surface-raised px-3 py-2.5 sm:px-4">
      <div className="flex w-full items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 overflow-hidden">
          <TripBuilderStages current={stage} />
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <HeaderIconButton
            active={summaryOpen}
            aria-pressed={summaryOpen}
            aria-label={summaryOpen ? "Close summary" : "Open summary"}
            title="Summary"
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
              aria-label="New trip"
              title="New trip"
              onClick={onNewTrip}
            >
              <LuPlus className="size-[18px]" strokeWidth={2} aria-hidden />
            </HeaderIconButton>
          ) : null}
        </div>
      </div>
    </header>
  );
}
