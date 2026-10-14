"use client";

import { ContentSection, DetailField } from "@/components/ui";
import {
  displayOrDash,
  formatBookingMoney,
  formatBookingSource,
  tripBuilderOwnsStay,
  type BookingTripCommercial,
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
  trip: BookingTripCommercial | null;
  canWrite: boolean;
  onEditSection: (section: BookingEditSection) => void;
};

function stayTaxLabel(booking: DetailBooking): string {
  const percent = booking.tax_percentage;
  const cost = booking.cost_amount;
  if (percent == null || cost == null) return "Not set";
  const tax = (cost * percent) / 100;
  const formatted = formatBookingMoney(tax, booking.currency);
  const percentLabel = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(percent);
  return `${formatted} (${percentLabel}%)`;
}

export function BookingCommercialPanel({
  booking,
  trip,
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
        description={
          trip
            ? "Supplier cost is for this stay. The client price and trip margin stay on the trip."
            : "Studio-only pricing captured at the time of booking."
        }
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
            label={trip ? "Trip client price" : "Sell price"}
            value={
              trip
                ? formatBookingMoney(trip.sell_total, trip.sell_currency)
                : formatBookingMoney(booking.sell_amount, booking.currency)
            }
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.supplierCost}
            label="Supplier cost"
            value={formatBookingMoney(booking.cost_amount, booking.currency)}
            className="sm:border-b sm:border-border/70"
          />
          {trip ? (
            <DetailField
              icon={icons.supplierCost}
              label="Tax"
              value={stayTaxLabel(booking)}
              className="sm:border-b sm:border-border/70"
            />
          ) : null}
          {trip ? (
            <DetailField
              icon={icons.sellPrice}
              label="Trip margin"
              value={formatBookingMoney(trip.margin_internal, trip.sell_currency)}
              className="sm:border-b sm:border-border/70"
            />
          ) : null}
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
            label={trip ? "Cost currency" : "Currency"}
            value={displayOrDash(booking.currency?.toUpperCase())}
          />
        </DetailFieldGrid>
        {trip ? (
          <p className="mt-3 text-xs leading-5 text-ink-muted">
            {booking.tax_percentage == null
              ? "Tax is not set on this stay. Trip margin is the client price minus the hotel net."
              : "Tax is the stored percent on top of this stay's hotel net. Trip margin subtracts tax only when every priced stay has a tax percent."}
            {tripBuilderOwnsStay(booking)
              ? " Confirm the booking before changing this cost in Bookings."
              : ""}
            {trip.pricing_locked
              ? " The client accepted this price. Change the client price or a pending cost in Trip Builder."
              : ""}
          </p>
        ) : null}
      </ContentSection>
    </div>
  );
}
