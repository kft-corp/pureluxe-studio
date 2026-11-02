import type { ChatReplyCards, TripDetail } from "@/lib/trip-builder";

import type { TripChatAction } from "./hooks/use-trip-chat";
import type { TripBuilderChip } from "./trip-builder-action-chip";
import type { TripBuilderRateCard } from "./trip-builder-rate-card";

type Run = void | Promise<unknown>;

/** What each chip runs. The hook passes its own functions in. */
export type ComposerChipActions = {
  sendAction: (action: TripChatAction) => Run;
};

export type ComposerChipsInput = {
  detail: TripDetail | null;
  canWrite: boolean;
  replyCards: ChatReplyCards | null;
  actions: ComposerChipActions;
};

/**
 * Composer chips: Undo only.
 * Choices and Confirm/Cancel are typed in chat (plain text).
 */
export function buildComposerChips(input: ComposerChipsInput): {
  chips: TripBuilderChip[];
  rateCards: TripBuilderRateCard[];
} {
  const { canWrite, replyCards } = input;
  const chips: TripBuilderChip[] = [];

  if (canWrite && replyCards?.undo) {
    chips.push({
      id: "undo",
      label: "Undo",
      kind: "undo",
      onClick: () => void input.actions.sendAction({ action: "trip_undo", label: "Undo" }),
    });
  }

  return { chips, rateCards: [] };
}
