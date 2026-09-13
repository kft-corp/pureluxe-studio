"use client";

import Link from "next/link";
import { useState } from "react";
import { LuArrowLeft, LuCheck, LuPencil } from "react-icons/lu";

import { PageStack, PageToolbar, SnapshotCard, studioButtonClass } from "@/components/ui";
import type { BookingDetail } from "@/lib/bookings";
import {
  displayOrDash,
  formatBookingMoney,
  formatBookingStatus,
  resolveBookingDeadline,
} from "@/lib/bookings";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

import { BookingActivityPanel } from "./booking-activity-panel";
import { BookingCommercialPanel } from "./booking-commercial-panel";
import { bookingServiceIcon } from "./booking-detail-icons";
import {
  clientTripLine,
  datesLine,
  deadlineHint,
  serviceSubtitle,
  truncateMiddle,
} from "./booking-detail-shared";
import {
  BookingDetailTabs,
  type BookingDetailTab,
} from "./booking-detail-tabs";
import { BookingNotesPanel } from "./booking-notes-panel";
import { BookingOverviewPanel } from "./booking-overview-panel";
import { BookingPolicyPanel } from "./booking-policy-panel";
import { BookingStatusPill, BookingVipBadge } from "./booking-status-pill";
import { BookingTravellersPanel } from "./booking-travellers-panel";

type BookingDetailContentProps = {
  detail: BookingDetail;
};

/** Read-only booking detail — hero, snapshot strip, and tabbed sections. */
export function BookingDetailContent({ detail }: BookingDetailContentProps) {
  const [activeTab, setActiveTab] = useState<BookingDetailTab>("overview");
  const { booking, travellers, recent_audit: recentAudit } = detail;

  const ServiceIcon = bookingServiceIcon(booking.service_type);
  const deadline = resolveBookingDeadline(
    booking.cancellation_deadline,
    booking.ticket_time_limit,
  );
  const stay = datesLine(booking.start_date, booking.end_date, booking.nights);
  const sellLabel = formatBookingMoney(booking.sell_amount, booking.currency);
  const refLabel = displayOrDash(booking.supplier_ref);
  const needsConfirm =
    booking.status === "pending" || booking.status === "on_hold";

  return (
    <PageStack className="min-w-0">
      <div>
        <Link
          href={pageRoutes.bookings}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-ink"
        >
          <LuArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          All bookings
        </Link>
      </div>

      <PageToolbar className="min-w-0 overflow-hidden bg-[linear-gradient(180deg,var(--surface-raised)_0%,var(--surface)_100%)]">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-ink shadow-sm sm:h-16 sm:w-16">
              <ServiceIcon
                className="h-5 w-5 sm:h-7 sm:w-7"
                strokeWidth={1.5}
                aria-hidden
              />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="max-w-full wrap-break-word font-serif text-xl font-medium tracking-tight text-ink sm:text-3xl">
                  {booking.title}
                </h2>
                <BookingStatusPill status={booking.status} />
                {booking.vip_flag ? <BookingVipBadge /> : null}
              </div>

              <p className="mt-1 wrap-break-word text-sm text-ink-muted">
                {serviceSubtitle(booking)}
              </p>

              <p className="mt-2 wrap-break-word text-sm text-ink-muted">
                {clientTripLine(booking)}
              </p>

              {refLabel !== "—" ? (
                <p className="mt-2 max-w-full text-xs text-ink-muted">
                  Confirmation ref{" "}
                  <span
                    className="inline-block max-w-full wrap-break-word font-mono font-medium text-ink"
                    title={refLabel}
                  >
                    {truncateMiddle(refLabel, 42)}
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-pretty text-xs font-medium text-amber-800">
                  Missing supplier reference — add one when you confirm.
                </p>
              )}
            </div>
          </div>

          <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:w-auto lg:shrink-0">
            <button
              type="button"
              disabled
              title="Confirm booking — available in the next release."
              className={cn(
                studioButtonClass(
                  needsConfirm ? "success" : "secondary",
                  "sm",
                ),
                "w-full justify-center opacity-60 sm:w-auto",
              )}
            >
              <LuCheck className="h-3.5 w-3.5" aria-hidden />
              Confirm booking
            </button>
            <button
              type="button"
              disabled
              title="Edit booking — available in the next release."
              className={cn(
                studioButtonClass("secondary", "sm"),
                "w-full justify-center opacity-60 sm:w-auto",
              )}
            >
              <LuPencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SnapshotCard
            label="Travel dates"
            value={stay.value}
            hint={stay.hint}
          />
          <SnapshotCard
            label="Status"
            value={formatBookingStatus(booking.status)}
            hint={
              needsConfirm ? "Awaiting confirmation" : "Current lifecycle stage"
            }
          />
          <SnapshotCard
            label="Next deadline"
            value={deadline.label}
            hint={deadlineHint(deadline.kind)}
          />
          <SnapshotCard
            label="Sell price"
            value={sellLabel}
            hint={
              booking.currency?.trim().toUpperCase() || "Commercial snapshot"
            }
          />
        </div>
      </PageToolbar>

      <BookingDetailTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{
          travellers: travellers.length,
          activity: recentAudit.length,
        }}
      />

      <div
        role="tabpanel"
        aria-label={`${activeTab} section`}
        className="min-w-0"
      >
        {activeTab === "overview" ? (
          <BookingOverviewPanel
            booking={booking}
            travellerCount={travellers.length}
            activityCount={recentAudit.length}
            onOpenTab={setActiveTab}
          />
        ) : null}
        {activeTab === "travellers" ? (
          <BookingTravellersPanel travellers={travellers} />
        ) : null}
        {activeTab === "commercial" ? (
          <BookingCommercialPanel booking={booking} />
        ) : null}
        {activeTab === "policy" ? (
          <BookingPolicyPanel booking={booking} />
        ) : null}
        {activeTab === "notes" ? (
          <BookingNotesPanel booking={booking} />
        ) : null}
        {activeTab === "activity" ? (
          <BookingActivityPanel booking={booking} recentAudit={recentAudit} />
        ) : null}
      </div>
    </PageStack>
  );
}
