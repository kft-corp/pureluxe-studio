"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LuArrowLeft, LuCheck, LuEllipsis, LuPencil, LuSparkles } from "react-icons/lu";

import {
  ConfirmDialog,
  PageStack,
  PageToolbar,
  StatusBadge,
  UserAvatar,
  studioButtonClass,
} from "@/components/ui";
import type { ClientProfile } from "@/lib/clients";
import {
  familySummaryLine,
  formatBookingDate,
  formatClientSource,
  formatFamilyRole,
  formatPhone,
  listCompletenessHints,
} from "@/lib/clients";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

import { ClientEditSectionDialog } from "./client-edit-section-dialog";
import { ClientDocumentDialog } from "./client-document-dialog";
import { ClientHouseholdDialog } from "./client-household-dialog";
import { ClientPreferenceDialog } from "./client-preference-dialog";
import {
  ClientActivityPanel,
  ClientDocumentsPanel,
  ClientHealthPanel,
  ClientHouseholdPanel,
  ClientOverviewPanel,
  ClientPreferencesPanel,
  ClientTripsPanel,
  CompletenessMeter,
  SnapshotCard,
} from "./client-profile-panels";
import { ClientProfileTabs } from "./client-profile-tabs";
import { ClientVipBadge } from "./client-vip-badge";
import { useClientProfile } from "./use-client-profile";

type ClientProfileContentProps = {
  initialProfile: ClientProfile;
  canWrite: boolean;
};

