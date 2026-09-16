"use client";

import { useState, type ReactNode } from "react";
import { LuChevronRight, LuLock } from "react-icons/lu";
import type { IconType } from "react-icons";

import { ActionButton, DETAIL_EMPTY_VALUE } from "@/components/ui";
import type { BookingDetail } from "@/lib/bookings";
import {
  bookingDurationLabel,
  formatBookingDate,
  formatBookingMoney,
  formatBookingServiceType,
  formatTripLinked,
  resolveBookingDeadline,
} from "@/lib/bookings";
import { cn } from "@/lib/utils/cn";

export type DetailBooking = BookingDetail["booking"];

/** Soft cap before nested lists scroll. */
export const BOOKING_UI_LIST_SCROLL_CLASS =
  "max-h-[min(28rem,60vh)] overflow-y-auto overscroll-contain";

export const NOTE_PREVIEW_CHARS = 280;
export const SERVICE_DETAIL_PREVIEW_COUNT = 8;

export function SectionEditButton({
  canWrite,
  onClick,
}: {
  canWrite: boolean;
  onClick: () => void;
}) {
  if (!canWrite) return null;
  return <ActionButton onClick={onClick}>Edit</ActionButton>;
}

export function ListEmpty({ message }: { message: string }) {
  return (
    <p className="px-5 py-6 text-sm text-ink-muted sm:px-6">{message}</p>
  );
}

export function ScrollRegion({
  children,
  className,
  enabled = true,
}: {
  children: ReactNode;
  className?: string;
  enabled?: boolean;
}) {
  if (!enabled) return <div className={className}>{children}</div>;
  return (
    <div className={cn(BOOKING_UI_LIST_SCROLL_CLASS, className)}>{children}</div>
  );
}

export function JumpCard({
  title,
  summary,
  icon: Icon,
  onClick,
}: {
  title: string;
  summary: string;
  icon?: IconType;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface-raised px-3.5 py-3 text-left shadow-sm transition hover:bg-brand-light/50 sm:px-4 sm:py-3.5"
    >
      {Icon ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-ink-muted sm:h-10 sm:w-10">
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p
          className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-muted"
          title={summary}
        >
          {summary}
        </p>
      </div>
      <LuChevronRight
        className="h-4 w-4 shrink-0 text-ink-muted"
        aria-hidden
      />
    </button>
  );
}

export function ExpandableNote({
  title,
  body,
  locked = false,
}: {
  title: string;
  body: string | null | undefined;
  locked?: boolean;
}) {
  const text = body?.trim() ?? "";
  const needsCollapse = text.length > NOTE_PREVIEW_CHARS;
  const [expanded, setExpanded] = useState(false);
  const shown =
    needsCollapse && !expanded
      ? `${text.slice(0, NOTE_PREVIEW_CHARS).trimEnd()}…`
      : text || DETAIL_EMPTY_VALUE;

  return (
    <div className="border-t border-border/70 px-5 py-4 sm:px-6">
      <div className="flex items-center gap-2">
        {locked ? (
          <LuLock className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
        ) : null}
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          {title}
        </p>
      </div>
      <p
        className={cn(
          "mt-2 max-w-prose wrap-break-word whitespace-pre-wrap text-sm leading-relaxed",
          text ? "text-ink" : "text-ink-subtle",
        )}
      >
        {shown}
      </p>
      {needsCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-xs font-semibold text-ink-muted transition hover:text-ink"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}

export function DetailFieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border/70 sm:grid sm:grid-cols-2 sm:divide-y-0">
      {children}
    </div>
  );
}

/** Soft row borders for DetailField grids (2-col from sm). */
export function detailFieldClass(index: number, total: number): string | undefined {
  if (total % 2 === 1 && index === total - 1) return "sm:col-span-2";
  const lastRowStart = total % 2 === 0 ? total - 2 : total - 1;
  if (index < lastRowStart) return "sm:border-b sm:border-border/70";
  return undefined;
}

export function locationLine(
  city: string | null,
  country: string | null,
): string {
  const parts = [city?.trim(), country?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : DETAIL_EMPTY_VALUE;
}

export function datesLine(
  start: string | null,
  end: string | null,
  nights: number | null,
  serviceType?: string,
): { value: string; hint?: string } {
  const startLabel = formatBookingDate(start);
  const endLabel = formatBookingDate(end);
  if (startLabel === "—" && endLabel === "—") {
    return { value: DETAIL_EMPTY_VALUE };
  }
  return {
    value: `${startLabel} → ${endLabel}`,
    hint:
      bookingDurationLabel({
        startDate: start,
        endDate: end,
        nights,
        serviceType,
      }) ?? undefined,
  };
}

export function deadlineHint(
  kind: "cancel" | "ticket" | null,
): string | undefined {
  if (kind === "ticket") return "Ticket deadline";
  if (kind === "cancel") return "Cancellation deadline";
  return undefined;
}

export function travellersSummary(count: number): string {
  if (count === 0) return "No travellers added yet";
  if (count === 1) return "1 traveller on this reservation";
  return `${count} travellers on this reservation`;
}

export function commercialSummary(booking: DetailBooking): string {
  const sell = formatBookingMoney(booking.sell_amount, booking.currency);
  const ref = booking.supplier_ref?.trim();
  if (sell !== "—" && ref) return `${sell} · Ref ${ref}`;
  if (sell !== "—") return sell;
  if (ref) return `Ref ${ref}`;
  return "No commercial details yet";
}

export function policySummary(booking: DetailBooking): string {
  const deadline = resolveBookingDeadline(
    booking.cancellation_deadline,
    booking.ticket_time_limit,
  );
  if (deadline.kind && deadline.label !== "—") {
    const label = deadline.kind === "ticket" ? "Ticket due" : "Cancel by";
    return `${label} ${deadline.label}`;
  }
  return "No active deadlines";
}

export function notesSummary(booking: DetailBooking): string {
  if (booking.internal_notes?.trim()) return "Internal notes on file";
  return "No notes recorded";
}

export function serviceSubtitle(booking: DetailBooking): string {
  const place = locationLine(booking.city, booking.country);
  const duration = bookingDurationLabel({
    startDate: booking.start_date,
    endDate: booking.end_date,
    nights: booking.nights,
    serviceType: booking.service_type,
  });
  const parts = [
    formatBookingServiceType(booking.service_type),
    place !== DETAIL_EMPTY_VALUE ? place : null,
    duration,
  ].filter((item): item is string => Boolean(item));
  return parts.join(" · ");
}

export function clientTripLine(booking: DetailBooking): string {
  const client = booking.client?.display_name ?? "No client linked";
  const trip = formatTripLinked(booking.trip_id);
  const owner = booking.relationship_owner?.name ?? "Unassigned owner";
  return `${client} · ${trip} · ${owner}`;
}

export function truncateMiddle(value: string, max = 36): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  const keep = Math.floor((max - 1) / 2);
  return `${trimmed.slice(0, keep)}…${trimmed.slice(-keep)}`;
}
