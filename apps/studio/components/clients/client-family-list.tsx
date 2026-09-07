"use client";

import Link from "next/link";
import { LuUsers } from "react-icons/lu";

import { ActionButton, ContentSection, UserAvatar } from "@/components/ui";
import type { ClientProfile } from "@/lib/clients";
import { formatFamilyRole } from "@/lib/clients";
import { pageRoutes } from "@/lib/routes";

type ClientFamilyListProps = {
  family: NonNullable<ClientProfile["client"]["family"]>;
  currentClientId: string;
  canWrite?: boolean;
  onAddMember?: () => void;
  onRename?: () => void;
  onLeave?: () => void;
  onEditMember?: (memberClientId: string) => void;
  onRemoveMember?: (memberClientId: string) => void;
};

export function ClientFamilyList({
  family,
  currentClientId,
  canWrite = false,
  onAddMember,
  onRename,
  onLeave,
  onEditMember,
  onRemoveMember,
}: ClientFamilyListProps) {
  const currentMember = family.members.find(
    (member) => member.client_id === currentClientId,
  );
  const otherMembers = family.members.filter(
    (member) => member.client_id !== currentClientId,
  );

  return (
    <ContentSection
      title="Household"
      description={family.name}
      count={family.members.length}
      countLabel={family.members.length === 1 ? "member" : "members"}
      action={
        canWrite ? (
          <div className="flex flex-wrap gap-1">
            {onAddMember ? (
              <ActionButton onClick={onAddMember}>Add member</ActionButton>
            ) : null}
            {onRename ? (
              <ActionButton onClick={onRename}>Rename</ActionButton>
            ) : null}
            {onLeave ? (
              <ActionButton onClick={onLeave}>Leave</ActionButton>
            ) : null}
          </div>
        ) : null
      }
    >
      <ul className="divide-y divide-border/80">
        {currentMember ? (
          <li className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
            <UserAvatar name={currentMember.display_name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {currentMember.display_name}
                <span className="ml-2 text-xs font-semibold text-ink-muted">
                  (this profile)
                </span>
              </p>
              <p className="text-xs text-ink-muted">
                {formatFamilyRole(currentMember.role)}
                {currentMember.is_primary ? " · Primary contact" : ""}
              </p>
            </div>
          </li>
        ) : null}

        {otherMembers.map((member) => (
          <li
            key={member.client_id}
            className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-3 sm:px-6"
          >
            <Link
              href={pageRoutes.client(member.client_id)}
              className="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-90"
            >
              <UserAvatar name={member.display_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {member.display_name}
                </p>
                <p className="text-xs text-ink-muted">
                  {formatFamilyRole(member.role)}
                  {member.is_primary ? " · Primary contact" : ""}
                </p>
              </div>
            </Link>
            {canWrite ? (
              <div className="flex flex-wrap items-center gap-1 pl-14 sm:pl-0 sm:shrink-0">
                {onEditMember ? (
                  <ActionButton onClick={() => onEditMember(member.client_id)}>
                    Edit
                  </ActionButton>
                ) : null}
                {onRemoveMember ? (
                  <ActionButton
                    variant="danger"
                    onClick={() => onRemoveMember(member.client_id)}
                  >
                    Remove
                  </ActionButton>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}

        {otherMembers.length === 0 ? (
          <li className="flex items-start gap-3 px-5 py-3.5 text-sm text-ink-muted sm:px-6">
            <LuUsers className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              No other members yet. Use{" "}
              <strong className="font-semibold text-ink">Add member</strong> to
              link an existing client.
            </span>
          </li>
        ) : null}
      </ul>
    </ContentSection>
  );
}
