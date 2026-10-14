"use client";

import { useCallback, useMemo, useState } from "react";

import type {
  PendingInviteListItem,
  TeamMemberListItem,
  TeamOverviewData,
} from "@/lib/api/team";
import {
  getTeamOverview,
  resendTeamInvite,
  revokeTeamInvite,
  updateTeamMemberStatus,
} from "@/lib/api/team";
import {
  showApiError,
  showOptionalSuccessToast,
} from "@/lib/feedback/toast";
import type { TeamConfirmState } from "@/lib/team/confirm-dialog-config";
import {
  filterInvitesByQuery,
  filterMembersByQuery,
  getFilterCounts,
  getMembersForPrimarySection,
  getMembersSectionDescription,
  getMembersSectionTitle,
  partitionMembers,
  shouldShowInactiveSection,
  shouldShowMembersSection,
  shouldShowPendingSection,
  type MemberFilter,
} from "@/lib/team/member-filter-utils";

export function useTeamPage(initialData: TeamOverviewData) {
  const [data, setData] = useState(initialData);
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [changeRoleMember, setChangeRoleMember] =
    useState<TeamMemberListItem | null>(null);
  const [confirmState, setConfirmState] = useState<TeamConfirmState | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadingInviteId, setLoadingInviteId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await getTeamOverview();
    setData(response.data);
  }, []);

  const { active: activeMembers, inactive: inactiveMembers } = useMemo(
    () => partitionMembers(data.members),
    [data.members],
  );

  const filteredActive = useMemo(
    () => filterMembersByQuery(activeMembers, search),
    [activeMembers, search],
  );

  const filteredInactive = useMemo(
    () => filterMembersByQuery(inactiveMembers, search),
    [inactiveMembers, search],
  );

  const filteredPendingInvites = useMemo(
    () => filterInvitesByQuery(data.pendingInvites, search),
    [data.pendingInvites, search],
  );

  const filterCounts = useMemo(
    () =>
      getFilterCounts({
        active: filteredActive,
        inactive: filteredInactive,
        pendingInvites: filteredPendingInvites,
      }),
    [filteredActive, filteredInactive, filteredPendingInvites],
  );

  const primaryMembers = useMemo(
    () =>
      getMembersForPrimarySection(filter, {
        active: filteredActive,
        inactive: filteredInactive,
      }),
    [filter, filteredActive, filteredInactive],
  );

  const hasActiveFilters = Boolean(search.trim()) || filter !== "all";

  const membersSectionTitle = getMembersSectionTitle(filter);
  const membersSectionDescription = getMembersSectionDescription(
    filter,
    Boolean(search.trim()),
  );

  function clearSearchAndFilters() {
    setSearch("");
    setFilter("all");
  }

  async function handleConfirm() {
    if (!confirmState) {
      return;
    }

    setActionLoading(true);

    try {
      if (confirmState.type === "deactivate") {
        const response = await updateTeamMemberStatus(confirmState.member.id, false);
        showOptionalSuccessToast(response.message);
      } else if (confirmState.type === "reactivate") {
        const response = await updateTeamMemberStatus(confirmState.member.id, true);
        showOptionalSuccessToast(response.message);
      } else {
        const response = await revokeTeamInvite(confirmState.invite.id);
        showOptionalSuccessToast(response.message);
      }

      setConfirmState(null);
      await refresh();
    } catch (error) {
      showApiError(error);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResend(invite: PendingInviteListItem) {
    setLoadingInviteId(invite.id);

    try {
      const response = await resendTeamInvite(invite.id);
      showOptionalSuccessToast(response.message);
      await refresh();
    } catch (error) {
      showApiError(error);
    } finally {
      setLoadingInviteId(null);
    }
  }

  return {
    data,
    filter,
    setFilter,
    search,
    setSearch,
    hasActiveFilters,
    clearSearchAndFilters,
    filterCounts,
    inviteOpen,
    setInviteOpen,
    changeRoleMember,
    setChangeRoleMember,
    confirmState,
    setConfirmState,
    actionLoading,
    loadingInviteId,
    refresh,
    handleConfirm,
    handleResend,
    activeMembers: filteredActive,
    inactiveMembers: filteredInactive,
    pendingInvites: filteredPendingInvites,
    primaryMembers,
    membersSectionTitle,
    membersSectionDescription,
    showMembersSection: shouldShowMembersSection(filter),
    showInactiveSection: shouldShowInactiveSection(
      filter,
      filteredInactive.length,
    ),
    showPendingSection: shouldShowPendingSection(filter),
  };
}
