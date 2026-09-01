import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { StudioInvite } from "../../schema";
import type { TeamMember } from "../../schema/team-members";

const MEMBER_LIST_COLUMNS =
  "id, name, email, role, active, last_login_at, created_at, updated_at";

const INVITE_LIST_COLUMNS =
  "id, email, role, invited_by, status, accepted_at, created_at";

/** All team members, newest first. */
export async function listTeamMembers(): Promise<TeamMember[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("team_members")
      .select(MEMBER_LIST_COLUMNS)
      .order("active", { ascending: false })
      .order("name", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as TeamMember[];
}

/** Pending invites, newest first. */
export async function listPendingInvites(): Promise<StudioInvite[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("studio_invites")
      .select(INVITE_LIST_COLUMNS)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as StudioInvite[];
}

type UpdateTeamMemberInput = {
  memberId: string;
  role?: string;
  active?: boolean;
};

/** Update a team member role and/or active flag. */
export async function updateTeamMember(
  input: UpdateTeamMemberInput,
): Promise<TeamMember> {
  const supabase = getServiceClient();
  const patch: Record<string, unknown> = {};

  if (input.role !== undefined) {
    patch.role = input.role;
  }

  if (input.active !== undefined) {
    patch.active = input.active;
  }

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("team_members")
      .update(patch)
      .eq("id", input.memberId)
      .select(MEMBER_LIST_COLUMNS)
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TeamMember;
}

type CreateStudioInviteInput = {
  email: string;
  role: string;
  invitedBy: string | null;
};

/** Create a pending invite for a new team member. */
export async function createStudioInvite(
  input: CreateStudioInviteInput,
): Promise<StudioInvite> {
  const supabase = getServiceClient();
  const email = input.email.trim().toLowerCase();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("studio_invites")
      .insert({
        email,
        role: input.role,
        invited_by: input.invitedBy,
        status: "pending",
      })
      .select(INVITE_LIST_COLUMNS)
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as StudioInvite;
}

/** Revoke a pending invite. */
export async function revokeStudioInvite(inviteId: string): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase
      .from("studio_invites")
      .update({ status: "revoked" })
      .eq("id", inviteId)
      .eq("status", "pending"),
  );

  if (error) {
    throw dbQueryError(error);
  }
}

/** Bump invite created_at so "Invited" shows a fresh timestamp. */
export async function touchStudioInvite(inviteId: string): Promise<StudioInvite> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("studio_invites")
      .update({ created_at: now })
      .eq("id", inviteId)
      .eq("status", "pending")
      .select(INVITE_LIST_COLUMNS)
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as StudioInvite;
}
