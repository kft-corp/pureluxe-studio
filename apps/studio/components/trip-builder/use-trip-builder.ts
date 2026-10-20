"use client";

import { useEffect, useRef, useState } from "react";

import { answerPriceQuestion, markupPercentFromNotes } from "@/lib/rates/price-math";
import {
  isConfirmReply,
  isDeclineReply,
  isOptionsAdd,
  isPriceSkip,
  isSupplierPaste,
  isTripQuestion,
  looksLikeOptionsPdfEdit,
  matchRateChoice,
  mergeStayDraft,
  parseMoneyReply,
  parseOptionClientPrice,
  parseOptionsWording,
  parseQuoteEdit,
  parseSellMessage,
  parseStayMessage,
  partyReady,
  splitTrailingPrice,
  wantsOptionsPreview,
  wantsRateSearch,
} from "@/lib/trip-builder/intents";

import { buildComposerChips } from "./build-composer-chips";
import { useOptionsQuote } from "./hooks/use-options-quote";
import { useTripChat } from "./hooks/use-trip-chat";
import { useTripCore, type UseTripBuilderOptions } from "./hooks/use-trip-core";
import { useTripRates } from "./hooks/use-trip-rates";
import { useTripSession } from "./hooks/use-trip-session";
import { DECLINE_LABELS, DECLINE_REPLIES, readReply } from "./offer-reply";
import { buildQuoteBreakup } from "./quote-price";
import {
  isRateStage,
  legsConfirmed,
  partyFromTravellers,
  resolveTripStage,
  travellersConfirmed,
  tripStays,
} from "./stages";
import type { TripBuilderChip } from "./trip-builder-action-chip";
import { listedRates, stayOn } from "./trip-builder-helpers";

