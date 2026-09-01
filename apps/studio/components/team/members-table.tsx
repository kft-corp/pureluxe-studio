"use client";

import { LuUsers } from "react-icons/lu";

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
import type { TeamMemberListItem, TeamOverviewData } from "@/lib/api/team";
import { getMemberDisplayName } from "@/lib/team/member-display-name";
import { isCurrentMember } from "@/lib/team/is-current-member";
import { getRoleLabel } from "@/lib/team/role-label";

type MembersTableProps = {
  members: TeamMemberListItem[];
  roles: TeamOverviewData["roles"];
  canManage: boolean;
  currentMemberId: string;
  currentMemberEmail: string;
  onChangeRole: (member: TeamMemberListItem) => void;
  onDeactivate: (member: TeamMemberListItem) => void;
  onReactivate: (member: TeamMemberListItem) => void;
};

type MemberRowProps = {
  member: TeamMemberListItem;
  roles: TeamOverviewData["roles"];
  canManage: boolean;
  isSelf: boolean;
  displayName: string;
  roleLabel: string;
  onChangeRole: (member: TeamMemberListItem) => void;
  onDeactivate: (member: TeamMemberListItem) => void;
  onReactivate: (member: TeamMemberListItem) => void;
};

function MemberActions({
  member,
  isSelf,
  canManage,
  onChangeRole,
  onDeactivate,
  onReactivate,
  className,
}: Pick<
  MemberRowProps,
  | "member"
  | "isSelf"
  | "canManage"
  | "onChangeRole"
  | "onDeactivate"
  | "onReactivate"
> & { className?: string }) {
  if (!canManage) {
    return null;
  }

  return (
    <div className={className}>
      {member.active ? (
        <>
          <ActionButton onClick={() => onChangeRole(member)} disabled={isSelf}>
            Change role
          </ActionButton>
          <ActionButton
            onClick={() => onDeactivate(member)}
            disabled={isSelf}
            variant="danger"
          >
            Deactivate
          </ActionButton>
        </>
      ) : (
        <ActionButton onClick={() => onReactivate(member)}>Reactivate</ActionButton>
      )}
    </div>
  );
}

function MemberName({ name, isSelf }: { name: string; isSelf: boolean }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      <p className="truncate font-medium text-ink">{name}</p>
      {isSelf ? <span className="shrink-0 text-xs text-ink-subtle">(You)</span> : null}
    </div>
  );
}

function MemberRowContent({
  member,
  roles,
  canManage,
  isSelf,
  displayName,
  roleLabel,
  onChangeRole,
  onDeactivate,
  onReactivate,
  layout,
}: MemberRowProps & { layout: "table" | "card" }) {
  if (layout === "table") {
    return (
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-3">
            <UserAvatar name={displayName} email={member.email} />
            <MemberName name={displayName} isSelf={isSelf} />
          </div>
        </TableCell>
        <TableCell className="text-ink-muted">{member.email}</TableCell>
        <TableCell>
          <RoleBadge label={roleLabel} role={member.role} />
        </TableCell>
        <TableCell>
          <StatusBadge status={member.active ? "active" : "inactive"} />
        </TableCell>
        {canManage ? (
          <TableCell className="text-right">
            <MemberActions
              member={member}
              isSelf={isSelf}
              canManage={canManage}
              onChangeRole={onChangeRole}
              onDeactivate={onDeactivate}
              onReactivate={onReactivate}
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
        <UserAvatar name={displayName} email={member.email} />
        <div className="min-w-0 flex-1">
          <MemberName name={displayName} isSelf={isSelf} />
          <p className="mt-0.5 truncate text-sm text-ink-muted">{member.email}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <RoleBadge label={roleLabel} role={member.role} />
            <StatusBadge status={member.active ? "active" : "inactive"} />
          </div>
          <MemberActions
            member={member}
            isSelf={isSelf}
            canManage={canManage}
            onChangeRole={onChangeRole}
            onDeactivate={onDeactivate}
            onReactivate={onReactivate}
            className="mt-3 flex flex-wrap gap-1"
          />
        </div>
      </div>
    </MobileCard>
  );
}

export function MembersTable({
  members,
  roles,
  canManage,
  currentMemberId,
  currentMemberEmail,
  onChangeRole,
  onDeactivate,
  onReactivate,
}: MembersTableProps) {
  if (members.length === 0) {
    return (
      <EmptyState icon={LuUsers} message="No members match this filter." />
    );
  }

  const rowProps = members.map((member) => {
    const displayName = getMemberDisplayName(member.name, member.email);
    const isSelf = isCurrentMember(member, currentMemberId, currentMemberEmail);
    const roleLabel = getRoleLabel(roles, member.role);

    return {
      member,
      roles,
      canManage,
      isSelf,
      displayName,
      roleLabel,
      onChangeRole,
      onDeactivate,
      onReactivate,
    };
  });

  return (
    <ResponsiveTable
      columns={["Member", "Email", "Role", "Status"]}
      showActions={canManage}
      mobile={rowProps.map((props) => (
        <MemberRowContent key={props.member.id} {...props} layout="card" />
      ))}
    >
      {rowProps.map((props) => (
        <MemberRowContent key={props.member.id} {...props} layout="table" />
      ))}
    </ResponsiveTable>
  );
}
