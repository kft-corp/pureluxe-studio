import {
  findActiveStudioRoleBySlug,
  findPendingInviteByEmail,
  findTeamMemberByEmail,
  listActiveStudioRoles,
  listPendingInvites,
  listTeamMembers,
} from "@pureluxe/db";
import type { StudioInvite, StudioRoleRecord, TeamMember } from "@pureluxe/db";
import { AppError, teamMessages } from "@pureluxe/shared";

export type TeamMemberListItem = Pick<
  TeamMember,
  "id" | "name" | "email" | "role" | "active" | "last_login_at" | "created_at"
>;

export type PendingInviteListItem = Pick<
  StudioInvite,
  "id" | "email" | "role" | "invited_by" | "created_at"
>;

export type TeamOverviewData = {
  members: TeamMemberListItem[];
  pendingInvites: PendingInviteListItem[];
  roles: StudioRoleRecord[];
  canManage: boolean;
};

function toMemberListItem(member: TeamMember): TeamMemberListItem {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    active: member.active,
    last_login_at: member.last_login_at,
    created_at: member.created_at,
  };
}

function toInviteListItem(invite: StudioInvite): PendingInviteListItem {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    invited_by: invite.invited_by,
    created_at: invite.created_at,
  };
}

/** Load members, pending invites, and active roles for the team page. */
export async function getTeamOverview(canManage: boolean): Promise<TeamOverviewData> {
  const [members, pendingInvites, roles] = await Promise.all([
    listTeamMembers(),
    listPendingInvites(),
    listActiveStudioRoles(),
  ]);

  return {
    members: members.map(toMemberListItem),
    pendingInvites: pendingInvites.map(toInviteListItem),
    roles,
    canManage,
  };
}

/** Ensure invite email is not already a member or pending invite. */
export async function assertInviteEmailAvailable(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const [member, invite] = await Promise.all([
    findTeamMemberByEmail(normalized),
    findPendingInviteByEmail(normalized),
  ]);

  if (member) {
    throw new AppError({
      userMessage: teamMessages.error.emailAlreadyMember,
      code: "team.email_already_member",
      status: 409,
    });
  }

  if (invite) {
    throw new AppError({
      userMessage: teamMessages.error.emailAlreadyInvited,
      code: "team.email_already_invited",
      status: 409,
    });
  }
}

/** Ensure role slug exists and is active. */
export async function assertActiveRole(role: string): Promise<void> {
  const record = await findActiveStudioRoleBySlug(role);

  if (!record) {
    throw new AppError({
      userMessage: teamMessages.error.roleNotFound,
      code: "team.role_not_found",
      status: 400,
    });
  }
}