export function useTripBuilder(options: UseTripBuilderOptions) {
  const core = useTripCore(options);
  const chat = useTripChat(core, options.initialDetail);
  const session = useTripSession(core, chat, options.prefillClientId ?? null);
  const {
    trips,
    detail,
    canWrite,
    quoteFrozen,
    summaryOpen,
    setSummaryOpen,
    busy,
    rateOptions,
    rateStayNotes,
    suggestedClients,
    quietChips,
    setQuietChips,
    activeLegIdRef,
    activeLegId,
    stayDraft,
    setStayDraft,
    offer,
    setOffer,
    pendingOptionDraft,
    setPendingOptionDraft,
    pendingCostUpdate,
    clearOfferedChips,
    selectLeg,
  } = core;
  const {
    chatBusy,
    messages,
    chatLoading,
    chatLoadingOlder,
    hasMoreMessages,
    streamingContent,
    agentPhase,
    agentProgress,
    loadOlderMessages,
    sendHomeChat,
    sendTripChat,
    sendTripAction,
    sendApproval,
    appendTurn,
    beginTap,
    clearTap,
    queuedCount,
    queuePaused,
    enqueueMessage,
    dequeueMessage,
  } = chat;
  const { pending, openTrip, newChat, createTrip, openTripPage, promptCreateTrip } = session;
  const {
    offerOptionsText,
    commitOptionsText,
    commitPdfEdits,
    offerPdfEdit,
    offerOptionsPreview,
    openOptionsQuote,
    regenerateOptionsQuote,
  } = useOptionsQuote(core, chat);
  const {
    searchRates,
    roomsForPriceMath,
    offerAddRoom,
    offerSelectRoom,
    offerChooseSaved,
    offerRoomPrice,
    commitCostUpdate,
    acceptDraftPrice,
    commitOption,
    commitSelect,
    pasteQuote,
    applySell,
  } = useTripRates(core, chat);

  const lastMessage = messages.at(-1);
  const replyCards =
    !chatBusy && lastMessage?.role === "assistant" ? (lastMessage.cards ?? null) : null;

  /**
   * Routes one typed message. The sections run in this order and the first one that
   * handles the message returns, so a new intent has to sit in the right section.
   *  0. A reply is still running: queue it; it is sent when the chat is free.
   *  1. No trip open: home chat.
   *  2. Yes or no to the agent's approval card.
   *  3. A room is waiting for its client price.
   *  4. Any other new message clears the chips on offer.
   *  5. Yes or no to the pending rate or quote question.
   *  6. Rates, client prices, and quote wording. The stay draft for a rate search
   *     updates here without returning.
   *  7. Anything else goes to the agent: client, travellers, dates, stays, hotels, questions.
   */
  async function handleSend(text: string) {
    const message = text.trim();
    if (!message || !canWrite) return;

    // 0. A reply is still running.
    if (chatBusy) {
      enqueueMessage(message);
      return;
    }
    clearTap();

    // 1. No trip open: home chat.
    if (!detail) {
      await sendHomeChat(message);
      return;
    }

    // 2. Yes or no to the agent's approval card.
    if (replyCards?.approval && (isConfirmReply(message) || isDeclineReply(message))) {
      await sendApproval(isConfirmReply(message) ? "approve" : "cancel");
      return;
    }

    // 3. A room is waiting for its client price.
    if (pendingOptionDraft && !offer && isDeclineReply(message)) {
      setPendingOptionDraft(null);
      void appendTurn(message, "Okay. I won't add that room.");
      return;
    }
    if (pendingOptionDraft && !offer && isConfirmReply(message)) {
      void appendTurn(
        message,
        `Send the client price for **${pendingOptionDraft.title}**, for example **2400 ${pendingOptionDraft.currency ?? "USD"}**. Say **to be confirmed** to leave it empty.`,
      );
      return;
    }
    if (
      pendingOptionDraft &&
      !isConfirmReply(message) &&
      !isDeclineReply(message) &&
      (isPriceSkip(message) || parseMoneyReply(message))
    ) {
      acceptDraftPrice(message);
      return;
    }

    // 4. Any other new message clears the chips on offer.
    const stage = resolveTripStage(detail);
    const openStay = stayOn(detail, activeLegIdRef.current);
    const stays = tripStays(detail);
    if (!isConfirmReply(message) && !isDeclineReply(message)) {
      const holdDraft =
        pendingOptionDraft && offer?.type !== "add-option" && isTripQuestion(message)
          ? pendingOptionDraft
          : null;
      clearOfferedChips();
      if (holdDraft) setPendingOptionDraft(holdDraft);
      const writing =
        wantsRateSearch(message) ||
        Boolean(parseSellMessage(message)) ||
        Boolean(parseQuoteEdit(message)) ||
        Boolean(parseOptionsWording(message)) ||
        looksLikeOptionsPdfEdit(message) ||
        wantsOptionsPreview(message) ||
        isSupplierPaste(message);
      setQuietChips(isTripQuestion(message) && !writing && !holdDraft);
    } else {
      setQuietChips(false);
    }

    // 5. Yes or no to the pending rate or quote question.
    const reply = readReply(offer, message);
    if (offer && reply) {
      const open = offer;
      setOffer(null);
      if (reply.kind === "decline") {
        if (open.type === "add-option") setPendingOptionDraft(null);
        void appendTurn(message, reply.reply);
        return;
      }
      switch (open.type) {
        case "rate-search":
          void searchRates(stayDraft, message);
          return;
        case "paste":
          void pasteQuote(open.text);
          return;
        case "sell":
          void applySell(open.sell);
          return;
        case "add-option":
          void commitOption(open.commit, message);
          return;
        case "select-room":
          void commitSelect(open.room, message);
          return;
        case "options-text":
          void commitOptionsText(open.edit, message);
          return;
        case "options-edit":
          void commitPdfEdits(open.matches, message);
          return;
        case "options-preview":
          void openOptionsQuote(message);
          return;
        default: {
          const unhandled: never = open;
          return unhandled;
        }
      }
    }

    // 6. Rates, client prices, and quote wording.
    const rateStage = isRateStage(stage);
    const asking = isTripQuestion(message) && !wantsOptionsPreview(message);
    const optionPrice = parseOptionClientPrice(message);
    if (rateStage && wantsOptionsPreview(message)) {
      offerOptionsPreview(message);
      return;
    }
    if (optionPrice && !asking && !detail.pricing_locked && rateStage) {
      const choices = listedRates(
        rateOptions,
        detail.rates.candidates,
        activeLegIdRef.current,
      );
      const query = optionPrice.room ? `add ${optionPrice.room}` : "";
      const picked = query
        ? matchRateChoice(query, choices)
        : choices.length === 1
          ? choices[0]
          : choices.length > 1
            ? "ambiguous"
            : null;
      if (picked === "ambiguous" || !picked) {
        const list = choices.map((choice) => `**${choice.title}**`).join(", ");
        void appendTurn(
          message,
          list
            ? `Which room? ${list}. For example: **client price ${optionPrice.amount} ${optionPrice.currency ?? "USD"} for ${choices[0]?.title ?? "the room name"}**.`
            : "Add a room first. Say **add** and the room name.",
        );
        return;
      }
      offerAddRoom(picked, { amount: optionPrice.amount, currency: optionPrice.currency }, message);
      return;
    }
    if (rateStage) {
      const mathReply = answerPriceQuestion(
        message,
        roomsForPriceMath(),
        markupPercentFromNotes(rateStayNotes?.markup ?? null),
        {
          amount: detail.trip.sell_total,
          currency: detail.trip.sell_currency,
          teamCost: buildQuoteBreakup({
            stays,
            rates: detail.rates.candidates,
            sellTotal: detail.trip.sell_total,
            sellCurrency: detail.trip.sell_currency,
          }).teamCostAmount,
        },
        pendingOptionDraft?.title ?? null,
      );
      if (mathReply) {
        void appendTurn(message, mathReply);
        return;
      }
    }

    const sellRequest = parseSellMessage(message);
    const quoteRequest = parseQuoteEdit(message);
    const openHasRate = detail.rates.candidates.some(
      (rate) => rate.selected && rate.leg_id === (openStay?.leg_id ?? null),
    );
    if (rateStage && detail.pricing_locked && !asking) {
      const lockedPick =
        !wantsRateSearch(message) && !isSupplierPaste(message) && !sellRequest && !quoteRequest
          ? matchRateChoice(
              splitTrailingPrice(message).text,
              listedRates([], detail.rates.candidates, activeLegIdRef.current),
            )
          : null;
      if (
        lockedPick &&
        lockedPick !== "ambiguous" &&
        lockedPick.kind === "saved" &&
        !lockedPick.row.selected &&
        lockedPick.row.sell_amount != null &&
        !isOptionsAdd(message)
      ) {
        offerSelectRoom(lockedPick, message);
        return;
      }
      if (
        !wantsRateSearch(message) &&
        (isSupplierPaste(message) ||
          sellRequest ||
          quoteRequest ||
          matchRateChoice(
            message,
            listedRates(rateOptions, detail.rates.candidates, activeLegIdRef.current),
          ))
      ) {
        void appendTurn(
          message,
          "The client accepted this quote, so new rooms, the trip total, and the quote wording stay as they are. You can still tap **Check availability** for today's price, or **Set client price** on the client's chosen room. To change anything else, reopen the quote on the trip page.",
        );
        return;
      }
    }

    if (
      rateStage &&
      !detail.pricing_locked &&
      !asking &&
      !isSupplierPaste(message) &&
      !sellRequest &&
      !quoteRequest
    ) {
      const priced = splitTrailingPrice(message);
      const choices = listedRates(
        rateOptions,
        detail.rates.candidates,
        activeLegIdRef.current,
      );
      const picked = matchRateChoice(priced.text, choices);
      if (picked === "ambiguous") {
        void appendTurn(
          message,
          "More than one rate matches that. Type **add 1** or **client chose 1**, or the full room name.",
        );
        return;
      }
      if (picked) {
        if (isOptionsAdd(priced.text)) offerAddRoom(picked, priced.price, message);
        else offerSelectRoom(picked, message);
        return;
      }
    }

    // Does not return: the party and rooms for a rate search, from what was typed.
    let searchDraft = stayDraft;
    if ((stage === "stay" || stage === "rates") && legsConfirmed(detail)) {
      searchDraft = mergeStayDraft(
        stayDraft,
        parseStayMessage(message, { partyOnly: stage === "rates" }),
      );
      setStayDraft(searchDraft);
    }
    if (
      rateStage &&
      !asking &&
      !isSupplierPaste(message) &&
      !sellRequest &&
      !quoteRequest &&
      wantsRateSearch(message)
    ) {
      const named = travellersConfirmed(detail) ? partyFromTravellers(detail) : null;
      const draft = searchDraft;
      const ready =
        openStay &&
        draft.rooms != null &&
        ((named && named.adults >= 1) || partyReady(draft));
      if (!ready) {
        void appendTurn(
          message,
          named && named.adults >= 1
            ? "I still need the rooms before I search. For example **Rooms: 1**."
            : "I still need adults, children, and rooms before I search. For example **Adults: 2**, **Children: 0**, **Rooms: 1**.",
        );
        return;
      }
      setOffer({ type: "rate-search" });
      const rooms = draft.rooms === 1 ? "1 room" : `${draft.rooms} rooms`;
      void appendTurn(
        message,
        `Search **${openStay.property_name ?? draft.hotel}** in **${openStay.city}**, ${openStay.check_in} to ${openStay.check_out}, ${draft.adults} adults, ${draft.children} children, ${rooms}?\n\nSay **yes** or tap **Search rates**. Say **no** to cancel.`,
      );
      return;
    }
    if (
      rateStage &&
      !detail.pricing_locked &&
      isSupplierPaste(message) &&
      !sellRequest &&
      !quoteRequest
    ) {
      if (!openStay?.check_in || !openStay.check_out) {
        void appendTurn(message, "Save the stay dates first, then paste the supplier total.");
        return;
      }
      setOffer({ type: "paste", text: message });
      setQuietChips(false);
      void appendTurn(
        message,
        "Use this pasted quote as the team cost for this stay? Say **yes** or tap **Use pasted quote**. Say **no** to cancel.",
      );
      return;
    }
    const optionsRows = detail.rates.candidates.some((row) => !row.selected);
    const optionsWording =
      parseOptionsWording(message) ??
      (optionsRows &&
      !openHasRate &&
      quoteRequest &&
      (quoteRequest.field === "title" || quoteRequest.field === "notes")
        ? { field: quoteRequest.field, value: quoteRequest.value }
        : null);
    if (optionsWording && rateStage && !asking) {
      const canEditOptions =
        optionsRows ||
        detail.rates.candidates.some((row) => row.selected) ||
        Boolean(detail.options_quote.document?.has_file);
      if (!canEditOptions) {
        void appendTurn(message, "Add a room to the options quote first. Then set the note or the title.");
        return;
      }
      offerOptionsText(optionsWording, message);
      return;
    }
    if (quoteRequest && optionsRows && rateStage && !asking) {
      void appendTurn(
        message,
        "That line is on the options quote. Say **note:** or **options title:**, or say which words to change.",
      );
      return;
    }
    if (sellRequest && (stage === "quote" || stage === "booking" || (stage === "rates" && openHasRate)) && !asking) {
      setOffer({ type: "sell", sell: sellRequest });
      setQuietChips(false);
      void appendTurn(
        message,
        `Set the client price to **${sellRequest.sell_currency} ${sellRequest.sell_total}**? Say **yes** or tap **Set sell ${sellRequest.sell_currency} ${sellRequest.sell_total}**. Say **no** to cancel.`,
      );
      return;
    }
    if (stage === "rates" && !asking && (sellRequest || quoteRequest)) {
      void appendTurn(
        message,
        optionsRows
          ? "For the options PDF, say **note:** or **options title:**, or say which words to change."
          : "Add a room to the options quote first. Then set the note or the title.",
      );
      return;
    }
    if (
      rateStage &&
      looksLikeOptionsPdfEdit(message) &&
      (optionsRows ||
        detail.rates.candidates.some((row) => row.selected) ||
        Boolean(detail.options_quote.document?.has_file))
    ) {
      const offered = await offerPdfEdit(message);
      if (offered) return;
    }

    // 7. Anything else goes to the agent.
    await sendTripChat(message);
  }

  /** The "no" chip: closes the open question directly, without reading any text. */
  function declineOffer() {
    const open = offer;
    if (!open) return;
    setOffer(null);
    setQuietChips(false);
    if (open.type === "add-option") setPendingOptionDraft(null);
    void appendTurn(DECLINE_LABELS[open.type], DECLINE_REPLIES[open.type]);
  }

  // Send what was typed during a reply once the chat is free, one message at a time.
  // Runs after every render so the router always sees the latest trip state.
  const flushingRef = useRef(false);
  const [, setFlushTick] = useState(0);
  useEffect(() => {
    if (flushingRef.current || chatBusy || busy || pending || queuePaused || queuedCount === 0) {
      return;
    }
    const next = dequeueMessage();
    if (!next) return;
    flushingRef.current = true;
    void handleSend(next).finally(() => {
      flushingRef.current = false;
      setFlushTick((tick) => tick + 1);
    });
  });

  const built = buildComposerChips({
    detail,
    canWrite,
    quoteFrozen,
    activeLegId,
    stayDraft,
    rateOptions,
    suggestedClients,
    replyCards,
    quietChips,
    offer,
    pendingOptionDraft,
    pendingCostUpdate,
    actions: {
      promptCreateTrip,
      createTrip,
      sendTripAction,
      sendApproval,
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
    },
  });
  // A tap marks the chat line it writes as a button tap, never as typed text.
  const chips: TripBuilderChip[] = built.chips.map((chip) => ({
    ...chip,
    onClick: () => {
      beginTap(chip.id);
      chip.onClick();
    },
  }));
  const rateCards = built.rateCards.map((card) => ({
    ...card,
    onAddToOptions: card.onAddToOptions
      ? () => {
          beginTap(`${card.id}:add`);
          card.onAddToOptions?.();
        }
      : undefined,
    onSelect: card.onSelect
      ? () => {
          beginTap(`${card.id}:select`);
          card.onSelect?.();
        }
      : undefined,
  }));
  const homeChips: TripBuilderChip[] = [];

  return {
    trips,
    detail,
    summaryOpen,
    setSummaryOpen,
    busy: busy || pending,
    chatBusy,
    canWrite,
    messages,
    chatLoading,
    chatLoadingOlder,
    hasMoreMessages,
    streamingContent,
    agentPhase,
    agentProgress,
    queuedCount,
    chips,
    rateCards,
    stayNotes: rateOptions.length > 0 ? rateStayNotes : null,
    activeLegId,
    selectLeg,
    homeChips,
    openTrip,
    newChat,
    createTrip,
    promptCreateTrip,
    handleSend,
    loadOlderMessages,
    openOptionsQuote,
    regenerateOptionsQuote,
    offerChooseSaved,
  };
}