function MoreMenu({ onDeactivate }: { onDeactivate: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-raised text-ink-muted transition hover:bg-surface-hover hover:text-ink"
        aria-label="More actions"
        aria-expanded={open}
      >
        <LuEllipsis className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-surface-raised py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDeactivate();
            }}
            className="block min-h-9 w-full px-3 py-2 text-left text-xs text-red-700 transition hover:bg-red-50"
          >
            Deactivate client
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Full client profile — hero always visible; long lists live in tabs. */
export function ClientProfileContent({
  initialProfile,
  canWrite,
}: ClientProfileContentProps) {
  const profilePage = useClientProfile({ initialProfile });
  const { client } = profilePage;

  const familyLine = familySummaryLine({
    familyName: client.family?.name,
    members: client.family?.members,
    currentClientId: client.id,
  });
  const legalName =
    client.legal_name?.trim() &&
    client.legal_name.trim() !== client.display_name.trim()
      ? client.legal_name
      : null;

  const completenessHints = listCompletenessHints({
    display_name: client.display_name,
    email: client.email,
    phone: client.phone,
    nationality: client.nationality,
    city_of_residence: client.city_of_residence,
    important_dates: client.important_dates,
    guest_notes: client.guest_notes,
    relationship_owner_id: client.relationship_owner_id,
    hasPreference: client.preferences.length > 0,
    hasVerifiedPassport: client.documents.some(
      (doc) =>
        doc.document_type === "passport" && doc.status === "verified",
    ),
    hasFamily: Boolean(client.family),
    hasHealthBasics: Boolean(
      client.health_profile?.dietary_restrictions?.length ||
        client.health_profile?.emergency_contact_phone ||
        client.health_profile?.emergency_contact_name,
    ),
  });
  const nextHint = completenessHints[0] ?? null;

  const heroMetaItems = [
    client.client_since
      ? `Client since ${formatBookingDate(client.client_since)}`
      : null,
    client.company?.trim() || null,
    client.city_of_residence?.trim() || null,
    client.phone?.trim() ? formatPhone(client.phone) : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <>
      <PageStack>
        <div>
          <Link
            href={pageRoutes.clients}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-ink"
          >
            <LuArrowLeft className="h-4 w-4" aria-hidden />
            All clients
          </Link>
        </div>

        <PageToolbar className="bg-[linear-gradient(180deg,var(--surface-raised)_0%,var(--surface)_100%)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <UserAvatar
                name={client.display_name}
                email={client.email ?? undefined}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="max-w-full wrap-break-word font-serif text-xl font-medium tracking-tight text-ink sm:text-3xl">
                    {client.display_name}
                  </h2>
                  <ClientVipBadge tier={client.tier.slug} />
                  {client.review_status === "pending" ? (
                    <StatusBadge status="pending" />
                  ) : (
                    <StatusBadge status="approved" />
                  )}
                </div>
                {legalName ? (
                  <p className="mt-1 wrap-break-word text-sm text-ink-muted">
                    Legal name: {legalName}
                  </p>
                ) : null}
                <p
                  className={cn(
                    "mt-1 wrap-break-word text-sm",
                    familyLine ? "text-ink-muted" : "text-ink-subtle",
                  )}
                >
                  {familyLine ?? "Not linked to a household"}
                  {client.family?.role
                    ? ` · ${formatFamilyRole(client.family.role)}`
                    : ""}
                </p>
                {heroMetaItems.length > 0 ? (
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
                    {heroMetaItems.map((item) => (
                      <span key={item} className="max-w-full wrap-break-word">
                        {item}
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center justify-end gap-1.5">
              {canWrite && client.review_status === "pending" ? (
                <button
                  type="button"
                  onClick={() => void profilePage.handleApprove()}
                  disabled={profilePage.approveLoading}
                  className={studioButtonClass("success", "sm")}
                >
                  <LuCheck className="h-3.5 w-3.5" aria-hidden />
                  {profilePage.approveLoading
                    ? "Approving…"
                    : "Approve client"}
                </button>
              ) : null}
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => profilePage.setEditSection("contact")}
                  className={studioButtonClass("secondary", "sm")}
                >
                  <LuPencil className="h-3.5 w-3.5" aria-hidden />
                  Edit contact
                </button>
              ) : null}
              <button
                type="button"
                disabled
                title="Trip Builder coming soon — will open with this client ready to plan."
                className={studioButtonClass(
                  client.review_status === "pending" ? "secondary" : "primary",
                  "sm",
                )}
              >
                <LuSparkles className="h-3.5 w-3.5" aria-hidden />
                Start trip
              </button>
              {canWrite ? <MoreMenu onDeactivate={profilePage.requestDeactivate} /> : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CompletenessMeter
              value={client.profile_completeness}
              hint={nextHint?.label}
              onHintClick={
                canWrite && nextHint?.section
                  ? () => {
                      const section = nextHint.section;
                      if (section) profilePage.setEditSection(section);
                    }
                  : undefined
              }
            />
            <SnapshotCard
              label="Account owner"
              value={client.relationship_owner?.name ?? "Unassigned"}
            />
            <SnapshotCard label="Client tier" value={client.tier.label} />
            <SnapshotCard
              label="How they joined"
              value={formatClientSource(client.source)}
              hint={
                client.stats.last_booking_date
                  ? `Last stay ${formatBookingDate(client.stats.last_booking_date)}`
                  : "No stays yet"
              }
            />
          </div>
        </PageToolbar>

        <ClientProfileTabs
          activeTab={profilePage.activeTab}
          onTabChange={profilePage.setActiveTab}
          counts={{
            preferences: client.preferences.length,
            documents: client.documents.length,
            household:
              (client.family?.members.filter(
                (member) => member.client_id !== client.id,
              ).length ?? 0) + client.relationships.length,
            activity:
              client.recent_audit.length + client.merge_candidates.length,
          }}
        />

        <div
          role="tabpanel"
          aria-label={`${profilePage.activeTab} section`}
          className="min-w-0"
        >
          {profilePage.activeTab === "overview" ? (
            <ClientOverviewPanel
              client={client}
              canWrite={canWrite}
              onOpenTab={profilePage.setActiveTab}
              onEditSection={profilePage.setEditSection}
            />
          ) : null}
          {profilePage.activeTab === "preferences" ? (
            <ClientPreferencesPanel
              client={client}
              canWrite={canWrite}
              onEditSection={profilePage.setEditSection}
              onAddPreference={profilePage.openAddPreference}
              onEditPreference={profilePage.openEditPreference}
              onConfirmPreference={profilePage.handleConfirmPreference}
              onRemovePreference={profilePage.handleRemovePreference}
              preferenceBusyId={profilePage.preferenceBusyId}
            />
          ) : null}
          {profilePage.activeTab === "documents" ? (
            <ClientDocumentsPanel
              client={client}
              canWrite={canWrite}
              onUpload={() => profilePage.setDocumentDialogOpen(true)}
              onView={profilePage.handleViewDocument}
              onVerify={(documentId) =>
                profilePage.requestDocumentConfirm("verify", documentId)
              }
              onReject={(documentId) =>
                profilePage.requestDocumentConfirm("reject", documentId)
              }
              onRemove={(documentId) =>
                profilePage.requestDocumentConfirm("remove", documentId)
              }
              documentBusyId={profilePage.documentBusyId}
            />
          ) : null}
          {profilePage.activeTab === "health" ? (
            <ClientHealthPanel
              client={client}
              canWrite={canWrite}
              onEditSection={profilePage.setEditSection}
            />
          ) : null}
          {profilePage.activeTab === "household" ? (
            <ClientHouseholdPanel
              client={client}
              canWrite={canWrite}
              onManageHousehold={(mode) =>
                profilePage.setHouseholdDialog({
                  mode,
                  memberClientId: null,
                })
              }
              onEditMember={(memberClientId) =>
                profilePage.setHouseholdDialog({
                  mode: "edit_member",
                  memberClientId,
                })
              }
              onRemoveMember={(memberClientId) =>
                profilePage.setHouseholdDialog({
                  mode: "remove_member",
                  memberClientId,
                })
              }
              onAddRelationship={() =>
                profilePage.setHouseholdDialog({
                  mode: "add_relationship",
                  memberClientId: null,
                })
              }
              onRemoveRelationship={profilePage.handleRemoveRelationship}
              relationshipBusyId={profilePage.relationshipBusyId}
            />
          ) : null}
          {profilePage.activeTab === "activity" ? (
            <ClientActivityPanel client={client} />
          ) : null}
          {profilePage.activeTab === "trips" ? (
            <ClientTripsPanel client={client} />
          ) : null}
        </div>
      </PageStack>

      {profilePage.editSection ? (
        <ClientEditSectionDialog
          open
          section={profilePage.editSection}
          profile={profilePage.profile}
          onClose={() => profilePage.setEditSection(null)}
          onSuccess={profilePage.handleProfileSaved}
        />
      ) : null}

      {profilePage.preferenceDialogOpen ? (
        <ClientPreferenceDialog
          open
          clientId={client.id}
          preference={profilePage.editingPreference}
          onClose={profilePage.closePreferenceDialog}
          onSuccess={profilePage.handleProfileSaved}
        />
      ) : null}

      {profilePage.documentDialogOpen ? (
        <ClientDocumentDialog
          open
          clientId={client.id}
          onClose={() => profilePage.setDocumentDialogOpen(false)}
          onSuccess={profilePage.handleProfileSaved}
        />
      ) : null}

      {profilePage.householdDialog ? (
        <ClientHouseholdDialog
          open
          mode={profilePage.householdDialog.mode}
          profile={profilePage.profile}
          memberClientId={profilePage.householdDialog.memberClientId}
          onClose={() => profilePage.setHouseholdDialog(null)}
          onSuccess={profilePage.handleProfileSaved}
        />
      ) : null}

      <ConfirmDialog
        open={profilePage.confirmOpen}
        config={profilePage.confirmConfig}
        loading={profilePage.confirmBusy}
        onClose={profilePage.closeConfirm}
        onConfirm={() => void profilePage.handleConfirm()}
      />
    </>
  );
}
