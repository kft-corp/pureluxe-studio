"use client";

import { LuStar } from "react-icons/lu";

import { ActionButton, ContentSection, EmptyState } from "@/components/ui";
import { formatPreferenceCategory } from "@/lib/clients";

import type { ClientEditSection } from "./client-edit-section-dialog";
import {
  NoteBlock,
  PreferenceListItem,
  type ProfileClient,
  SectionEditButton,
} from "./client-profile-shared";

export function ClientPreferencesPanel({
  client,
  canWrite,
  onEditSection,
  onAddPreference,
  onEditPreference,
  onConfirmPreference,
  onRemovePreference,
  preferenceBusyId,
}: {
  client: ProfileClient;
  canWrite: boolean;
  onEditSection: (section: ClientEditSection) => void;
  onAddPreference: () => void;
  onEditPreference: (preferenceId: string) => void;
  onConfirmPreference: (preferenceId: string) => void;
  onRemovePreference: (preferenceId: string) => void;
  preferenceBusyId: string | null;
}) {
  const grouped = new Map<string, ProfileClient["preferences"]>();
  for (const pref of client.preferences) {
    const key = pref.category || "other";
    const list = grouped.get(key) ?? [];
    list.push(pref);
    grouped.set(key, list);
  }
  const categories = [...grouped.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div className="space-y-5">
      <ContentSection
        title="Notes"
        description="Experience notes may inform trips. Internal notes stay in Studio only."
        action={
          <SectionEditButton
            canWrite={canWrite}
            onClick={() => onEditSection("notes")}
          />
        }
      >
        <div className="divide-y divide-border/80">
          <NoteBlock
            title="Experience notes"
            body={client.guest_notes}
            collapsible
          />
          <NoteBlock
            title="Internal team notes"
            body={client.internal_notes}
            locked
            collapsible
          />
        </div>
      </ContentSection>

      {client.preferences.length === 0 ? (
        <ContentSection
          title="Preferences"
          description="What they like and avoid when planning stays."
          action={
            canWrite ? (
              <ActionButton onClick={onAddPreference}>Add</ActionButton>
            ) : null
          }
        >
          <EmptyState
            icon={LuStar}
            message="No preferences recorded yet."
          />
        </ContentSection>
      ) : (
        <>
          <div className="flex justify-end">
            {canWrite ? (
              <ActionButton onClick={onAddPreference}>
                Add preference
              </ActionButton>
            ) : null}
          </div>
          {categories.map(([category, items]) => (
            <ContentSection
              key={category}
              title={formatPreferenceCategory(category)}
              count={items.length}
              countLabel={items.length === 1 ? "preference" : "preferences"}
            >
              <ul className="divide-y divide-border/80">
                {items.map((pref) => (
                  <PreferenceListItem
                    key={pref.id}
                    pref={pref}
                    canWrite={canWrite}
                    busy={preferenceBusyId === pref.id}
                    onEdit={() => onEditPreference(pref.id)}
                    onConfirm={() => onConfirmPreference(pref.id)}
                    onRemove={() => onRemovePreference(pref.id)}
                  />
                ))}
              </ul>
            </ContentSection>
          ))}
        </>
      )}
    </div>
  );
}
