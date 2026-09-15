"use client";

import { ContentSection, DetailField } from "@/components/ui";
import {
  displayOrDash,
  formatBookingMoney,
  formatBookingSource,
} from "@/lib/bookings";

import type { BookingEditSection } from "./booking-edit-section-dialog";
import {
  bookingDetailIcons,
  bookingSourceIcon,
} from "./booking-detail-icons";
import {
  DetailFieldGrid,
  SectionEditButton,
  type DetailBooking,
} from "./booking-detail-shared";

type BookingCommercialPanelProps = {
  booking: DetailBooking;
  canWrite: boolean;
  onEditSection: (section: BookingEditSection) => void;
};

export function BookingCommercialPanel({
  booking,
  canWrite,
  onEditSection,
}: BookingCommercialPanelProps) {
  const icons = bookingDetailIcons;

  return (
    <div className="min-w-0 space-y-5">
      <ContentSection
        title="Supplier"
        description="Who holds the inventory and how the reservation was placed."
        className="min-w-0"
        action={
          <SectionEditButton
            canWrite={canWrite}
            onClick={() => onEditSection("commercial")}
          />
        }
      >
        <DetailFieldGrid>
          <DetailField
            icon={icons.supplier}
            label="Supplier"
            value={displayOrDash(booking.supplier_name)}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.confirmationRef}
            label="Confirmation / PNR"
            value={displayOrDash(booking.supplier_ref)}
            mono
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.bookingChannel}
            label="Booking channel"
            value={displayOrDash(booking.booking_channel)}
          />
          <DetailField
            icon={bookingSourceIcon(booking.source)}
            label="Created via"
            value={formatBookingSource(booking.source)}
          />
        </DetailFieldGrid>
      </ContentSection>

      <ContentSection
        title="Commercial snapshot"
        description="Studio-only pricing captured at the time of booking."
        className="min-w-0"
        action={
          <SectionEditButton
            canWrite={canWrite}
            onClick={() => onEditSection("commercial")}
          />
        }
      >
        <DetailFieldGrid>
          <DetailField
            icon={icons.sellPrice}
            label="Sell price"
            value={formatBookingMoney(booking.sell_amount, booking.currency)}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.supplierCost}
            label="Supplier cost"
            value={formatBookingMoney(booking.cost_amount, booking.currency)}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.commission}
            label="Expected commission"
            value={formatBookingMoney(
              booking.commission_expected,
              booking.currency,
            )}
          />
          <DetailField
            icon={icons.currency}
            label="Currency"
            value={displayOrDash(booking.currency?.toUpperCase())}
          />
        </DetailFieldGrid>
      </ContentSection>
    </div>
  );
}
