import type { ChatReplyCards, TripDetail } from "@/lib/trip-builder";

import type { TripChatAction } from "./hooks/use-trip-chat";
import { resolveTripStage } from "./stages";
import type { TripBuilderChip } from "./trip-builder-action-chip";
import type { TripBuilderRateCard } from "./trip-builder-rate-card";

type Run = void | Promise<unknown>;

/** What each chip runs. The hook passes its own functions in. */
export type ComposerChipActions = {
  sendAction: (action: TripChatAction) => Run;
  sendApproval: (decision: "approve" | "cancel") => Run;
  openTripPage: () => void;
};

export type ComposerChipsInput = {
  detail: TripDetail | null;
  canWrite: boolean;
  replyCards: ChatReplyCards | null;
  quietChips: boolean;
  actions: ComposerChipActions;
};

/** The agent's cards: Confirm and Cancel, one button per choice, and Undo. */
function replyCardChips(
  cards: ChatReplyCards,
  actions: Pick<ComposerChipActions, "sendAction" | "sendApproval">,
): TripBuilderChip[] {
  if (cards.approval) {
    return [
      {
        id: "approve",
        label: "Confirm",
        kind: "confirm",
        variant: "danger",
        onClick: () => void actions.sendApproval("approve"),
      },
      {
        id: "cancel",
        label: "Cancel",
        kind: "cancel",
        variant: "secondary",
        onClick: () => void actions.sendApproval("cancel"),
      },
    ];
  }
  const chips: TripBuilderChip[] = (cards.choices ?? []).slice(0, 8).map((choice, index) => ({
    id: `choice-${index}`,
    label: choice.label,
    kind: "choice",
    variant: index === 0 ? "primary" : "secondary",
    onClick: () =>
      void actions.sendAction({ action: choice.action, args: choice.args, label: choice.label }),
  }));
  if (cards.undo) {
    chips.push({
      id: "undo",
      label: "Undo",
      kind: "undo",
      variant: "secondary",
      icon: "undo",
      onClick: () => void actions.sendAction({ action: "trip_undo", label: "Undo" }),
    });
  }
  return chips;
}

/**
 * Chips under the composer (Stage 3d: agent reply cards + a few trip helpers).
 * Rate / quote "waiting for yes" chips are retired — those go through agent tools.
 */
export function buildComposerChips(input: ComposerChipsInput): {
  chips: TripBuilderChip[];
  rateCards: TripBuilderRateCard[];
} {
  const { detail, canWrite, replyCards, quietChips } = input;
  const { sendAction, openTripPage } = input.actions;
  const stage = resolveTripStage(detail);
  const agentChips = canWrite && replyCards ? replyCardChips(replyCards, input.actions) : [];
  const chips: TripBuilderChip[] = [...agentChips];

  if (replyCards?.approval) return { chips, rateCards: [] };

  const hideReady = quietChips || agentChips.length > 0;

  if (detail && canWrite && !hideReady && stage === "client" && detail.client) {
    const client = detail.client;
    const pastTripsLabel = `Past trips for ${client.display_name}`;
    chips.push({
      id: "past-trips",
      label: pastTripsLabel,
      variant: "secondary",
      onClick: () =>
        void sendAction({
          action: "history_search_trips",
          args: { client_id: client.id },
          label: pastTripsLabel,
        }),
    });
  }

  if (detail && canWrite && !hideReady && (stage === "quote" || stage === "booking")) {
    chips.push({
      id: "ask-readiness",
      label: "What's missing before booking?",
      variant: "secondary",
      onClick: () =>
        void sendAction({ action: "trip_get", label: "What's missing before booking?" }),
    });
    chips.push({
      id: "open-trip-page",
      label: "Open trip page",
      variant: "secondary",
      onClick: openTripPage,
    });
  }

  return { chips, rateCards: [] };
}
