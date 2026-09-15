import type { ConfirmDialogConfig } from "@/components/ui/confirm-dialog";

export type BookingConfirmAction =
  | "confirm"
  | "cancel"
  | "amend"
  | "delete_traveller";

/** Copy for confirm / amend / remove-traveller dialogs (cancel uses its own modal). */
export function getBookingConfirmConfig(input: {
  action: BookingConfirmAction | null;
  hasSupplierRef?: boolean;
  travellerName?: string | null;
}): ConfirmDialogConfig | null {
  switch (input.action) {
    case "confirm":
      return {
        title: "Confirm this booking?",
        description: input.hasSupplierRef
          ? "Mark as confirmed with the supplier. You can still edit refs and deadlines after."
          : "Mark as confirmed. Tip: add the confirmation / PNR in Commercial if you have it.",
        confirmLabel: "Confirm booking",
        loadingLabel: "Confirming…",
      };
    case "amend":
      return {
        title: "Amend this booking?",
        description:
          "Creates a new booking version and locks this one as superseded. You'll be taken to the new version.",
        confirmLabel: "Amend booking",
        loadingLabel: "Amending…",
      };
    case "delete_traveller":
      return {
        title: "Remove this traveller?",
        description: input.travellerName
          ? `“${input.travellerName}” will be removed from this booking. This can’t be undone.`
          : "This traveller will be removed from this booking. This can’t be undone.",
        confirmLabel: "Remove traveller",
        loadingLabel: "Removing…",
        destructive: true,
      };
    default:
      return null;
  }
}
