"use client";

import { useState } from "react";
import { LuUserPlus } from "react-icons/lu";

import { PageStack, PageToolbar } from "@/components/ui";
import type { TeamOverviewData } from "@/lib/api/team";
import { cn } from "@/lib/utils/cn";

import { ChangeRoleDialog } from "./change-role-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MemberFilters } from "./member-filters";
import { MembersTab } from "./members-tab";
import { RolePermissionsTab } from "./role-permissions-tab";
import { TeamTabs, type TeamTab } from "./team-tabs";
import { useTeamPage } from "./use-team-page";

type TeamPageContentProps = {
  initialData: TeamOverviewData;
  currentMemberId: string;
  currentMemberEmail: string;
};

export function TeamPageContent({
  initialData,
  currentMemberId,
  currentMemberEmail,
}: TeamPageContentProps) {
  const [activeTab, setActiveTab] = useState<TeamTab>("members");
  const team = useTeamPage(initialData);
  const isMembersTab = activeTab === "members";

  return (
    <PageStack>
      <PageToolbar>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <TeamTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {team.data.canManage ? (
            <button
              type="button"
              onClick={() => team.setInviteOpen(true)}
              disabled={!isMembersTab}
              aria-hidden={!isMembersTab}
              tabIndex={isMembersTab ? 0 : -1}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-dark px-4 text-sm font-medium text-on-dark shadow-sm transition hover:bg-brand-dark/90 lg:min-w-[9.5rem]",
                !isMembersTab && "pointer-events-none invisible",
              )}
            >
              <LuUserPlus className="h-4 w-4" aria-hidden />
              Invite member
            </button>
          ) : null}
        </div>

        {isMembersTab ? (
          <MemberFilters
            value={team.filter}
            onChange={team.setFilter}
            counts={team.filterCounts}
          />
        ) : null}
      </PageToolbar>

      {activeTab === "roles" ? (
        <RolePermissionsTab active />
      ) : (
        <MembersTab
          data={team.data}
          currentMemberId={currentMemberId}
          currentMemberEmail={currentMemberEmail}
          inactiveMembers={team.inactiveMembers}
          primaryMembers={team.primaryMembers}
          membersSectionTitle={team.membersSectionTitle}
          showMembersSection={team.showMembersSection}
          showInactiveSection={team.showInactiveSection}
          showPendingSection={team.showPendingSection}
          loadingInviteId={team.loadingInviteId}
          setChangeRoleMember={team.setChangeRoleMember}
          setConfirmState={team.setConfirmState}
          handleResend={team.handleResend}
        />
      )}

      <InviteMemberDialog
        open={team.inviteOpen}
        roles={team.data.roles}
        onClose={() => team.setInviteOpen(false)}
        onSuccess={team.refresh}
      />

      <ChangeRoleDialog
        open={team.changeRoleMember !== null}
        member={team.changeRoleMember}
        roles={team.data.roles}
        onClose={() => team.setChangeRoleMember(null)}
        onSuccess={team.refresh}
      />

      <ConfirmDialog
        state={team.confirmState}
        loading={team.actionLoading}
        onConfirm={team.handleConfirm}
        onClose={() => team.setConfirmState(null)}
      />
    </PageStack>
  );
}
