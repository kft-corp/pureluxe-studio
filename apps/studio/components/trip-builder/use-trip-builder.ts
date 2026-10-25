"use client";

import { useEffect, useRef, useState } from "react";

import { isConfirmReply, isDeclineReply, isTripQuestion } from "@/lib/trip-builder/intents";

import { buildComposerChips } from "./build-composer-chips";
import { useOptionsQuote } from "./hooks/use-options-quote";
import { useTripChat } from "./hooks/use-trip-chat";
import { useTripCore, type UseTripBuilderOptions } from "./hooks/use-trip-core";
import { useTripRates } from "./hooks/use-trip-rates";
import { useTripSession } from "./hooks/use-trip-session";
import type { TripBuilderChip } from "./trip-builder-action-chip";

export function useTripBuilder(options: UseTripBuilderOptions) {
  const core = useTripCore(options);
  const chat = useTripChat(core, options.initialDetail);
  const session = useTripSession(core, chat);
  const {
    trips,
    detail,
    canWrite,
    busy,
    quietChips,
    setQuietChips,
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
    agentSteps,
    loadOlderMessages,
    sendHomeChat,
    sendHomeAction,
    sendTripChat,
    sendTripAction,
    sendApproval,
    beginTap,
    clearTap,
    queuedCount,
    queuePaused,
    enqueueMessage,
    dequeueMessage,
  } = chat;
  const { pending, openTrip, newChat, openTripPage } = session;
  const { openOptionsQuote, regenerateOptionsQuote } = useOptionsQuote(core, chat);
  const { offerChooseSaved } = useTripRates(core, chat);

  const lastMessage = messages.at(-1);
  const replyCards =
    !chatBusy && lastMessage?.role === "assistant" ? (lastMessage.cards ?? null) : null;

  /**
   * Routes one typed message (Stage 3d: display + agent only).
   *  0. Busy → queue. 1. Home chat. 2. Approval card. 3. Everything else → agent.
   */
  async function handleSend(text: string) {
    const message = text.trim();
    if (!message || !canWrite) return;

    if (chatBusy) {
      enqueueMessage(message);
      return;
    }
    clearTap();

    if (!detail) {
      await sendHomeChat(message);
      return;
    }

    if (replyCards?.approval && (isConfirmReply(message) || isDeclineReply(message))) {
      await sendApproval(isConfirmReply(message) ? "approve" : "cancel");
      return;
    }

    if (!isConfirmReply(message) && !isDeclineReply(message)) {
      clearOfferedChips();
      setQuietChips(isTripQuestion(message));
    } else {
      setQuietChips(false);
    }
    await sendTripChat(message);
  }

  // Send what was typed during a reply once the chat is free, one message at a time.
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
    replyCards,
    quietChips,
    actions: {
      sendAction: detail ? sendTripAction : sendHomeAction,
      sendApproval,
      openTripPage,
    },
  });
  const chips: TripBuilderChip[] = built.chips.map((chip) => ({
    ...chip,
    onClick: () => {
      beginTap(chip.id);
      chip.onClick();
    },
  }));

  function addRateOption(option: {
    hotel: string;
    room: string;
    markupPercent: number;
    rateRef: string;
  }) {
    if (!detail || !canWrite) return;
    const label = `Add · ${option.markupPercent}% · ${option.room}`;
    beginTap(`add-rate-${option.rateRef}`);
    void sendTripAction({
      action: "quote_add_options",
      label,
      args: {
        options: [
          {
            hotel: option.hotel,
            room: option.room,
            markup_percent: option.markupPercent,
            rate_ref: option.rateRef,
          },
        ],
      },
    });
  }

  return {
    trips,
    detail,
    summaryOpen: core.summaryOpen,
    setSummaryOpen: core.setSummaryOpen,
    busy: busy || pending,
    chatBusy,
    canWrite,
    messages,
    chatLoading,
    chatLoadingOlder,
    hasMoreMessages,
    streamingContent,
    agentPhase,
    agentSteps,
    queuedCount,
    chips,
    rateCards: built.rateCards,
    rateCompare: replyCards?.rateCompare ?? null,
    stayNotes: core.rateOptions.length > 0 ? core.rateStayNotes : null,
    activeLegId: core.activeLegId,
    selectLeg,
    openTrip,
    newChat,
    handleSend,
    loadOlderMessages,
    openOptionsQuote,
    regenerateOptionsQuote,
    offerChooseSaved,
    addRateOption,
  };
}
