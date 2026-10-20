"use client";

import { useEffect, useRef, useState } from "react";

import { answerPriceQuestion, markupPercentFromNotes } from "@/lib/rates/price-math";
import { questionUsesRatePack } from "@/lib/rates/rate-search-pack";
import { pageRoutes } from "@/lib/routes";
import {
  clientNameFromMessage,
  isConfirmReply,
  isDeclineReply,
  isOptionsAdd,
  isPlaceQuestion,
  isPriceSkip,
  isSupplierPaste,
  isTripQuestion,
  looksLikeHotelPlan,
  looksLikeOptionsPdfEdit,
  matchRateChoice,
  mergeStayDraft,
  mightNamePlace,
  parseAddStay,
  parseCityOnly,
  parseLeadChange,
  parseListedStayEdit,
  parseMoneyReply,
  parseOptionClientPrice,
  parseOptionsWording,
  parseQuoteEdit,
  parseRemoveStay,
  parseSellMessage,
  parseStayMessage,
  parseTravellerCommand,
  parseTripDates,
  parseTripShift,
  partyReady,
  splitTrailingPrice,
  stayDraftReady,
  wantsAddStay,
  wantsAssignClient,
  wantsChangeTripDates,
  wantsHotelSearch,
  wantsOptionsPreview,
  wantsRateSearch,
} from "@/lib/trip-builder/intents";

