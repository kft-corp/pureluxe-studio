"use client";

import { useEffect, useRef } from "react";

import { Modal, ModalButton } from "@/components/ui/modal";

export type ConfirmDialogConfig = {
  title: string;
  description: string;
  confirmLabel: string;
  loadingLabel?: string;
  destructive?: boolean;
};

type ConfirmDialogProps = {
  open: boolean;
  config: ConfirmDialogConfig | null;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Shared confirm / destructive action dialog for Studio. */
export function ConfirmDialog({
  open,
  config,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && config) {
      confirmRef.current?.focus();
    }
  }, [open, config]);

  if (!open || !config) {
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
          <ModalButton
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </ModalButton>
          <ModalButton
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            variant={config.destructive ? "danger" : "primary"}
            className="w-full sm:w-auto"
          >
            {loading
              ? (config.loadingLabel ?? "Please wait…")
              : config.confirmLabel}
          </ModalButton>
        </>
      }
    />
  );
}
