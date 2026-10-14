"use client";

import { LuUsers } from "react-icons/lu";

import type { TeamMemberListItem, TeamOverviewData } from "@/lib/api/team";
import { ContentSection, EmptyState } from "@/components/ui";

import { MembersTable } from "./members-table";
import { PendingInvitesTable } from "./pending-invites-table";
import { useTeamPage } from "./use-team-page";

type MembersTabProps = {
  currentMemberId: string;
  currentMemberEmail: string;
  searchQuery: string;
  hasActiveFilters: boolean;
  pendingInvites: ReturnType<typeof useTeamPage>["pendingInvites"];
  membersSectionDescription: string;
} & Pick<
  ReturnType<typeof useTeamPage>,
  | "data"
  | "inactiveMembers"
  | "primaryMembers"
  | "membersSectionTitle"
  | "showMembersSection"
  | "showInactiveSection"
  | "showPendingSection"
  | "loadingInviteId"
  | "setChangeRoleMember"
  | "setConfirmState"
  | "handleResend"
>;

function MembersTableSection({
  title,
  description,
  count,
  countLabel,
  members,
  roles,
  canManage,
  currentMemberId,
  currentMemberEmail,
  searchQuery,
  hasActiveFilters,
  onChangeRole,
  onDeactivate,
  onReactivate,
}: {
  title: string;
  description: string;
  count: number;
  countLabel: string;
  members: TeamMemberListItem[];
  roles: TeamOverviewData["roles"];
  canManage: boolean;
  currentMemberId: string;
  currentMemberEmail: string;
  searchQuery: string;
  hasActiveFilters: boolean;
  onChangeRole: (member: TeamMemberListItem) => void;
  onDeactivate: (member: TeamMemberListItem) => void;
  onReactivate: (member: TeamMemberListItem) => void;
}) {
  return (
    <ContentSection
      title={title}
      description={description}
      count={count}
      countLabel={countLabel}
    >
      <MembersTable
        members={members}
        roles={roles}
        canManage={canManage}
        currentMemberId={currentMemberId}
        currentMemberEmail={currentMemberEmail}
        searchQuery={searchQuery}
        hasActiveFilters={hasActiveFilters}
        onChangeRole={onChangeRole}
        onDeactivate={onDeactivate}
        onReactivate={onReactivate}
      />
    </ContentSection>
  );
}

export function MembersTab({
  data,
  currentMemberId,
  currentMemberEmail,
  inactiveMembers,
  primaryMembers,
  pendingInvites,
  membersSectionTitle,
  membersSectionDescription,
  showMembersSection,
  showInactiveSection,
  showPendingSection,
  searchQuery,
  hasActiveFilters,
  loadingInviteId,
  setChangeRoleMember,
  setConfirmState,
  handleResend,
}: MembersTabProps) {
  const tableProps = {
    roles: data.roles,
    canManage: data.canManage,
    currentMemberId,
    currentMemberEmail,
    searchQuery,
    hasActiveFilters,
    onChangeRole: setChangeRoleMember,
    onDeactivate: (member: TeamMemberListItem) =>
      setConfirmState({ type: "deactivate", member }),
    onReactivate: (member: TeamMemberListItem) =>
      setConfirmState({ type: "reactivate", member }),
  };

  const noVisibleRows =
    (!showMembersSection || primaryMembers.length === 0) &&
    (!showInactiveSection || inactiveMembers.length === 0) &&
    (!showPendingSection || pendingInvites.length === 0);

  if (noVisibleRows) {
    const q = searchQuery.trim();
    const title = hasActiveFilters ? "No matches" : "Your team";
    const description = q
      ? `Nothing matches “${q}”. Try another search or clear filters.`
      : hasActiveFilters
        ? "No one matches this status filter. Clear filters to see everyone."
        : "Invite teammates to collaborate in Studio.";
    const message = q
      ? `No team members match “${q}”.`
      : hasActiveFilters
        ? "No team members match this filter."
        : data.canManage
          ? "No members yet. Invite someone to join your team."
          : "No members on this team yet.";

    return (
      <ContentSection title={title} description={description} count={0} countLabel="people">
        <EmptyState icon={LuUsers} message={message} />
      </ContentSection>
    );
  }

  return (
    <div className="space-y-5">
      {showMembersSection && primaryMembers.length > 0 ? (
        <MembersTableSection
          title={membersSectionTitle}
          description={membersSectionDescription}
          count={primaryMembers.length}
          countLabel={primaryMembers.length === 1 ? "member" : "members"}
          members={primaryMembers}
          {...tableProps}
        />
      ) : null}

      {showInactiveSection && inactiveMembers.length > 0 ? (
        <MembersTableSection
          title="Inactive members"
          description="Deactivated accounts — reactivate to restore access."
          count={inactiveMembers.length}
          countLabel={inactiveMembers.length === 1 ? "member" : "members"}
          members={inactiveMembers}
          {...tableProps}
        />
      ) : null}

      {showPendingSection && pendingInvites.length > 0 ? (
        <ContentSection
          title="Pending invites"
          description={
            searchQuery.trim()
              ? "Invites that match your search."
              : "Waiting for Google sign-in. Resend or revoke anytime."
          }
          count={pendingInvites.length}
          countLabel={pendingInvites.length === 1 ? "invite" : "invites"}
        >
          <PendingInvitesTable
            invites={pendingInvites}
            roles={data.roles}
            canManage={data.canManage}
            searchQuery={searchQuery}
            hasActiveFilters={hasActiveFilters}
            onResend={handleResend}
            onRevoke={(invite) => setConfirmState({ type: "revoke", invite })}
            loadingInviteId={loadingInviteId}
          />
        </ContentSection>
      ) : null}
    </div>
  );
}
