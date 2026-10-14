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

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
      {children}
      {required ? (
        <span className="ml-0.5 text-red-600" aria-hidden>
          *
        </span>
      ) : null}
    </label>
  );
}

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
      description="They’ll get an email and sign in with Google — no password needed."
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
        <div>
          <FieldLabel htmlFor="invite-email" required>
            Work email
          </FieldLabel>
          <input
            id="invite-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@kft.com"
            className={modalFieldClassName}
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            Use their Google Workspace email so they can accept the invite.
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="invite-role" required>
            Role
          </FieldLabel>
          <RoleSelect
            id="invite-role"
            roles={roles}
            value={role}
            onChange={setRole}
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            Controls what they can see and do in Studio. You can change this later.
          </p>
        </div>
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
