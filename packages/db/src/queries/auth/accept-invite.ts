import { getServiceClient } from "../../client";
import { dbQueryError } from "../../errors";
import type { StudioInvite } from "../../schema";
import type { TeamMember } from "../../schema/team-members";

type AcceptInviteInput = {
  invite: StudioInvite;
  name: string;
};

/**
 * First sign-in from a pending invite: create team_members row and mark invite accepted.
 */
export async function acceptInviteAndCreateMember(
  input: AcceptInviteInput,
): Promise<TeamMember> {
  const supabase = getServiceClient();
  const email = input.invite.email.trim().toLowerCase();
  const name = input.name.trim() || email.split("@")[0] || "Team member";

  const { data: member, error: memberError } = await supabase
    .from("team_members")
    .insert({
      name,
      email,
      role: input.invite.role,
      active: true,
    })
    .select("*")
    .single();

  if (memberError) {
    throw dbQueryError(memberError);
  }

  const { error: inviteError } = await supabase
    .from("studio_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", input.invite.id)
    .eq("status", "pending");

  if (inviteError) {
    throw dbQueryError(inviteError);
  }

  return member as TeamMember;
}
