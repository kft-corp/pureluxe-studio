"use client";

import { useState } from "react";

import type { TeamOverviewData } from "@/lib/api/team";
import { inviteTeamMember } from "@/lib/api/team";
import { Modal, ModalButton, modalFieldClassName } from "@/components/ui/modal";
import { showApiError, showOptionalSuccessToast } from "@/lib/feedback/toast";

import { RoleSelect } from "./role-select";

type InviteMemberDialogProps = {
  open: boolean;
  roles: TeamOverviewData["roles"];
  onClose: () => void;
  onSuccess: () => void;
};

function InviteMemberForm({
  roles,
  onClose,
  onSuccess,
}: Omit<InviteMemberDialogProps, "open">) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles[0]?.slug ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await inviteTeamMember({ email, role });
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
      title="Invite member"
      description="They will sign in with Google once invited."
      footer={
        <>
          <ModalButton onClick={onClose} disabled={loading}>
            Cancel
          </ModalButton>
          <ModalButton
            type="submit"
            form="invite-member-form"
            variant="primary"
            disabled={loading || roles.length === 0}
          >
            {loading ? "Sending…" : "Send invite"}
          </ModalButton>
        </>
      }
    >
      <form id="invite-member-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        <label className="block">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@kft.com"
            className={modalFieldClassName}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Role</span>
          <RoleSelect roles={roles} value={role} onChange={setRole} />
        </label>
      </form>
    </Modal>
  );
}

export function InviteMemberDialog({ open, roles, onClose, onSuccess }: InviteMemberDialogProps) {
  if (!open) {
    return null;
  }

  return <InviteMemberForm roles={roles} onClose={onClose} onSuccess={onSuccess} />;
}
