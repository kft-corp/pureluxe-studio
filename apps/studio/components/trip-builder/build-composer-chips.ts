import type { NormalizedRateOption } from "@pureluxe/rates";

import type { ChatReplyCards, TripDetail } from "@/lib/trip-builder";
import { partyReady, type MoneyReply, type StayDraft } from "@/lib/trip-builder/intents";

import { cancellationForStay, explainRate } from "./explain-rate";
import type { TripChatAction } from "./hooks/use-trip-chat";
import { DECLINE_LABELS } from "./offer-reply";
import { isRateStage, resolveTripStage } from "./stages";
import type { TripBuilderChip } from "./trip-builder-action-chip";
import {
  formatMoney,
  listedRates,
  optionChipLabel,
  stayOn,
  type CostUpdate,
  type ListedRate,
  type Offer,
  type OptionCommit,
  type OptionDraft,
  type OptionsTextEdit,
  type PdfLineEdit,
  type SavedRate,
  type SellDraft,
} from "./trip-builder-helpers";
import type { TripBuilderRateCard } from "./trip-builder-rate-card";

type Run = void | Promise<unknown>;

/** What each chip runs. The hook passes its own functions in. */
export type ComposerChipActions = {
  /** Runs an agent tool directly (home chat or trip chat); the label is all the advisor sees. */
  sendAction: (action: TripChatAction) => Run;
  /** Confirm or Cancel on the agent's approval card. */
  sendApproval: (decision: "approve" | "cancel") => Run;
  openTripPage: () => void;
  commitCostUpdate: (update: CostUpdate) => Run;
  offerRoomPrice: (row: SavedRate, userLine: string) => void;
  searchRates: (source?: StayDraft, userLine?: string) => Run;
  pasteQuote: (text: string) => Run;
  offerAddRoom: (choice: ListedRate, price: MoneyReply | null, userLine: string) => void;
  offerSelectRoom: (choice: ListedRate, userLine: string) => void;
  applySell: (sell: SellDraft) => Run;
  commitOption: (commit: OptionCommit, userLine: string) => Run;
  commitSelect: (draft: OptionDraft, userLine: string) => Run;
  commitOptionsText: (edit: OptionsTextEdit, userLine: string) => Run;
  commitPdfEdits: (matches: PdfLineEdit[], userLine: string) => Run;
  openOptionsQuote: (userLine?: string) => Run;
  /** Says no to the open question without reading any text. */
  declineOffer: () => Run;
};

export type ComposerChipsInput = {
  detail: TripDetail | null;
  canWrite: boolean;
  /** The client accepted the quote. */
  quoteFrozen: boolean;
  activeLegId: string | null;
  stayDraft: StayDraft;
  rateOptions: NormalizedRateOption[];
  /** Cards on the agent's latest reply. Null while a reply is running. */
  replyCards: ChatReplyCards | null;
  quietChips: boolean;
  offer: Offer | null;
  /** A room waiting for the client price the advisor types next. */
  pendingOptionDraft: OptionDraft | null;
  pendingCostUpdate: CostUpdate | null;
  actions: ComposerChipActions;
};

/**
 * One chip leads (the first primary or danger); other primaries become secondary.
 * The "no" chip sits right after the lead so yes and no are side by side.
 */
function rankChips(chips: TripBuilderChip[], decline: TripBuilderChip | null): TripBuilderChip[] {
  const leadIndex = chips.findIndex(
    (chip) => chip.variant === "primary" || chip.variant === "danger",
  );
  const declines = decline ? [decline] : [];
  if (leadIndex < 0) return [...chips, ...declines];
  const rest = chips
    .filter((_, index) => index !== leadIndex)
    .map((chip) => (chip.variant === "primary" ? { ...chip, variant: "secondary" as const } : chip));
  return [chips[leadIndex]!, ...declines, ...rest];
}

/** The agent's cards: Confirm and Cancel, one button per choice, and Undo. */
function replyCardChips(
  cards: ChatReplyCards,
  actions: Pick<ComposerChipActions, "sendAction" | "sendApproval">,
): TripBuilderChip[] {
  if (cards.approval) {
    return [
      { id: "approve", label: "Confirm", variant: "danger", onClick: () => void actions.sendApproval("approve") },
      { id: "cancel", label: "Cancel", variant: "secondary", onClick: () => void actions.sendApproval("cancel") },
    ];
  }
  const chips: TripBuilderChip[] = (cards.choices ?? []).slice(0, 6).map((choice, index) => ({
    id: `choice-${index}`,
    label: choice.label,
    variant: index === 0 ? "primary" : "secondary",
    onClick: () => void actions.sendAction({ action: choice.action, args: choice.args, label: choice.label }),
  }));
  if (cards.undo) {
    chips.push({
      id: "undo",
      label: "Undo",
      variant: "secondary",
      icon: "undo",
      onClick: () => void actions.sendAction({ action: "trip_undo", label: "Undo" }),
    });
  }
  return chips;
}

