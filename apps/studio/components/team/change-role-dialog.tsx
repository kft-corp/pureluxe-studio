"use client";

import { useState } from "react";

import type { TeamMemberListItem, TeamOverviewData } from "@/lib/api/team";
import { updateTeamMemberRole } from "@/lib/api/team";
import { Modal, ModalButton } from "@/components/ui/modal";
import { showApiError, showOptionalSuccessToast } from "@/lib/feedback/toast";
import { getMemberDisplayName } from "@/lib/team/member-display-name";

import { RoleSelect } from "./role-select";

type ChangeRoleDialogProps = {
  open: boolean;
  member: TeamMemberListItem | null;
  roles: TeamOverviewData["roles"];
  onClose: () => void;
  onSuccess: () => void;
};

function ChangeRoleForm({
  member,
  roles,
  onClose,
  onSuccess,
}: {
  member: TeamMemberListItem;
  roles: TeamOverviewData["roles"];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [role, setRole] = useState(member.role);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await updateTeamMemberRole(member.id, role);
      onSuccess();
      onClose();
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }

  const displayName = getMemberDisplayName(member.name, member.email);

  return (
    <Modal
      open
      onClose={onClose}
      title="Change role"
      description={`Update what ${displayName} can do in Studio.`}
      footer={
        <>
          <ModalButton onClick={onClose} disabled={loading}>
            Cancel
          </ModalButton>
          <ModalButton
            type="submit"
            form="change-role-form"
            variant="primary"
            disabled={loading || role === member.role}
          >
            {loading ? "Saving…" : "Save role"}
          </ModalButton>
        </>
      }
    >
      <form id="change-role-form" onSubmit={handleSubmit} className="px-5 py-5">
        <label className="block">
          <span className="text-sm font-medium text-ink">
            Role
            <span className="ml-0.5 text-red-600" aria-hidden>
              *
            </span>
          </span>
          <RoleSelect id="change-role-select" roles={roles} value={role} onChange={setRole} />
          <p className="mt-1.5 text-xs text-ink-muted">
            Takes effect the next time they load Studio.
          </p>
        </label>
      </form>
    </Modal>
  );
}

export function ChangeRoleDialog({
  open,
  member,
  roles,
  onClose,
  onSuccess,
}: ChangeRoleDialogProps) {
  if (!open || !member) {
    return null;
  }

  return (
    <ChangeRoleForm
      key={member.id}
      member={member}
      roles={roles}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
