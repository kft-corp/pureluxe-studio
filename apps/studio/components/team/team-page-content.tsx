"use client";

import { useState } from "react";
import { LuUserPlus } from "react-icons/lu";

import { PageStack, PageToolbar, studioButtonClass } from "@/components/ui";
import type { TeamOverviewData } from "@/lib/api/team";
import { cn } from "@/lib/utils/cn";

import { ChangeRoleDialog } from "./change-role-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MemberFilters } from "./member-filters";
import { MemberSearch } from "./member-search";
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
      <PageToolbar className="gap-5 bg-[linear-gradient(180deg,var(--surface-raised)_0%,var(--surface)_100%)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TeamTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {team.data.canManage ? (
            <button
              type="button"
              onClick={() => team.setInviteOpen(true)}
              disabled={!isMembersTab}
              aria-hidden={!isMembersTab}
              tabIndex={isMembersTab ? 0 : -1}
              className={cn(
                studioButtonClass("primary", "md", "shrink-0 sm:self-auto"),
                !isMembersTab && "pointer-events-none invisible",
              )}
            >
              <LuUserPlus className="h-3.5 w-3.5" aria-hidden />
              Invite member
            </button>
          ) : null}
        </div>

        {isMembersTab ? (
          <div className="flex flex-col gap-3 border-t border-border/70 pt-4">
            <div className="min-w-0 sm:max-w-xl">
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink uppercase">
                Find someone
              </p>
              <MemberSearch
                value={team.search}
                onChange={team.setSearch}
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink uppercase">
                  Status
                </p>
                <MemberFilters
                  value={team.filter}
                  onChange={team.setFilter}
                  counts={team.filterCounts}
                />
              </div>

              {team.hasActiveFilters ? (
                <button
                  type="button"
                  onClick={team.clearSearchAndFilters}
                  className="text-sm font-medium text-ink underline-offset-2 transition hover:underline sm:mb-1"
                >
                  Clear search & filters
                </button>
              ) : null}
            </div>
          </div>
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
          pendingInvites={team.pendingInvites}
          membersSectionTitle={team.membersSectionTitle}
          membersSectionDescription={team.membersSectionDescription}
          showMembersSection={team.showMembersSection}
          showInactiveSection={team.showInactiveSection}
          showPendingSection={team.showPendingSection}
          searchQuery={team.search}
          hasActiveFilters={team.hasActiveFilters}
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