import { buildComposerChips } from "./build-composer-chips";
import { useOptionsQuote } from "./hooks/use-options-quote";
import { useTripChat } from "./hooks/use-trip-chat";
import { useTripCore, type UseTripBuilderOptions } from "./hooks/use-trip-core";
import { useTripParty } from "./hooks/use-trip-party";
import { useTripRates } from "./hooks/use-trip-rates";
import { useTripSession } from "./hooks/use-trip-session";
import { useTripStays } from "./hooks/use-trip-stays";
import { DECLINE_LABELS, DECLINE_REPLIES, readReply } from "./offer-reply";
import { buildQuoteBreakup } from "./quote-price";
import {
  findOverlappingStay,
  isRateStage,
  legsConfirmed,
  partyFromTravellers,
  resolveTripStage,
  staysOutsideWindow,
  travellersConfirmed,
  tripStays,
} from "./stages";
import type { TripBuilderChip } from "./trip-builder-action-chip";
import { listedRates, shiftLabel, stayOn, withPartyCounts } from "./trip-builder-helpers";

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
    clientHits,
    setClientHits,
    suggestedClients,
    leadHits,
    roleHits,
    quietChips,
    setQuietChips,
    activeLegIdRef,
    activeLegId,
    stayDraft,
    setStayDraft,
    offer,
    setOffer,
    offerReopen,
    setOfferReopen,
    pendingOptionDraft,
    setPendingOptionDraft,
    pendingCostUpdate,
    atlasPlace,
    atlasHotels,
    closeOffer,
    clearOfferedChips,
    clearStayPrompts,
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
    assignClient,
    addTraveller,
    confirmTravellers,
    changeLead,
    offerLead,
    removeTraveller,
    offerTraveller,
    setPartyRole,
    offerRole,
    searchClientsForMessage,
    chooseClient,
  } = useTripParty(core, chat);
  const {
    selectLeg,
    saveStayFromDraft,
    matchAtlasPick,
    pickAtlasHotel,
    askAtlas,
    commitAddLeg,
    commitRevise,
    commitRemove,
    saveTripDates,
    commitShift,
    confirmLegs,
    updateStay,
  } = useTripStays(core, chat);
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

  /**
   * Routes one typed message. The sections run in this order and the first one that
   * handles the message returns, so a new intent has to sit in the right section.
   *  0. A reply is still running: queue it; it is sent when the chat is free.
   *  1. No trip open: pre-trip chat.
   *  2. A room is waiting for its client price.
   *  3. Any other new message clears the chips on offer.
   *  4. Yes or no to the pending confirmation.
   *  5. Trip dates and stays: locked check, shift, trip dates, remove, revise, add.
   *  6. Hotel and party for the open stay.
   *  7. Lead and travellers.
   *  8. Place questions and hotel picks.
   *  9. Rates, client prices, and quote wording. The client search and the stay draft
   *     update here without returning.
   * 10. Anything else goes to the agent.
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

    // 1. No trip open: pre-trip chat.
    if (!detail) {
      await sendHomeChat(message);
      return;
    }

    // 2. A room is waiting for its client price.
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

    // 3. Any other new message clears the chips on offer.
    const stage = resolveTripStage(detail);
    const openStay = stayOn(detail, activeLegIdRef.current);
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
        isSupplierPaste(message) ||
        parseTripShift(message) != null;
      setQuietChips(isTripQuestion(message) && !writing && !holdDraft);
    } else {
      setQuietChips(false);
    }

    const windowStart = detail.trip.starts_on;
    const windowEnd = detail.trip.ends_on;
    const collectingDates = !windowStart || !windowEnd;
    const collectingLegs = Boolean(windowStart && windowEnd && !detail.trip.legs_confirmed_at);
    const stays = tripStays(detail);

    function insideWindow(checkIn: string, checkOut: string) {
      return Boolean(
        windowStart &&
          windowEnd &&
          checkIn >= windowStart &&
          checkOut <= windowEnd &&
          checkOut > checkIn,
      );
    }

    function offerDates(dates: { checkIn: string; checkOut: string }, userLine: string) {
      const outside = staysOutsideWindow(stays, dates.checkIn, dates.checkOut);
      clearStayPrompts();
      if (outside.length > 0) {
        setOffer({ type: "date-drop", dates });
        const names = outside
          .map((stay) => `**${stay.city}** (${stay.check_in} to ${stay.check_out})`)
          .join(", ");
        void appendTurn(
          userLine,
          `${names} sit outside **${dates.checkIn}** to **${dates.checkOut}**. Change those stays so they fit, or tap **Remove outside stays and save dates**. Say **no** to keep the current trip dates.`,
        );
        return;
      }
      setOffer({ type: "trip-dates", dates });
      void appendTurn(
        userLine,
        `Save the trip as **${dates.checkIn}** to **${dates.checkOut}**?\n\nStays keep their own check-in and check-out when they still fit. The rate list clears. Say **yes** or tap **Save trip dates**. Say **no** to cancel.`,
      );
    }

    // 4. Yes or no to the pending confirmation.
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
        case "trip-dates":
          void saveTripDates(open.dates);
          return;
        case "shift-trip":
          void commitShift(open.days);
          return;
        case "date-drop":
          void saveTripDates(open.dates, true);
          return;
        case "remove-stay":
          void commitRemove(open.leg, message);
          return;
        case "revise-stay":
          void commitRevise(open.leg, message);
          return;
        case "add-stay":
          void commitAddLeg(open.leg, message);
          return;
        case "stay-overlap":
          void saveStayFromDraft(true);
          return;
        case "stay-update":
          void saveStayFromDraft();
          return;
        case "lead":
          if (detail.pricing_locked) break;
          void changeLead(open.person, message);
          return;
        case "traveller":
          if (detail.pricing_locked) break;
          void addTraveller(open.person, message);
          return;
        case "role":
          if (detail.pricing_locked) break;
          void setPartyRole(open.person, message);
          return;
        case "assign":
          void assignClient(open.client);
          return;
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
    // 5. Trip dates and stays.
    const stayEdit =
      Boolean(parseAddStay(message)) ||
      Boolean(parseListedStayEdit(message, stays)) ||
      Boolean(parseRemoveStay(message)) ||
      Boolean(parseCityOnly(message)) ||
      wantsChangeTripDates(message) ||
      wantsAddStay(message) ||
      parseTripShift(message) != null;
    if (detail.pricing_locked && stayEdit) {
      setOfferReopen(true);
      void appendTurn(
        message,
        `Pricing is locked on this trip. To change dates or stays, open the [trip page](${pageRoutes.trip(detail.trip.id)}) and choose **Reopen quote** under Update status.`,
      );
      return;
    }

    const shift = windowStart && windowEnd ? parseTripShift(message) : null;
    if (shift) {
      clearStayPrompts();
      setOffer({ type: "shift-trip", days: shift });
      void appendTurn(
        message,
        `Move the whole trip and every stay **${shiftLabel(shift)}**? Hotels stay the same. Selected rates clear and pending bookings are cancelled, because prices depend on dates.\n\nSay **yes** or tap **Shift every stay**. Say **no** to cancel.`,
      );
      return;
    }

    const partyLine = Boolean(parseTravellerCommand(message) || parseLeadChange(message));

    if (collectingDates) {
      if (
        !partyLine &&
        (parseAddStay(message) || wantsAddStay(message) || parseCityOnly(message))
      ) {
        void appendTurn(
          message,
          "Set the trip start and end first. Every stay has to sit inside those days.\n\nStart: 2026-10-10\nEnd: 2026-10-20",
        );
        return;
      }
      const dates = parseTripDates(message);
      if (dates) {
        offerDates(dates, message);
        return;
      }
    }

    if (windowStart && windowEnd && !looksLikeHotelPlan(message)) {
      const removal = parseRemoveStay(message);
      if (removal) {
        const target =
          removal === "open"
            ? openStay
            : stays.find(
                (stay) => stay.city.trim().toLowerCase() === removal.toLowerCase(),
              );
        if (!target) {
          if (removal === "open" || /\b(?:stay|leg)\b/i.test(message)) {
            void appendTurn(
              message,
              "Name the city to remove, or say **remove this stay** while that stay is open.",
            );
            return;
          }
        } else {
          clearStayPrompts();
          setOffer({ type: "remove-stay", leg: { legId: target.leg_id, city: target.city } });
          void appendTurn(
            message,
            `Remove **${target.city}**${target.check_in ? ` (${target.check_in} to ${target.check_out})` : ""}? Its booking will be cancelled. Say **yes** or tap **Remove ${target.city}**. Say **no** to cancel.`,
          );
          return;
        }
      }

      const listedEdit = parseListedStayEdit(message, stays);
      const added = parseAddStay(message);
      const sameCity =
        added &&
        stays.some((stay) => stay.city.trim().toLowerCase() === added.city.toLowerCase()) &&
        !/^\s*(?:add|another|new|extra)\b/i.test(message);
      const reviseDraft = listedEdit ?? (sameCity ? added : null);
      if (reviseDraft) {
        const existing = stays.find(
          (stay) => stay.city.trim().toLowerCase() === reviseDraft.city.toLowerCase(),
        );
        if (existing) {
          if (!insideWindow(reviseDraft.checkIn, reviseDraft.checkOut)) {
            void appendTurn(
              message,
              `**${reviseDraft.city}** ${reviseDraft.checkIn} to ${reviseDraft.checkOut} sits outside the trip (**${windowStart}** to **${windowEnd}**). Widen the trip dates first, or pick dates inside them.`,
            );
            return;
          }
          const clash = findOverlappingStay(
            stays,
            reviseDraft.checkIn,
            reviseDraft.checkOut,
            existing.leg_id,
          );
          clearStayPrompts();
          setOffer({
            type: "revise-stay",
            leg: {
              legId: existing.leg_id,
              city: existing.city,
              checkIn: reviseDraft.checkIn,
              checkOut: reviseDraft.checkOut,
              confirmOverlap: Boolean(clash),
            },
          });
          void appendTurn(
            message,
            clash
              ? `**${existing.city}** ${reviseDraft.checkIn} to ${reviseDraft.checkOut} overlaps **${clash.city}** (${clash.check_in} to ${clash.check_out}). Say **yes** to update anyway, or **no** to cancel.`
              : `Update **${existing.city}** to ${reviseDraft.checkIn}–${reviseDraft.checkOut}? Say **yes** or tap **Update ${existing.city}**. Say **no** to cancel.`,
          );
          return;
        }
      }

      if (added) {
        if (!insideWindow(added.checkIn, added.checkOut)) {
          void appendTurn(
            message,
            `**${added.city}** ${added.checkIn} to ${added.checkOut} sits outside the trip (**${windowStart}** to **${windowEnd}**). Send dates inside that window.`,
          );
          return;
        }
        const clash = findOverlappingStay(stays, added.checkIn, added.checkOut, null);
        clearStayPrompts();
        setOffer({
          type: "add-stay",
          leg: {
            city: added.city,
            checkIn: added.checkIn,
            checkOut: added.checkOut,
            confirmOverlap: Boolean(clash),
          },
        });
        void appendTurn(
          message,
          clash
            ? `**${added.city}** ${added.checkIn} to ${added.checkOut} overlaps **${clash.city}** (${clash.check_in} to ${clash.check_out}). Say **yes** to add it anyway, or **no** to cancel.`
            : `Add **${added.city}**, ${added.checkIn} to ${added.checkOut}?\n\nSay **yes** to add it. Say **no** to cancel.`,
        );
        return;
      }

      const namedStayEdit = Boolean(parseListedStayEdit(message, stays) || parseAddStay(message));
      const labeledTripDates =
        /(?:^|\n)\s*(?:trip\s+)?(?:start|end)(?:\s+date)?\s*[:\-]\s*\d{4}-\d{2}-\d{2}/i.test(
          message,
        );
      if (!namedStayEdit && (wantsChangeTripDates(message) || labeledTripDates)) {
        const dates = parseTripDates(message);
        if (!dates) {
          void appendTurn(
            message,
            `Send the new trip dates as **Start: ${windowStart}** and **End: ${windowEnd}**. Stays that no longer fit will be named before anything is saved. The rate list clears after the dates change.`,
          );
          return;
        }
        offerDates(dates, message);
        return;
      }

      if (wantsAddStay(message)) {
        void appendTurn(
          message,
          `Send a city and both dates inside **${windowStart}** to **${windowEnd}**. For example **City: Maldives**, **Check-in: ${windowStart}**, **Check-out: ${windowEnd}**.`,
        );
        return;
      }

      if (collectingLegs && stays.length === 0 && !partyLine) {
        const city = parseCityOnly(message);
        if (city) {
          clearStayPrompts();
          setOffer({
            type: "add-stay",
            leg: { city, checkIn: windowStart, checkOut: windowEnd, confirmOverlap: false },
          });
          void appendTurn(
            message,
            `Add **${city}** for the whole trip, ${windowStart} to ${windowEnd}?\n\nSay **yes** to add it. Say **no** to cancel.`,
          );
          return;
        }
      }
    }

    // 6. Hotel and party for the open stay.
    if (
      openStay &&
      windowStart &&
      windowEnd &&
      legsConfirmed(detail) &&
      !detail.pricing_locked &&
      !wantsChangeTripDates(message) &&
      !wantsRateSearch(message)
    ) {
      const patch = parseStayMessage(message);
      const editingStay = Boolean(
        patch.hotel ||
          patch.city ||
          patch.checkIn ||
          patch.checkOut ||
          patch.rooms != null,
      );
      const askedToEdit =
        looksLikeHotelPlan(message) ||
        (/\b(?:change|update|move|set|correct)\b/i.test(message) &&
          /\b(?:hotel|property|check[\s-]?in|check[\s-]?out|rooms?|city)\b/i.test(message));
      if (editingStay && askedToEdit) {
        const merged = mergeStayDraft(stayDraft, patch);
        const next = {
          ...merged,
          hotel: merged.hotel || openStay.property_name || "",
          city: merged.city || openStay.city,
          checkIn: merged.checkIn || openStay.check_in || "",
          checkOut: merged.checkOut || openStay.check_out || "",
        };
        setStayDraft(withPartyCounts(next, detail));
        if (!stayDraftReady(withPartyCounts(next, detail))) {
          void appendTurn(
            message,
            `I can update **${openStay.city}**. Send the missing piece, for example **Rooms: 1** or **Hotel:** with the name, then tap **Update stay**.`,
          );
          return;
        }
        setOffer({ type: "stay-update" });
        void appendTurn(
          message,
          `Update **${next.city}** to **${next.hotel}**, ${next.checkIn} to ${next.checkOut}? The selected rate for this stay will clear. Say **yes** or tap **Update stay**. Say **no** to cancel.`,
        );
        return;
      }
    }

    // 7. Lead and travellers.
    if (detail.client) {
      const leadChange = parseLeadChange(message);
      if (leadChange) {
        if (detail.pricing_locked) {
          void appendTurn(message, "Pricing is locked, so the lead stays as it is.");
          return;
        }
        if (leadChange.name.trim().length < 2) {
          void appendTurn(
            message,
            "Who should be the lead? For example: **Make Ravi Mehta the lead**.",
          );
          return;
        }
        void offerLead(leadChange.name, message);
        return;
      }
    }

    if (detail.client && detail.pricing_locked) {
      const lockedParty = parseTravellerCommand(message);
      if (
        lockedParty &&
        (lockedParty.kind === "role" ||
          lockedParty.kind === "add" ||
          lockedParty.kind === "remove")
      ) {
        void appendTurn(message, "Pricing is locked, so the traveller list stays as it is.");
        return;
      }
    }

    if (detail.client && !detail.pricing_locked) {
      const command = parseTravellerCommand(message);
      const partyOpen = !travellersConfirmed(detail);
      if (partyOpen && stage === "client" && command?.kind === "confirm") {
        void confirmTravellers(message);
        return;
      }
      if (command?.kind === "role" && (partyOpen || travellersConfirmed(detail))) {
        void offerRole(command.name, command.role, message);
        return;
      }
      if (command?.kind === "remove" && (partyOpen || travellersConfirmed(detail))) {
        const match = detail.travellers.find(
          (person) => person.display_name.trim().toLowerCase() === command.name.toLowerCase(),
        );
        if (!match) {
          void appendTurn(message, `**${command.name}** is not on this trip.`);
          return;
        }
        void removeTraveller(match.client_id, match.display_name, message);
        return;
      }
      if (
        command?.kind === "add" &&
        (partyOpen || travellersConfirmed(detail))
      ) {
        void offerTraveller(command.name, command.child, message);
        return;
      }
    }

    // 8. Place questions and hotel picks.
    if (
      travellersConfirmed(detail) &&
      !detail.pricing_locked &&
      !looksLikeHotelPlan(message)
    ) {
      const picked = stage === "stay" ? matchAtlasPick(message, atlasHotels) : null;
      if (picked) {
        void pickAtlasHotel(picked, message);
        return;
      }
      const choosingRooms =
        isRateStage(stage) &&
        questionUsesRatePack(message) &&
        (rateOptions.length > 0 ||
          detail.rates.candidates.some((row) => !row.selected));
      if (
        !choosingRooms &&
        (isPlaceQuestion(message) || wantsHotelSearch(message) || mightNamePlace(message))
      ) {
        const remembered = atlasPlace;
        const hint = remembered?.city || remembered?.country || openStay?.city || null;
        const answered = await askAtlas(message, hint);
        if (answered) return;
      }
    }

    // 9. Rates, client prices, and quote wording.
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

    // Does not return: the client search runs and the message still reaches the agent.
    if (stage === "client" && !detail.client) {
      if (offer?.type === "assign" && isConfirmReply(message)) {
        // Keep the confirm chip.
      } else if (wantsAssignClient(message)) {
        closeOffer("assign");
        const name = clientNameFromMessage(message);
        if (name) void searchClientsForMessage(name);
        else setClientHits([]);
      } else {
        setClientHits([]);
        closeOffer("assign");
      }
    }
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
      clearStayPrompts();
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

    // 10. Anything else goes to the agent.
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
    clientHits,
    leadHits,
    roleHits,
    atlasHotels,
    quietChips,
    offer,
    offerReopen,
    pendingOptionDraft,
    pendingCostUpdate,
    actions: {
      promptCreateTrip,
      createTrip,
      changeLead,
      setPartyRole,
      addTraveller,
      confirmTravellers,
      sendTripAction,
      assignClient,
      chooseClient,
      saveTripDates,
      commitShift,
      openTripPage,
      commitAddLeg,
      commitRevise,
      commitRemove,
      saveStayFromDraft,
      updateStay,
      confirmLegs,
      pickAtlasHotel,
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
