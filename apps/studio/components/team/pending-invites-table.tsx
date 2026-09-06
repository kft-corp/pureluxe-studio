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
  searchQuery?: string;
  hasActiveFilters?: boolean;
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
        {isLoading ? "Sending…" : "Resend"}
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

function EmailCell({ email }: { email: string }) {
  return (
    <a
      href={`mailto:${email}`}
      onClick={(event) => event.stopPropagation()}
      className="block max-w-[18rem] truncate font-medium text-ink underline-offset-2 hover:underline"
      title={email}
    >
      {email}
    </a>
  );
}

function emptyMessage(hasActiveFilters: boolean, searchQuery: string): string {
  const q = searchQuery.trim();
  if (q) return `No invites match “${q}”.`;
  if (hasActiveFilters) return "No pending invites for this filter.";
  return "No pending invites. Invite someone to join your team.";
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
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar email={invite.email} variant="invite" />
            <EmailCell email={invite.email} />
          </div>
        </TableCell>
        <TableCell>
          <RoleBadge label={roleLabel} role={invite.role} />
        </TableCell>
        <TableCell className="whitespace-nowrap text-ink-muted">
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
          <EmailCell email={invite.email} />
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
  searchQuery = "",
  hasActiveFilters = false,
  onResend,
  onRevoke,
  loadingInviteId,
}: PendingInvitesTableProps) {
  if (invites.length === 0) {
    return (
      <EmptyState
        icon={LuMail}
        message={emptyMessage(hasActiveFilters, searchQuery)}
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
