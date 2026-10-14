"use client";

import { LuUsers } from "react-icons/lu";

import { ActionButton, ContentSection, EmptyState } from "@/components/ui";
import { formatRelationshipType } from "@/lib/clients";

import { ClientFamilyList } from "./client-family-list";
import {
  ListEmpty,
  type ProfileClient,
} from "./client-profile-shared";

export function ClientHouseholdPanel({
  client,
  canWrite,
  onManageHousehold,
  onEditMember,
  onRemoveMember,
  onAddRelationship,
  onRemoveRelationship,
  relationshipBusyId,
}: {
  client: ProfileClient;
  canWrite: boolean;
  onManageHousehold: (
    mode: "create" | "join" | "add_member" | "rename" | "leave",
  ) => void;
  onEditMember: (memberClientId: string) => void;
  onRemoveMember: (memberClientId: string) => void;
  onAddRelationship: () => void;
  onRemoveRelationship: (relationshipId: string) => void;
  relationshipBusyId: string | null;
}) {
  return (
    <div className="space-y-5">
      {client.family ? (
        <ClientFamilyList
          family={client.family}
          currentClientId={client.id}
          canWrite={canWrite}
          onAddMember={() => onManageHousehold("add_member")}
          onRename={() => onManageHousehold("rename")}
          onLeave={() => onManageHousehold("leave")}
          onEditMember={onEditMember}
          onRemoveMember={onRemoveMember}
        />
      ) : (
        <ContentSection
          title="Household"
          description="Family members who often travel together."
          action={
            canWrite ? (
              <div className="flex flex-wrap gap-1">
                <ActionButton onClick={() => onManageHousehold("create")}>
                  Create
                </ActionButton>
                <ActionButton onClick={() => onManageHousehold("join")}>
                  Join existing
                </ActionButton>
              </div>
            ) : null
          }
        >
          <EmptyState
            icon={LuUsers}
            message="Not linked to a household yet."
          />
        </ContentSection>
      )}

      <ContentSection
        title="Related people"
        description="Assistants, travel companions, and referrers."
        count={client.relationships.length}
        action={
          canWrite ? (
            <ActionButton onClick={onAddRelationship}>Add</ActionButton>
          ) : null
        }
      >
        {client.relationships.length > 0 ? (
          <ul className="divide-y divide-border/80">
            {client.relationships.map((rel) => (
              <li
                key={rel.id}
                className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="wrap-break-word text-sm font-semibold text-ink">
                    {rel.related_display_name ?? "Linked client"}
                  </p>
                  <p className="mt-0.5 wrap-break-word text-xs text-ink-muted">
                    {formatRelationshipType(rel.relationship_type)}
                    {rel.notes?.trim() ? ` · ${rel.notes}` : ""}
                  </p>
                </div>
                {canWrite ? (
                  <div className="sm:shrink-0">
                    <ActionButton
                      disabled={relationshipBusyId === rel.id}
                      onClick={() => onRemoveRelationship(rel.id)}
                    >
                      Remove
                    </ActionButton>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <ListEmpty message="No related people linked yet." />
        )}
      </ContentSection>
    </div>
  );
}
