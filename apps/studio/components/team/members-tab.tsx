"use client";

import type { TeamMemberListItem, TeamOverviewData } from "@/lib/api/team";

import { ContentSection } from "@/components/ui";

import { MembersTable } from "./members-table";
import { PendingInvitesTable } from "./pending-invites-table";
import { useTeamPage } from "./use-team-page";

type MembersTabProps = {
  currentMemberId: string;
  currentMemberEmail: string;
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
  count,
  members,
  roles,
  canManage,
  currentMemberId,
  currentMemberEmail,
  onChangeRole,
  onDeactivate,
  onReactivate,
}: {
  title: string;
  count: number;
  members: TeamMemberListItem[];
  roles: TeamOverviewData["roles"];
  canManage: boolean;
  currentMemberId: string;
  currentMemberEmail: string;
  onChangeRole: (member: TeamMemberListItem) => void;
  onDeactivate: (member: TeamMemberListItem) => void;
  onReactivate: (member: TeamMemberListItem) => void;
}) {
  return (
    <ContentSection title={title} count={count}>
      <MembersTable
        members={members}
        roles={roles}
        canManage={canManage}
        currentMemberId={currentMemberId}
        currentMemberEmail={currentMemberEmail}
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
  membersSectionTitle,
  showMembersSection,
  showInactiveSection,
  showPendingSection,
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
    onChangeRole: setChangeRoleMember,
    onDeactivate: (member: TeamMemberListItem) =>
      setConfirmState({ type: "deactivate", member }),
    onReactivate: (member: TeamMemberListItem) =>
      setConfirmState({ type: "reactivate", member }),
  };

  return (
    <div className="space-y-5">
      {showMembersSection ? (
        <MembersTableSection
          title={membersSectionTitle}
          count={primaryMembers.length}
          members={primaryMembers}
          {...tableProps}
        />
      ) : null}

      {showInactiveSection ? (
        <MembersTableSection
          title="Inactive members"
          count={inactiveMembers.length}
          members={inactiveMembers}
          {...tableProps}
        />
      ) : null}

      {showPendingSection ? (
        <ContentSection title="Pending invites" count={data.pendingInvites.length}>
          <PendingInvitesTable
            invites={data.pendingInvites}
            roles={data.roles}
            canManage={data.canManage}
            onResend={handleResend}
            onRevoke={(invite) => setConfirmState({ type: "revoke", invite })}
            loadingInviteId={loadingInviteId}
          />
        </ContentSection>
      ) : null}
    </div>
  );
}
