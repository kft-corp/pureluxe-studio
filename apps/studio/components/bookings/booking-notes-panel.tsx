"use client";

import Link from "next/link";

import { ContentSection, DETAIL_EMPTY_VALUE, DetailField } from "@/components/ui";
import { displayOrDash } from "@/lib/bookings";
import { pageRoutes } from "@/lib/routes";

import type { BookingEditSection } from "./booking-edit-section-dialog";
import { bookingDetailIcons } from "./booking-detail-icons";
import {
  DetailFieldGrid,
  ExpandableNote,
  SectionEditButton,
  type DetailBooking,
} from "./booking-detail-shared";

type BookingNotesPanelProps = {
  booking: DetailBooking;
  canWrite: boolean;
  onEditSection: (section: BookingEditSection) => void;
};

/**
 * Notes tab — Studio internal only for now.
 * Guest-facing block (visibility, special occasion, guest notes) is deferred
 * until the Client App ships — see docs/studio/booking_deferred_fks.md.
 */
export function BookingNotesPanel({
  booking,
  canWrite,
  onEditSection,
}: BookingNotesPanelProps) {
  const icons = bookingDetailIcons;

  return (
    <div className="min-w-0 space-y-5">
      <ContentSection
        title="Internal"
        description="Studio-only context for advisors and operations."
        className="min-w-0"
        action={
          <SectionEditButton
            canWrite={canWrite}
            onClick={() => onEditSection("notes")}
          />
        }
      >
        <DetailFieldGrid>
          <DetailField
            icon={icons.accountOwner}
            label="Account owner"
            value={displayOrDash(booking.relationship_owner?.name)}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.bookedBy}
            label="Booked by"
            value={displayOrDash(booking.booked_by?.name)}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.confirmationFile}
            label="Confirmation file"
            value={displayOrDash(booking.confirmation_file_path)}
            mono
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={icons.amendedFrom}
            label="Amended from"
            value={
              booking.amended_from_id
                ? "Previous booking version"
                : DETAIL_EMPTY_VALUE
            }
            href={
              booking.amended_from_id
                ? pageRoutes.booking(booking.amended_from_id)
                : null
            }
            className="sm:border-b sm:border-border/70"
          />
        </DetailFieldGrid>
        <ExpandableNote
          title="Internal notes"
          body={booking.internal_notes}
          locked={!canWrite}
        />
        {booking.amended_from_id ? (
          <div className="border-t border-border/70 px-5 py-3 sm:px-6">
            <Link
              href={pageRoutes.booking(booking.amended_from_id)}
              className="text-xs font-semibold text-ink-muted underline-offset-2 transition hover:text-ink hover:underline"
            >
              View previous version
            </Link>
          </div>
        ) : null}
      </ContentSection>
    </div>
  );
}
