"use client";

import { useEffect, useRef } from "react";
import {
  LuMessageSquarePlus,
  LuPanelRightClose,
  LuPanelRightOpen,
} from "react-icons/lu";

import type { TripDetail, TripListItem } from "@/lib/trip-builder";
import { studioFocusRing } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

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
  summaryOpen: boolean;
  canWrite: boolean;
  busy: boolean;
  activeLegId: string | null;
  onSelectLeg: (legId: string) => void;
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
        studioFocusRing,
        "disabled:cursor-not-allowed disabled:opacity-50",
        active ? "bg-neutral-soft" : "bg-transparent hover:bg-surface-hover",
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
    <div className="inline-flex min-w-0 shrink-0 items-center gap-1.5 text-[12px] text-ink">
      <span className="shrink-0 text-[12px] text-ink-muted">{label}</span>
      <strong className="max-w-[14rem] truncate text-[12px] font-semibold text-ink sm:max-w-[18rem]">
        {value?.trim() || "—"}
      </strong>
    </div>
  );
}

function LegPills({
  stays,
  activeLegId,
  onSelectLeg,
}: {
  stays: ReturnType<typeof tripStays>;
  activeLegId: string | null;
  onSelectLeg: (legId: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeLegId]);

  if (stays.length === 0) return null;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="shrink-0 text-[12px] text-ink-muted">Stays</span>
      {stays.map((stay) => {
        const on = stay.leg_id === activeLegId;
        return (
          <button
            key={stay.leg_id}
            ref={on ? activeRef : undefined}
            type="button"
            onClick={() => onSelectLeg(stay.leg_id)}
            aria-pressed={on}
            className={cn(
              "inline-flex min-h-8 shrink-0 items-center rounded-full border px-2.5 py-1 text-[12px] leading-none",
              studioFocusRing,
              on
                ? "border-sky-line bg-sky-soft font-semibold text-sky-ink"
                : "border-border bg-surface-raised font-medium text-ink hover:bg-surface-hover",
            )}
          >
            {legPillLabel(stay)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One line: client, dates, and stays scroll sideways on the left; the next
 * step and the actions stay fixed on the right. Below the desktop
 * breakpoint the actions take the first row and the trip details sit under.
 */
export function TripBuilderHeader({
  trips,
  detail,
  summaryOpen,
  canWrite,
  busy,
  activeLegId,
  onSelectLeg,
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
    <header className="w-full shrink-0 border-b border-border bg-surface-raised">
      <div className="flex w-full flex-col gap-1 px-2 py-1.5 lg:flex-row lg:items-center lg:gap-3 lg:px-4 lg:py-2.5">
        <div
          className={cn(
            "order-2 flex min-w-0 items-center gap-3 lg:order-1 lg:flex-1",
            !detail && "hidden lg:flex",
          )}
        >
          {detail ? (
            <>
              <div
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-3 overflow-x-auto pr-6",
                  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  "[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]",
                )}
              >
                <HeaderItem label="Client" value={detail.client?.display_name} />
                <HeaderItem label="Dates" value={dates} />
                <LegPills stays={stays} activeLegId={activeLegId} onSelectLeg={onSelectLeg} />
                {gaps.length > 0 ? (
                  <span
                    title={gaps.join(" · ")}
                    className="inline-flex shrink-0 items-center rounded-full bg-warning-soft px-2.5 py-1 text-[12px] leading-none font-medium text-warning-ink ring-1 ring-inset ring-warning-line"
                  >
                    {gaps.length === 1 ? "1 gap" : `${gaps.length} gaps`}
                  </span>
                ) : null}
              </div>
            </>
          ) : null}
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
              <LuMessageSquarePlus
                className="size-4 lg:size-[18px]"
                strokeWidth={2}
                aria-hidden
              />
            </HeaderIconButton>
          ) : null}
        </div>
      </div>
    </header>
  );
}
