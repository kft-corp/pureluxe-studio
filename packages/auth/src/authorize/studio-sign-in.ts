import {
  acceptInviteAndCreateMember,
  findPendingInviteByEmail,
  findTeamMemberByEmail,
  listPermissionSlugsByRole,
  touchTeamMemberLastLogin,
  type TeamMember,
} from "@pureluxe/db";

import { accessDeniedError, accountInactiveError } from "../errors";
import type { GoogleProfile } from "../oauth";

export type StudioSignInResult = {
  member: TeamMember;
  permissions: string[];
};

/**
 * Gate Studio sign-in: active team member, or pending invite → new member.
 * Updates last_login_at on success and loads role permissions for RBAC.
 */
export async function authorizeStudioSignIn(
  profile: GoogleProfile,
): Promise<StudioSignInResult> {
  const email = profile.email.trim().toLowerCase();

  let member = await findTeamMemberByEmail(email);

  if (member) {
    if (!member.active) {
      throw accountInactiveError();
    }
  } else {
    const invite = await findPendingInviteByEmail(email);
    if (!invite) {
      throw accessDeniedError();
    }

    member = await acceptInviteAndCreateMember({
      invite,
      name: profile.name,
    });
  }

  await touchTeamMemberLastLogin(member.id);
  const permissions = await listPermissionSlugsByRole(member.role);

  return { member, permissions };
}
