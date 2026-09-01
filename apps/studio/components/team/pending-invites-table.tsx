"use client";

import { LuMail } from "react-icons/lu";

import {
  ActionButton,
  EmptyState,
  RoleBadge,
  StatusBadge,
  UserAvatar,
} from "@/components/ui";
import {
  MobileCard,
  ResponsiveTable,
  TableCell,
  TableRow,
} from "@/components/ui/responsive-table";
import type { PendingInviteListItem, TeamOverviewData } from "@/lib/api/team";
import { formatRelativeTime } from "@/lib/team/format-relative-time";
import { getRoleLabel } from "@/lib/team/role-label";

type PendingInvitesTableProps = {
  invites: PendingInviteListItem[];
  roles: TeamOverviewData["roles"];
  canManage: boolean;
  onResend: (invite: PendingInviteListItem) => void;
  onRevoke: (invite: PendingInviteListItem) => void;
  loadingInviteId?: string | null;
};

type InviteRowProps = {
  invite: PendingInviteListItem;
  roleLabel: string;
  isLoading: boolean;
  canManage: boolean;
  onResend: (invite: PendingInviteListItem) => void;
  onRevoke: (invite: PendingInviteListItem) => void;
};

function InviteActions({
  invite,
  isLoading,
  canManage,
  onResend,
  onRevoke,
  className,
}: Pick<
  InviteRowProps,
  "invite" | "isLoading" | "canManage" | "onResend" | "onRevoke"
> & { className?: string }) {
  if (!canManage) {
    return null;
  }

  return (
    <div className={className}>
      <ActionButton onClick={() => onResend(invite)} disabled={isLoading}>
        Resend
      </ActionButton>
      <ActionButton
        onClick={() => onRevoke(invite)}
        disabled={isLoading}
        variant="danger"
      >
        Revoke
      </ActionButton>
    </div>
  );
}

function InviteRowContent({
  invite,
  roleLabel,
  isLoading,
  canManage,
  onResend,
  onRevoke,
  layout,
}: InviteRowProps & { layout: "table" | "card" }) {
  if (layout === "table") {
    return (
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-3">
            <UserAvatar email={invite.email} variant="invite" />
            <span className="text-ink">{invite.email}</span>
          </div>
        </TableCell>
        <TableCell>
          <RoleBadge label={roleLabel} role={invite.role} />
        </TableCell>
        <TableCell className="text-ink-muted">
          {formatRelativeTime(invite.created_at)}
        </TableCell>
        <TableCell>
          <StatusBadge status="pending" />
        </TableCell>
        {canManage ? (
          <TableCell className="text-right">
            <InviteActions
              invite={invite}
              isLoading={isLoading}
              canManage={canManage}
              onResend={onResend}
              onRevoke={onRevoke}
              className="flex items-center justify-end gap-0.5"
            />
          </TableCell>
        ) : null}
      </TableRow>
    );
  }

  return (
    <MobileCard>
      <div className="flex items-start gap-3">
        <UserAvatar email={invite.email} variant="invite" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{invite.email}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <RoleBadge label={roleLabel} role={invite.role} />
            <StatusBadge status="pending" />
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Invited {formatRelativeTime(invite.created_at)}
          </p>
          <InviteActions
            invite={invite}
            isLoading={isLoading}
            canManage={canManage}
            onResend={onResend}
            onRevoke={onRevoke}
            className="mt-3 flex flex-wrap gap-1"
          />
        </div>
      </div>
    </MobileCard>
  );
}

export function PendingInvitesTable({
  invites,
  roles,
  canManage,
  onResend,
  onRevoke,
  loadingInviteId,
}: PendingInvitesTableProps) {
  if (invites.length === 0) {
    return (
      <EmptyState
        icon={LuMail}
        message="No pending invites. Invite someone to join your team."
      />
    );
  }

  const rowProps = invites.map((invite) => ({
    invite,
    roleLabel: getRoleLabel(roles, invite.role),
    isLoading: loadingInviteId === invite.id,
    canManage,
    onResend,
    onRevoke,
  }));

  return (
    <ResponsiveTable
      columns={["Email", "Role", "Invited", "Status"]}
      showActions={canManage}
      mobile={rowProps.map((props) => (
        <InviteRowContent key={props.invite.id} {...props} layout="card" />
      ))}
    >
      {rowProps.map((props) => (
        <InviteRowContent key={props.invite.id} {...props} layout="table" />
      ))}
    </ResponsiveTable>
  );
}
