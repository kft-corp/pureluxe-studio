import { getServiceClient } from "../client";
import { dbQueryError } from "../errors";
import type { StudioInvite } from "../schema";

/** Find pending invite by email. Returns null if none. */
export async function findPendingInviteByEmail(
  email: string,
): Promise<StudioInvite | null> {
  const supabase = getServiceClient();
  const normalized = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("studio_invites")
    .select("*")
    .eq("status", "pending")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    throw dbQueryError(error);
  }

  return data as StudioInvite | null;
}