/** The chips under the composer and the rate cards on the last reply, for the current state. */
export function buildComposerChips(input: ComposerChipsInput): {
  chips: TripBuilderChip[];
  rateCards: TripBuilderRateCard[];
} {
  const {
    detail,
    canWrite,
    quoteFrozen,
    activeLegId,
    stayDraft,
    rateOptions,
    replyCards,
    quietChips,
    offer,
    pendingOptionDraft,
    pendingCostUpdate,
  } = input;
  const {
    sendAction,
    openTripPage,
    commitCostUpdate,
    offerRoomPrice,
    searchRates,
    pasteQuote,
    offerAddRoom,
    offerSelectRoom,
    applySell,
    commitOption,
    commitSelect,
    commitOptionsText,
    commitPdfEdits,
    openOptionsQuote,
    declineOffer,
  } = input.actions;

  const stage = resolveTripStage(detail);
  const openStay = stayOn(detail, activeLegId);
  const agentChips = canWrite && replyCards ? replyCardChips(replyCards, input.actions) : [];
  const chips: TripBuilderChip[] = [...agentChips];
  if (replyCards?.approval) return { chips, rateCards: [] };

  const hasConfirm = Boolean(offer || pendingOptionDraft || agentChips.length > 0);
  const hideReady = quietChips || hasConfirm;
  const rateSearchOffered = offer?.type === "rate-search";

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

  const chosenRoom =
    detail && isRateStage(stage)
      ? (detail.rates.candidates.find(
          (rate) => rate.selected && rate.leg_id === (openStay?.leg_id ?? null),
        ) ?? null)
      : null;
  // The server allows price edits on the chosen room before the quote is locked and after the client accepts.
  const canPriceChosen = Boolean(detail && (quoteFrozen || !detail.pricing_locked));

  if (detail && canWrite && isRateStage(stage) && (detail.pricing_locked || chosenRoom)) {
    if (pendingCostUpdate && canPriceChosen) {
      const update = pendingCostUpdate;
      chips.push({
        id: "use-today-cost",
        label: `Use today's cost · ${formatMoney(update.amount, update.currency)}`,
        variant: "primary",
        onClick: () => void commitCostUpdate(update),
      });
    }
    if (!hideReady || rateSearchOffered) {
      const needsPrice = Boolean(chosenRoom && canPriceChosen && chosenRoom.sell_amount == null);
      if (chosenRoom && canPriceChosen) {
        const room = chosenRoom.subtitle?.trim() || chosenRoom.title;
        const short = room.length > 28 ? `${room.slice(0, 28).trim()}…` : room;
        chips.push({
          id: "set-room-price",
          label: `Set client price · ${short}`,
          variant: needsPrice ? "primary" : "secondary",
          onClick: () => offerRoomPrice(chosenRoom, `Set client price · ${short}`),
        });
      }
      const hotel = chosenRoom?.property_name?.trim() || openStay?.property_name?.trim();
      chips.push({
        id: "search-rates",
        label: hotel ? `Search rates again · ${hotel}` : "Search rates again",
        variant:
          rateSearchOffered || (chosenRoom && !needsPrice && !pendingCostUpdate)
            ? "primary"
            : "secondary",
        onClick: () => void searchRates(undefined, hotel ? `Search rates again · ${hotel}` : "Search rates again"),
      });
    }
  }

  if (detail && canWrite && !detail.pricing_locked && isRateStage(stage)) {
    if (!chosenRoom && (rateSearchOffered || (!hideReady && stage === "rates"))) {
      const partyLabel = partyReady(stayDraft)
        ? `${stayDraft.adults} adults · ${stayDraft.rooms} ${stayDraft.rooms === 1 ? "room" : "rooms"}`
        : null;
      chips.push({
        id: "search-rates",
        label:
          stage !== "rates"
            ? "Search rates"
            : partyLabel
              ? `Search rates · ${partyLabel}`
              : "Add party to search rates",
        variant: "primary",
        onClick: () => void searchRates(),
      });
    } else if (!chosenRoom && !hideReady) {
      chips.push({
        id: "search-rates",
        label: "Search rates",
        variant: "secondary",
        onClick: () => void searchRates(),
      });
    }

    if (offer?.type === "paste") {
      const text = offer.text;
      chips.push({
        id: "paste-rate",
        label: "Use pasted quote",
        variant: "secondary",
        onClick: () => void pasteQuote(text),
      });
    }
  }

  const showRateCards =
    stage === "rates" ||
    ((stage === "quote" || stage === "booking") && rateOptions.length > 0);
  const rateCards: TripBuilderRateCard[] =
    detail && canWrite && !detail.pricing_locked && showRateCards
      ? listedRates(rateOptions, detail.rates.candidates, activeLegId).map((choice, index) => {
          if (choice.kind === "search") {
            const explained = explainRate(choice.option);
            return {
              id: `rate-opt-${index}-${choice.option.rate_source_code}`,
              index: index + 1,
              recommended: choice.option.recommended,
              room: explained.room,
              board: explained.board,
              price: explained.price,
              priceRule: explained.why,
              occupancy: explained.occupancy,
              inclusions: explained.benefits,
              cancellation: explained.cancellation,
              onAddToOptions: () => offerAddRoom(choice, null, "Add for the client"),
            };
          }
          const cost = formatMoney(choice.row.cost_internal, choice.row.currency);
          return {
            id: `rate-cand-${choice.row.id}`,
            index: index + 1,
            recommended: false,
            room: choice.title,
            board: choice.row.subtitle,
            price: cost ?? "Not listed",
            priceRule: null,
            occupancy: null,
            inclusions: choice.row.inclusions.slice(0, 4),
            cancellation: cancellationForStay(choice.row.cancellation_policy, null),
            onSelect: () => offerSelectRoom(choice, "Client chose this"),
          };
        })
      : [];

  if (detail && canWrite && offer?.type === "sell" && isRateStage(stage)) {
    const sell = offer.sell;
    chips.push({
      id: "apply-sell",
      label: `Set client price · ${formatMoney(sell.sell_total, sell.sell_currency)}`,
      variant: "secondary",
      onClick: () => void applySell(sell),
    });
  }

  if (detail && canWrite && offer?.type === "add-option") {
    const commit = offer.commit;
    chips.push({
      id: "add-option",
      label: optionChipLabel(commit),
      variant: "primary",
      onClick: () => void commitOption(commit, optionChipLabel(commit)),
    });
  }

  if (detail && canWrite && offer?.type === "select-room") {
    const draft = offer.room;
    const room = draft.title.length > 32 ? `${draft.title.slice(0, 32).trim()}…` : draft.title;
    chips.push({
      id: "select-room",
      label: `Client chose · ${room}`,
      variant: "primary",
      onClick: () => void commitSelect(draft, `Client chose · ${room}`),
    });
  }

  if (detail && canWrite && offer?.type === "options-text") {
    const edit = offer.edit;
    chips.push({
      id: "options-text",
      label: edit.field === "title" ? "Set options title" : "Set options note",
      variant: "secondary",
      onClick: () => void commitOptionsText(edit, edit.field === "title" ? "Set options title" : "Set options note"),
    });
  }

  if (detail && canWrite && offer?.type === "options-edit") {
    const matches = offer.matches;
    if (matches.length === 1) {
      chips.push({
        id: "options-edit",
        label: "Change this line",
        variant: "primary",
        onClick: () => void commitPdfEdits(matches, "Change this line"),
      });
    } else {
      chips.push({
        id: "options-edit-all",
        label: "Change every line",
        variant: "primary",
        onClick: () => void commitPdfEdits(matches, "Change every line"),
      });
      matches.slice(0, 6).forEach((row, index) => {
        const short = row.label.length > 32 ? `${row.label.slice(0, 32).trim()}…` : row.label;
        chips.push({
          id: `options-edit-${index}`,
          label: `Only ${short}`,
          variant: "secondary",
          onClick: () => void commitPdfEdits([row], `Only ${short}`),
        });
      });
    }
  }

  if (detail && canWrite && offer?.type === "options-preview") {
    chips.push({
      id: "open-options",
      label: "Open options quote",
      variant: "primary",
      onClick: () => void openOptionsQuote("Open options quote"),
    });
  }

  if (detail && canWrite && !hideReady && (stage === "quote" || stage === "booking")) {
    chips.push({
      id: "ask-readiness",
      label: "What's missing before booking?",
      variant: "secondary",
      onClick: () => void sendAction({ action: "trip_get", label: "What's missing before booking?" }),
    });
    chips.push({
      id: "open-trip-page",
      label: "Open trip page",
      variant: "secondary",
      onClick: openTripPage,
    });
  }

  const declineLabel = detail && canWrite && offer ? DECLINE_LABELS[offer.type] : undefined;
  const declineChip: TripBuilderChip | null = declineLabel
    ? { id: "decline", label: declineLabel, variant: "secondary", onClick: () => void declineOffer() }
    : null;

  return { chips: rankChips(chips, declineChip), rateCards };
}
