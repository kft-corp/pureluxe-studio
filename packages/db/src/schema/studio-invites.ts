import type { StudioRole } from "./team-members";

/** Invite status — pending until first sign-in. */
export type InviteStatus = "pending" | "accepted" | "revoked";

/** Row from studio_invites — admin invited this email before first login. */
export type StudioInvite = {
  id: string;
  email: string;
  role: StudioRole;
  invited_by: string | null;
  status: InviteStatus;
  accepted_at: string | null;
  created_at: string;
};
