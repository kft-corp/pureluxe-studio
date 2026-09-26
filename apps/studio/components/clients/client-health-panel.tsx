"use client";

import { LuHeartPulse, LuPhone, LuShield } from "react-icons/lu";

import {
  ContentSection,
  DETAIL_EMPTY_VALUE,
  DetailField,
  EmptyState,
} from "@/components/ui";
import { displayOrDash, formatDietaryLine } from "@/lib/clients";
import { formatPhoneDisplay, phoneDigitsForHref } from "@pureluxe/shared";

import type { ClientEditSection } from "./client-edit-section-dialog";
import {
  NoteBlock,
  type ProfileClient,
  SectionEditButton,
} from "./client-profile-shared";

export function ClientHealthPanel({
  client,
  canWrite,
  onEditSection,
}: {
  client: ProfileClient;
  canWrite: boolean;
  onEditSection: (section: ClientEditSection) => void;
}) {
  const health = client.health_profile;

  return (
    <ContentSection
      title="Health & accessibility"
      description="Dietary needs and mobility details for hotels — handle with care."
      action={
        <SectionEditButton
          canWrite={canWrite}
          onClick={() => onEditSection("health")}
        />
      }
    >
      {health ? (
        <div className="grid sm:grid-cols-2">
          <DetailField
            icon={LuHeartPulse}
            label="Dietary needs"
            value={formatDietaryLine(health.dietary_restrictions)}
            className="sm:border-b sm:border-border/70 sm:col-span-2"
          />
          <DetailField
            icon={LuHeartPulse}
            label="Mobility"
            value={displayOrDash(health.mobility_notes)}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={LuHeartPulse}
            label="Medication"
            value={displayOrDash(health.medication_notes)}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={LuPhone}
            label="Emergency contact"
            value={
              health.emergency_contact_name || health.emergency_contact_phone
                ? [
                    health.emergency_contact_name,
                    formatPhoneDisplay(health.emergency_contact_phone),
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : DETAIL_EMPTY_VALUE
            }
            href={
              phoneDigitsForHref(health.emergency_contact_phone)
                ? `tel:+${phoneDigitsForHref(health.emergency_contact_phone)}`
                : null
            }
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={LuShield}
            label="Share with hotels"
            value={health.share_with_hotels ? "Yes" : "No"}
            className="sm:border-b sm:border-border/70"
          />
          <div className="sm:col-span-2">
            <NoteBlock title="Additional health notes" body={health.notes} />
          </div>
        </div>
      ) : (
        <EmptyState
          icon={LuHeartPulse}
          message="No health details on file."
        />
      )}
    </ContentSection>
  );
}
