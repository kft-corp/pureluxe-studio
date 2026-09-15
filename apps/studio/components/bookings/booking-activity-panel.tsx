"use client";

import Link from "next/link";
import { LuHistory } from "react-icons/lu";

import { ContentSection, DETAIL_EMPTY_VALUE, DetailField } from "@/components/ui";
import type { BookingAuditLog } from "@pureluxe/db";
import {
  formatBookingAuditAction,
  formatBookingDateTime,
  formatTripLinked,
} from "@/lib/bookings";
import { pageRoutes } from "@/lib/routes";

import { bookingDetailIcons } from "./booking-detail-icons";
import {
  DetailFieldGrid,
  ListEmpty,
  type DetailBooking,
} from "./booking-detail-shared";

type BookingActivityPanelProps = {
  booking: DetailBooking;
  recentAudit: BookingAuditLog[];
};

function performedByLabel(value: string): string {
  if (value === "team") return "Studio team";
  if (value === "client") return "Client app";
  if (value === "system") return "System";
  return value;
}

export function BookingActivityPanel({
  booking,
  recentAudit,
}: BookingActivityPanelProps) {
  const icons = bookingDetailIcons;

  return (
    <div className="min-w-0 space-y-5">
      <ContentSection
        title="Related records"
        description="Quick links to the client and trip this booking belongs to."
        className="min-w-0"
      >
        <DetailFieldGrid>
          <DetailField
            icon={icons.client}
            label="Client"
            value={booking.client?.display_name ?? DETAIL_EMPTY_VALUE}
            href={
              booking.client ? pageRoutes.client(booking.client.id) : null
            }
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.trip}
            label="Trip"
            value={formatTripLinked(booking.trip_id)}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.bookingId}
            label="Booking ID"
            value={booking.id}
            mono
            className="sm:col-span-2"
          />
        </DetailFieldGrid>
        {booking.client ? (
          <div className="border-t border-border/70 px-5 py-3 sm:px-6">
            <Link
              href={pageRoutes.client(booking.client.id)}
              className="text-xs font-semibold text-ink-muted underline-offset-2 transition hover:text-ink hover:underline"
            >
              Open client profile
            </Link>
          </div>
        ) : null}
      </ContentSection>

      <ContentSection
        title="Recent activity"
        description="Status, pricing, and ownership changes recorded for this booking."
        count={recentAudit.length}
        className="min-w-0"
      >
        {recentAudit.length > 0 ? (
          <ul className="divide-y divide-border/80">
              {recentAudit.map((entry) => {
                const actionLabel = formatBookingAuditAction(
                  entry.action,
                  entry.field_name,
                );
                return (
                  <li
                    key={entry.id}
                    className="flex gap-3 px-5 py-3.5 sm:px-6"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-ink-muted">
                      <LuHistory
                        className="h-4 w-4"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="wrap-break-word text-sm font-semibold text-ink"
                        title={actionLabel}
                      >
                        {actionLabel}
                      </p>
                      <p className="mt-0.5 wrap-break-word text-xs text-ink-muted">
                        {formatBookingDateTime(entry.created_at)}
                        {entry.performed_by
                          ? ` · ${performedByLabel(entry.performed_by)}`
                          : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
          </ul>
        ) : (
          <ListEmpty message="No activity has been logged for this booking yet." />
        )}
      </ContentSection>
    </div>
  );
}
