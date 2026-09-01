import { createStudioInvite } from "@pureluxe/db";
import { inviteMemberSchema, teamMessages } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import {
  assertActiveRole,
  assertInviteEmailAvailable,
} from "@/lib/team/team-overview";

/** Create a pending team invite. */
export async function POST(request: Request) {
  try {
    const session = await requireApiPermission("team.manage");
    const body: unknown = await request.json();
    const input = inviteMemberSchema.parse(body);

    await assertInviteEmailAvailable(input.email);
    await assertActiveRole(input.role);

    const invite = await createStudioInvite({
      email: input.email,
      role: input.role,
      invitedBy: session.memberId,
    });

    return apiSuccess(
      { id: invite.id },
      { message: teamMessages.success.inviteSent, status: 201 },
    );
  } catch (cause) {
    return apiFromError(cause);
  }
}
