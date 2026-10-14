import type { ConfirmDialogConfig } from "@/components/ui";
import type { PendingInviteListItem, TeamMemberListItem } from "@/lib/api/team";

import { getMemberDisplayName } from "./member-display-name";

export type TeamConfirmState =
  | { type: "deactivate"; member: TeamMemberListItem }
  | { type: "reactivate"; member: TeamMemberListItem }
  | { type: "revoke"; invite: PendingInviteListItem };

export function getConfirmDialogConfig(
  state: TeamConfirmState | null,
): ConfirmDialogConfig | null {
  if (!state) {
    return null;
  }

  switch (state.type) {
    case "deactivate": {
      const name = getMemberDisplayName(state.member.name, state.member.email);
      return {
        title: "Deactivate member",
        description: `${name} will lose access to Studio immediately.`,
        confirmLabel: "Deactivate",
        destructive: true,
      };
    }
    case "reactivate": {
      const name = getMemberDisplayName(state.member.name, state.member.email);
      return {
        title: "Reactivate member",
        description: `${name} will be able to sign in again.`,
        confirmLabel: "Reactivate",
        destructive: false,
      };
    }
    case "revoke":
      return {
        title: "Revoke invite",
        description: `${state.invite.email} will no longer be able to join with this invite.`,
        confirmLabel: "Revoke invite",
        destructive: true,
      };
  }
}
