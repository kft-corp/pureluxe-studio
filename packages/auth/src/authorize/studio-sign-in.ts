import {
  acceptInviteAndCreateMember,
  findPendingInviteByEmail,
  findTeamMemberByEmail,
  touchTeamMemberLastLogin,
  type TeamMember,
} from "@pureluxe/db";

import { accessDeniedError, accountInactiveError } from "../errors";
import type { GoogleProfile } from "../oauth";

/**
 * Gate Studio sign-in: active team member, or pending invite → new member.
 * Updates last_login_at on success.
 */
export async function authorizeStudioSignIn(
  profile: GoogleProfile,
): Promise<TeamMember> {
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
  return member;
}
