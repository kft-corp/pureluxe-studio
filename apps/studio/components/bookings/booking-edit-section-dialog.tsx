"use client";

import type { BookingDetail } from "@/lib/bookings";

import {
  CommercialForm,
  ContextForm,
  NotesForm,
  PolicyForm,
  ReservationForm,
  ServiceDetailsForm,
} from "./booking-edit-section-forms";

export type BookingEditSection =
  | "reservation"
  | "commercial"
  | "policy"
  | "notes"
  | "service_details"
  | "context";

type BookingEditSectionDialogProps = {
  open: boolean;
  section: BookingEditSection;
  detail: BookingDetail;
  ownerOptions?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSuccess: (detail: BookingDetail) => void;
  onAssignOwner?: (ownerId: string | null) => Promise<void>;
  onLinkTrip?: (tripId: string | null) => Promise<void>;
  actionLoading?: boolean;
};

const SECTION_FORMS = {
  reservation: ReservationForm,
  commercial: CommercialForm,
  policy: PolicyForm,
  notes: NotesForm,
  service_details: ServiceDetailsForm,
} as const;

export function BookingEditSectionDialog({
  open,
  section,
  detail,
  ownerOptions = [],
  onClose,
  onSuccess,
  onAssignOwner,
  onLinkTrip,
  actionLoading = false,
}: BookingEditSectionDialogProps) {
  if (!open) return null;

  if (section === "context") {
    return (
      <ContextForm
        key={`context-${detail.booking.id}-${detail.booking.updated_at}`}
        detail={detail}
        ownerOptions={ownerOptions}
        loading={actionLoading}
        onClose={onClose}
        onAssignOwner={onAssignOwner}
        onLinkTrip={onLinkTrip}
      />
    );
  }

  const Form = SECTION_FORMS[section];

  return (
    <Form
      key={`${section}-${detail.booking.id}-${detail.booking.updated_at}`}
      detail={detail}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
