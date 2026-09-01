"use client";

import { useState } from "react";

import type { TeamMemberListItem, TeamOverviewData } from "@/lib/api/team";
import { updateTeamMemberRole } from "@/lib/api/team";
import { Modal, ModalButton } from "@/components/ui/modal";
import { showApiError, showOptionalSuccessToast } from "@/lib/feedback/toast";

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

  return (
    <Modal
      open
      onClose={onClose}
      title="Change role"
      description={`Update the role for ${member.name}.`}
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
          <span className="text-sm font-medium text-ink">Role</span>
          <RoleSelect roles={roles} value={role} onChange={setRole} />
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
