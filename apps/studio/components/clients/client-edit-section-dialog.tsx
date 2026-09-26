"use client";

import type { ClientProfile, RelationshipOwnerOption } from "@/lib/clients";

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
  ownerOptions?: RelationshipOwnerOption[];
  onClose: () => void;
  onSuccess: (profile: ClientProfile) => void;
};

const SECTION_FORMS = {
  identity: IdentityForm,
  location: LocationForm,
  notes: NotesForm,
  dates: DatesForm,
  health: HealthForm,
} as const;

export function ClientEditSectionDialog({
  open,
  section,
  profile,
  ownerOptions,
  onClose,
  onSuccess,
}: ClientEditSectionDialogProps) {
  if (!open) return null;

  if (section === "contact") {
    return (
      <ContactForm
        key={`contact-${profile.client.id}-${profile.client.updated_at}`}
        profile={profile}
        ownerOptions={ownerOptions}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );
  }

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
