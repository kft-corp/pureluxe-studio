import type { PendingInviteListItem, TeamMemberListItem } from "@/lib/api/team";

export type TeamConfirmState =
  | { type: "deactivate"; member: TeamMemberListItem }
  | { type: "reactivate"; member: TeamMemberListItem }
  | { type: "revoke"; invite: PendingInviteListItem };

type ConfirmDialogConfig = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
};

export function getConfirmDialogConfig(
  state: TeamConfirmState | null,
): ConfirmDialogConfig | null {
  if (!state) {
    return null;
  }

  switch (state.type) {
    case "deactivate":
      return {
        title: "Deactivate member",
        description: `${state.member.name} will lose access to Studio immediately.`,
        confirmLabel: "Deactivate",
        destructive: true,
      };
    case "reactivate":
      return {
        title: "Reactivate member",
        description: `${state.member.name} will be able to sign in again.`,
        confirmLabel: "Reactivate",
        destructive: false,
      };
    case "revoke":
      return {
        title: "Revoke invite",
        description: `${state.invite.email} will no longer be able to join with this invite.`,
        confirmLabel: "Revoke invite",
        destructive: true,
      };
  }
}
