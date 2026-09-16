"use client";

import Link from "next/link";
import { useState } from "react";

import { parseBookingServiceDetails } from "@pureluxe/shared";

import { ContentSection, DETAIL_EMPTY_VALUE, DetailField } from "@/components/ui";
import {
  displayOrDash,
  formatBookingCount,
  formatBookingServiceType,
  formatBookingSource,
  formatFlightRoute,
  listServiceDetailFields,
  resolveServiceTimingCards,
} from "@/lib/bookings";
import { pageRoutes } from "@/lib/routes";

import {
  bookingDetailIcons,
  bookingServiceIcon,
  bookingSourceIcon,
  serviceTimingIcon,
} from "./booking-detail-icons";
import type { BookingEditSection } from "./booking-edit-section-dialog";
import type { BookingDetailTab } from "./booking-detail-tabs";
import {
  DetailFieldGrid,
  JumpCard,
  ListEmpty,
  SERVICE_DETAIL_PREVIEW_COUNT,
  ScrollRegion,
  SectionEditButton,
  commercialSummary,
  datesLine,
  detailFieldClass,
  locationLine,
  notesSummary,
  policySummary,
  travellersSummary,
  type DetailBooking,
} from "./booking-detail-shared";

type BookingOverviewPanelProps = {
  booking: DetailBooking;
  travellerCount: number;
  canWrite: boolean;
  onOpenTab: (tab: BookingDetailTab) => void;
  onEditSection: (section: BookingEditSection) => void;
};

function serviceDetailsSectionTitle(serviceType: string): string {
  switch (serviceType) {
    case "hotel":
      return "Stay details";
    case "flight":
      return "Flight details";
    case "transfer":
      return "Transfer details";
    case "activity":
      return "Activity details";
    default:
      return "Service details";
  }
}

function serviceDetailsSectionDescription(serviceType: string): string {
  switch (serviceType) {
    case "hotel":
      return "Check-in and check-out times, room, and board — stored on this reservation.";
    case "flight":
      return "Segments, departure and arrival times, and ticketing details.";
    case "transfer":
      return "Pickup and drop-off times, locations, and vehicle details.";
    case "activity":
      return "Start and end times, meeting point, and voucher details.";
    default:
      return "Type-specific timing and service information.";
  }
}

function flightRouteFromDetails(
  serviceDetails: DetailBooking["service_details"],
): string | null {
  const parsed = parseBookingServiceDetails("flight", serviceDetails ?? {});
  if (parsed.serviceType !== "flight") return null;
  const first = parsed.details.segments?.[0];
  if (!first) return null;
  return formatFlightRoute(first.from, first.to);
}

