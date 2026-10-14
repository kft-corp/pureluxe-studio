import { formatDocumentType } from "@/lib/clients/client-format";

import type { ConfirmDialogConfig } from "@/components/ui/confirm-dialog";

export type ClientDocumentConfirmAction = "verify" | "reject" | "remove";

export type ClientConfirmState =
  | { type: "deactivate"; clientName: string }
  | {
      type: "document";
      action: ClientDocumentConfirmAction;
      documentType: string | null;
    };

export function getClientConfirmConfig(
  state: ClientConfirmState | null,
): ConfirmDialogConfig | null {
  if (!state) return null;

  if (state.type === "deactivate") {
    return {
      title: "Deactivate client?",
      description: `${state.clientName} will leave the active directory. History stays for audit and bookings.`,
      confirmLabel: "Deactivate",
      loadingLabel: "Deactivating…",
      destructive: true,
    };
  }

  const label = formatDocumentType(state.documentType ?? "other").toLowerCase();

  switch (state.action) {
    case "verify":
      return {
        title: "Verify document?",
        description: `Mark this ${label} as verified. It will count toward profile completeness.`,
        confirmLabel: "Verify",
        loadingLabel: "Verifying…",
        destructive: false,
      };
    case "reject":
      return {
        title: "Reject document?",
        description: `Mark this ${label} as rejected. You can upload a new file later.`,
        confirmLabel: "Reject",
        loadingLabel: "Rejecting…",
        destructive: true,
      };
    case "remove":
      return {
        title: "Remove document?",
        description: `This ${label} and its file will be permanently removed.`,
        confirmLabel: "Remove",
        loadingLabel: "Removing…",
        destructive: true,
      };
  }
}
