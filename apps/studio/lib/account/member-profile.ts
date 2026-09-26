import { findTeamMemberById } from "@pureluxe/db";
import { accountMessages, AppError } from "@pureluxe/shared";

import type { AccountProfileData } from "@/lib/api/account";

function profileNotFoundError(): AppError {
  return new AppError({
    userMessage: accountMessages.error.profileNotFound,
    code: "account.profile_not_found",
    status: 404,
  });
}

/** Load account profile fields from team_members. */
export async function getMemberProfile(
  memberId: string,
): Promise<AccountProfileData> {
  const member = await findTeamMemberById(memberId);

  if (!member?.active) {
    throw profileNotFoundError();
  }

  return {
    memberId: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    title: member.title,
    phone: member.phone,
  };
}
