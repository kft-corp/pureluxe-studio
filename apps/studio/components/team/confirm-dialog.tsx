"use client";

import { useEffect, useRef } from "react";

import { getConfirmDialogConfig } from "@/lib/team/confirm-dialog-config";
import type { TeamConfirmState } from "@/lib/team/confirm-dialog-config";
import { Modal, ModalButton } from "@/components/ui/modal";

type ConfirmDialogProps = {
  state: TeamConfirmState | null;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  state,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const config = getConfirmDialogConfig(state);

  useEffect(() => {
    if (config) {
      confirmRef.current?.focus();
    }
  }, [config]);

  if (!config) {
    return null;
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={config.title}
      description={config.description}
      footer={
        <>
          <ModalButton onClick={onClose} disabled={loading}>
            Cancel
          </ModalButton>
          <ModalButton
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            variant={config.destructive ? "danger" : "primary"}
          >
            {loading ? "Please wait…" : config.confirmLabel}
          </ModalButton>
        </>
      }
    />
  );
}
