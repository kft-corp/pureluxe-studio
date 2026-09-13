"use client";

import { ContentSection, DetailField } from "@/components/ui";
import {
  displayOrDash,
  formatBookingDate,
  formatBookingDateTime,
  formatBookingStatus,
} from "@/lib/bookings";

import { bookingDetailIcons } from "./booking-detail-icons";
import { DetailFieldGrid, type DetailBooking } from "./booking-detail-shared";

type BookingPolicyPanelProps = {
  booking: DetailBooking;
};

export function BookingPolicyPanel({ booking }: BookingPolicyPanelProps) {
  const icons = bookingDetailIcons;

  return (
    <div className="min-w-0 space-y-5">
      <ContentSection
        title="Status & milestones"
        description="Where this reservation sits in its lifecycle."
        className="min-w-0"
      >
        <DetailFieldGrid>
          <DetailField
            icon={icons.status}
            label="Current status"
            value={formatBookingStatus(booking.status)}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.confirmedAt}
            label="Confirmed"
            value={formatBookingDateTime(booking.confirmed_at)}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.cancelledAt}
            label="Cancelled"
            value={formatBookingDateTime(booking.cancelled_at)}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.cancellationReason}
            label="Cancellation reason"
            value={displayOrDash(booking.cancellation_reason)}
          />
        </DetailFieldGrid>
      </ContentSection>

      <ContentSection
        title="Deadlines & policy"
        description="Cancellation windows and ticket time limits your team should watch."
        className="min-w-0"
      >
        <DetailFieldGrid>
          <DetailField
            icon={icons.cancellationDeadline}
            label="Cancellation deadline"
            value={formatBookingDate(booking.cancellation_deadline)}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.ticketTimeLimit}
            label="Ticket time limit"
            value={formatBookingDateTime(booking.ticket_time_limit)}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.cancellationPolicy}
            label="Cancellation policy"
            value={displayOrDash(booking.cancellation_policy)}
            className="sm:col-span-2"
          />
        </DetailFieldGrid>
      </ContentSection>
    </div>
  );
}
