"use client";

import { ConfirmDialog as StudioConfirmDialog } from "@/components/ui/confirm-dialog";
import { getConfirmDialogConfig } from "@/lib/team/confirm-dialog-config";
import type { TeamConfirmState } from "@/lib/team/confirm-dialog-config";

type ConfirmDialogProps = {
  state: TeamConfirmState | null;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Team confirm dialog — thin wrapper over the shared Studio confirm. */
export function ConfirmDialog({
  state,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const config = getConfirmDialogConfig(state);

  return (
    <StudioConfirmDialog
      open={Boolean(config)}
      config={config}
      loading={loading}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
