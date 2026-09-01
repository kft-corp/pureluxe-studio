import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { TeamMember } from "../../schema";

/** Find team member by id. Returns null if not found. */
export async function findTeamMemberById(
  memberId: string,
): Promise<TeamMember | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("team_members")
      .select("id, name, email, role, title, phone, active")
      .eq("id", memberId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TeamMember | null;
}

/** Find team member by email. Returns null if not found. */
export async function findTeamMemberByEmail(
  email: string,
): Promise<TeamMember | null> {
  const supabase = getServiceClient();
  const normalized = email.trim().toLowerCase();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("team_members")
      .select("*")
      .eq("email", normalized)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TeamMember | null;
}

/** Update last_login_at after a successful sign-in. */
export async function touchTeamMemberLastLogin(memberId: string): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase
      .from("team_members")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", memberId),
  );

  if (error) {
    throw dbQueryError(error);
  }
}