export function BookingOverviewPanel({
  booking,
  travellerCount,
  canWrite,
  onOpenTab,
  onEditSection,
}: BookingOverviewPanelProps) {
  const [showAllDetails, setShowAllDetails] = useState(false);
  const isHotel = booking.service_type === "hotel";
  const isFlight = booking.service_type === "flight";
  const place = locationLine(booking.city, booking.country);
  const stay = datesLine(
    booking.start_date,
    booking.end_date,
    booking.nights,
    booking.service_type,
  );
  const flightRoute = isFlight
    ? flightRouteFromDetails(booking.service_details) ||
      displayOrDash(booking.title)
    : null;
  const icons = bookingDetailIcons;
  const timingCards = resolveServiceTimingCards({
    serviceType: booking.service_type,
    startDate: booking.start_date,
    endDate: booking.end_date,
    supplierRef: booking.supplier_ref,
    serviceDetails: booking.service_details,
  });
  const detailFields = listServiceDetailFields(
    booking.service_type,
    booking.service_details,
  );
  const hasMoreDetails = detailFields.length > SERVICE_DETAIL_PREVIEW_COUNT;
  const visibleDetails = showAllDetails
    ? detailFields
    : detailFields.slice(0, SERVICE_DETAIL_PREVIEW_COUNT);

  return (
    <div className="min-w-0 space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <JumpCard
          title="Travellers"
          summary={travellersSummary(travellerCount)}
          icon={icons.travellers}
          onClick={() => onOpenTab("travellers")}
        />
        <JumpCard
          title="Commercial"
          summary={commercialSummary(booking)}
          icon={icons.commercial}
          onClick={() => onOpenTab("commercial")}
        />
        <JumpCard
          title="Policy & deadlines"
          summary={policySummary(booking)}
          icon={icons.policy}
          onClick={() => onOpenTab("policy")}
        />
        <JumpCard
          title="Notes"
          summary={notesSummary(booking)}
          icon={icons.notes}
          onClick={() => onOpenTab("notes")}
        />
      </div>

      <ContentSection
        title="Schedule"
        description="Service dates from the ledger, with times from service details when available."
      >
        <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-3 sm:px-6">
          {timingCards.map((card) => {
            const Icon = serviceTimingIcon(card.icon, booking.service_type);
            return (
              <div
                key={card.key}
                className="flex min-w-0 items-start gap-3 rounded-xl border border-border/80 bg-surface px-3.5 py-3 sm:px-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-ink-muted">
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
                    {card.label}
                  </p>
                  <p
                    className="mt-1 line-clamp-2 wrap-break-word text-sm font-semibold leading-snug text-ink"
                    title={card.value}
                  >
                    {card.value}
                  </p>
                  {card.hint ? (
                    <p
                      className="mt-0.5 line-clamp-2 wrap-break-word text-xs text-ink-muted"
                      title={card.hint}
                    >
                      {card.hint}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </ContentSection>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ContentSection
          title="Reservation"
          description="Core service details for this booking."
          className="min-w-0"
          action={
            <SectionEditButton
              canWrite={canWrite}
              onClick={() => onEditSection("reservation")}
            />
          }
        >
          <DetailFieldGrid>
            <DetailField
              icon={bookingServiceIcon(booking.service_type)}
              label="Service type"
              value={formatBookingServiceType(booking.service_type)}
              className="sm:border-b sm:border-border/70"
            />
            {isFlight ? (
              <DetailField
                icon={icons.property}
                label="Route"
                value={flightRoute ?? DETAIL_EMPTY_VALUE}
                className="sm:border-b sm:border-border/70"
              />
            ) : (
              <DetailField
                icon={icons.property}
                label="Property"
                value={displayOrDash(booking.hotel_name)}
                className="sm:border-b sm:border-border/70"
              />
            )}
            {!isFlight ? (
              <DetailField
                icon={icons.location}
                label="Location"
                value={place}
                className="sm:border-b sm:border-border/70"
              />
            ) : null}
            {isHotel ? (
              <DetailField
                icon={icons.chain}
                label="Chain"
                value={displayOrDash(booking.chain)}
                className="sm:border-b sm:border-border/70"
              />
            ) : null}
            <DetailField
              icon={icons.travelDates}
              label={isFlight ? "Flight dates" : "Travel dates"}
              value={stay.value}
              badge={stay.hint}
              className="sm:border-b sm:border-border/70"
            />
            {isHotel ? (
              <DetailField
                icon={icons.rooms}
                label="Rooms"
                value={formatBookingCount(booking.num_rooms)}
                className="sm:border-b sm:border-border/70"
              />
            ) : null}
            <DetailField
              icon={icons.partySize}
              label="Party size"
              value={
                booking.num_adults == null && booking.num_children == null
                  ? DETAIL_EMPTY_VALUE
                  : `${formatBookingCount(booking.num_adults)} adults · ${formatBookingCount(booking.num_children)} children`
              }
              className="sm:col-span-2"
            />
          </DetailFieldGrid>
        </ContentSection>

        <ContentSection
          title="Context"
          description="Who this reservation is for and where it came from."
          className="min-w-0"
          action={
            <SectionEditButton
              canWrite={canWrite}
              onClick={() => onEditSection("context")}
            />
          }
        >
          <DetailFieldGrid>
            <DetailField
              icon={icons.client}
              label="Client"
              value={booking.client?.display_name ?? DETAIL_EMPTY_VALUE}
              href={
                booking.client ? pageRoutes.client(booking.client.id) : null
              }
              className="sm:col-span-2 sm:border-b sm:border-border/70"
            />
            <DetailField
              icon={icons.trip}
              label="Trip"
              value={
                booking.trip_id ? "Linked to a trip" : "Not linked to a trip"
              }
              className="sm:border-b sm:border-border/70"
            />
            <DetailField
              icon={icons.accountOwner}
              label="Account owner"
              value={displayOrDash(booking.relationship_owner?.name)}
              className="sm:border-b sm:border-border/70"
            />
            <DetailField
              icon={bookingSourceIcon(booking.source)}
              label="Source"
              value={formatBookingSource(booking.source)}
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
      </div>

      <ContentSection
        title={serviceDetailsSectionTitle(booking.service_type)}
        description={serviceDetailsSectionDescription(booking.service_type)}
        count={detailFields.length > 0 ? detailFields.length : undefined}
        action={
          <SectionEditButton
            canWrite={canWrite}
            onClick={() => onEditSection("service_details")}
          />
        }
      >
        {detailFields.length > 0 ? (
          <>
            <ScrollRegion enabled={visibleDetails.length > 6}>
              <DetailFieldGrid>
                {visibleDetails.map((fieldRow, index) => (
                  <DetailField
                    key={fieldRow.key}
                    icon={icons.serviceDetails}
                    label={fieldRow.label}
                    value={fieldRow.value}
                    className={detailFieldClass(index, visibleDetails.length)}
                  />
                ))}
              </DetailFieldGrid>
            </ScrollRegion>
            {hasMoreDetails ? (
              <div className="border-t border-border/70 px-5 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={() => setShowAllDetails((value) => !value)}
                  className="text-xs font-semibold text-ink-muted transition hover:text-ink"
                >
                  {showAllDetails
                    ? "Show fewer details"
                    : `Show all ${detailFields.length} details`}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <ListEmpty message="No timing or service details recorded yet. Use Edit to add check-in times, room type, and other service fields." />
        )}
      </ContentSection>
    </div>
  );
}
