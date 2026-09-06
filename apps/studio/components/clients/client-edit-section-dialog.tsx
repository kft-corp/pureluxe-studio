"use client";

import type { ClientProfile } from "@/lib/clients";

import {
  ContactForm,
  DatesForm,
  HealthForm,
  IdentityForm,
  LocationForm,
  NotesForm,
} from "./client-edit-section-forms";

export type ClientEditSection =
  | "identity"
  | "contact"
  | "location"
  | "notes"
  | "dates"
  | "health";

type ClientEditSectionDialogProps = {
  open: boolean;
  section: ClientEditSection;
  profile: ClientProfile;
  onClose: () => void;
  onSuccess: (profile: ClientProfile) => void;
};

const SECTION_FORMS = {
  identity: IdentityForm,
  contact: ContactForm,
  location: LocationForm,
  notes: NotesForm,
  dates: DatesForm,
  health: HealthForm,
} as const;

export function ClientEditSectionDialog({
  open,
  section,
  profile,
  onClose,
  onSuccess,
}: ClientEditSectionDialogProps) {
  if (!open) return null;

  const Form = SECTION_FORMS[section];

  return (
    <Form
      key={`${section}-${profile.client.id}-${profile.client.updated_at}`}
      profile={profile}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
