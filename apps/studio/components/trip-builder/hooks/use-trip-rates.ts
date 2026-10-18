"use client";

import type { NormalizedRateOption } from "@pureluxe/rates";

import {
  addTripBuilderRateOption,
  pasteTripBuilderLineItem,
  searchTripBuilderRates,
  selectTripBuilderLineItem,
  setTripBuilderStay,
  updateTripBuilderQuote,
  updateTripBuilderStayOption,
} from "@/lib/api";
import { showApiError } from "@/lib/feedback";
import { pageRoutes } from "@/lib/routes";
import {
  isPriceSkip,
  parseMoneyReply,
  type MoneyReply,
  type StayDraft,
} from "@/lib/trip-builder/intents";
import { isQuoteWithClient } from "@/lib/trips/trip-status";

import { priceCheck } from "../price-check";
import {
  AFTER_ACCEPT_STEPS,
  CHOSEN_ROOM_NEXT,
  choiceSummary,
  staySavedText,
} from "../trip-builder-copy";
import { explainRate } from "../explain-rate";

import {
  clientPriceAtMarkup,
  formatRoomMoney,
  markupPercentFromNotes,
  type PricedRoom,
} from "@/lib/rates/price-math";

import {
  formatMoney,
  optionChipLabel,
  shortStayDate,
  stayFieldsDiffer,
  stayOn,
  type CostUpdate,
  type ListedRate,
  type OptionCommit,
  type OptionDraft,
  type SavedRate,
  type SellDraft,
} from "../trip-builder-helpers";
import { partyFromTravellers, travellersConfirmed } from "../stages";

import type { TripChat } from "./use-trip-chat";
import type { TripCore } from "./use-trip-core";

/** Rooms and prices: rate searches, room options with client prices, the client's choice, and today's cost. */
export function useTripRates(core: TripCore, chat: TripChat) {
  const {
    detail,
    setDetail,
    canWrite,
    quoteFrozen,
    setBusy,
    rateOptions,
    setRateOptions,
    rateStayNotes,
    setRateStayNotes,
    setQuietChips,
    activeLegIdRef,
    stayDraft,
    setOffer,
    pendingOptionDraft,
    setPendingOptionDraft,
    setPendingCostUpdate,
    closeOffer,
    hydrateStayDraft,
    refreshAfterMutation,
  } = core;
  const {
    appendTurn,
  } = chat;

  async function searchRates(source?: StayDraft, userLine = "Search rates") {
    const party = source ?? stayDraft;
    if (!canWrite || !detail) return;
    const openStay = stayOn(detail, activeLegIdRef.current);
    if (!openStay?.check_in || !openStay.check_out) return;
    const namedParty = travellersConfirmed(detail) ? partyFromTravellers(detail) : null;
    const adults = namedParty && namedParty.adults >= 1 ? namedParty.adults : party.adults;
    const children = namedParty && namedParty.adults >= 1 ? namedParty.children : party.children;
    if (adults == null || children == null || party.rooms == null) {
      void appendTurn(
        userLine,
        adults == null
          ? "Finish the traveller list, then send the rooms. For example **Rooms: 1**."
          : "I still need the rooms before I search. For example **Rooms: 1**.",
      );
      return;
    }
    let checkIn = openStay.check_in;
    let checkOut = openStay.check_out;
    let legId = openStay.leg_id;
    let city = party.city.trim() || openStay.city;
    let propertyId = openStay.property_id;
    setOffer(null);
    setBusy(true);
    try {
      if (!detail.pricing_locked && stayFieldsDiffer(party, openStay)) {
        const hotel = party.hotel.trim();
        const savedName = openStay.property_name?.trim() ?? "";
        const saved = await setTripBuilderStay(detail.trip.id, {
          leg_id: legId,
          city,
          property_name: hotel || openStay.property_name,
          property_id:
            hotel.toLowerCase() === savedName.toLowerCase() ? propertyId : null,
          check_in: openStay.check_in,
          check_out: openStay.check_out,
          adults,
          children,
          rooms: party.rooms,
        });
        setDetail(saved.data.detail);
        hydrateStayDraft(saved.data.detail);
        const next = stayOn(saved.data.detail, legId);
        if (!next?.check_in || !next.check_out) return;
        legId = next.leg_id;
        city = next.city;
        propertyId = next.property_id;
        checkIn = next.check_in;
        checkOut = next.check_out;
        if (!propertyId) {
          const rooms =
            party.rooms === 1 ? "1 room" : `${party.rooms} rooms`;
          appendTurn(
            userLine,
            staySavedText({
              hotel: next.property_name ?? hotel,
              city: next.city,
              checkIn: next.check_in,
              checkOut: next.check_out,
              party: `${adults} adults, ${children} children, ${rooms}`,
              status: saved.data.property_match.status,
              names: saved.data.property_match.names,
            }),
          );
          return;
        }
      }
      const response = await searchTripBuilderRates({
        trip_id: detail.trip.id,
        leg_id: legId,
        destination_text: city,
        property_id: propertyId,
        check_in: checkIn,
        check_out: checkOut,
        adults,
        children,
        rooms: party.rooms,
        paste_text: null,
      });
      const options = [...response.data.options].sort(
        (a, b) => Number(b.recommended) - Number(a.recommended),
      );
      setRateOptions(options);
      setRateStayNotes(response.data.stay_notes);
      const found = describeRateSearch(
        options,
        response.data.message,
        adults,
        children,
        party.rooms,
        response.data.stay_notes?.markup ?? null,
      );
      const hasChosen = detail.rates.candidates.some(
        (rate) => rate.selected && rate.leg_id === legId,
      );
      if (detail.pricing_locked || hasChosen) {
        const check = priceCheck(detail, legId, options);
        setPendingCostUpdate(quoteFrozen || !detail.pricing_locked ? check.update : null);
        appendTurn(userLine, `${check.note}\n\n${found}`);
      } else {
        appendTurn(userLine, found);
      }
      await refreshAfterMutation(detail.trip.id);
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function selectSearchOption(
    option: NormalizedRateOption,
    userLine?: string,
  ) {
    if (!canWrite || !detail) return;
    setBusy(true);
    try {
      await addTripBuilderRateOption({
        trip_id: detail.trip.id,
        leg_id: stayOn(detail, activeLegIdRef.current)?.leg_id ?? null,
        option,
        select: true,
      });
      await refreshAfterMutation(detail.trip.id);
      setRateOptions([]);
      closeOffer("paste");
      const name =
        option.room_name || option.property_name || option.rate_source_code;
      const money = formatMoney(option.cost_internal, option.currency);
      appendTurn(
        userLine ?? (money ? `Select · ${name} · ${money}` : `Select · ${name}`),
        `**${name}** is the room for this stay. The other options were removed. A pending hotel booking is in **Bookings**.\n\n${CHOSEN_ROOM_NEXT}\n\nOpen **Bookings** and set it to confirmed only after you check the stay.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  function draftFromChoice(choice: ListedRate): OptionDraft {
    if (choice.kind === "search") {
      const explained = explainRate(choice.option);
      return {
        title: explained.room,
        currency: choice.option.currency?.trim().toUpperCase() || null,
        costLabel: explained.price,
        sellLabel: null,
        option: choice.option,
        lineItemId: null,
      };
    }
    const title = choice.row.subtitle?.trim() || choice.row.title;
    return {
      title,
      currency: choice.row.currency?.trim().toUpperCase() || null,
      costLabel: formatMoney(choice.row.cost_internal, choice.row.currency) || "on the card",
      sellLabel: formatMoney(choice.row.sell_amount, choice.row.currency) || null,
      option: null,
      lineItemId: choice.row.id,
    };
  }

  function roomFacts(choice: ListedRate): string {
    if (choice.kind === "search") {
      const explained = explainRate(choice.option);
      return [
        `**${explained.room}**`,
        `Team cost **${explained.price}**. ${explained.why}`,
        explained.occupancy ? `Occupancy: ${explained.occupancy}.` : null,
        explained.benefits.length > 0
          ? `Included: ${explained.benefits.join(", ")}.`
          : "Nothing is listed as included.",
        explained.cancellation
          ? `Cancellation: ${explained.cancellation}`
          : "Cancellation is not on file.",
        rateStayNotes?.markup ?? null,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n\n");
    }
    const title = choice.row.subtitle?.trim() || choice.row.title;
    const included = choice.row.inclusions.map((item) => item.trim()).filter(Boolean);
    const cancel = choice.row.cancellation_policy?.trim();
    const sell = formatMoney(choice.row.sell_amount, choice.row.currency);
    return [
      `**${title}**`,
      sell
        ? `Client price on the options quote **${sell}**. Team cost **${formatMoney(choice.row.cost_internal, choice.row.currency) || "on the card"}**.`
        : `Team cost **${formatMoney(choice.row.cost_internal, choice.row.currency) || "on the card"}**. No client price is set on the options quote for this room.`,
      included.length > 0 ? `Included: ${included.join(", ")}.` : "Nothing is listed as included.",
      cancel ? `Cancellation: ${cancel}` : "Cancellation is not on file.",
      rateStayNotes?.markup ?? null,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n\n");
  }

  function armOptionCommit(commit: OptionCommit, userLine: string, preface?: string) {
    setPendingOptionDraft(null);
    setOffer({ type: "add-option", commit });
    setQuietChips(false);
    const money = formatMoney(commit.amount, commit.currency);
    const priceLine =
      commit.amount == null
        ? "The client price stays empty, so the PDF prints To be confirmed."
        : `Client price **${money}**. The team cost stays **${commit.costLabel}**.`;
    const action =
      commit.mode === "price"
        ? `Set the client price for **${commit.title}**?`
        : `Save **${commit.title}** on the options quote?`;
    void appendTurn(
      userLine,
      [
        preface,
        action,
        priceLine,
        `Say **yes** or tap **${optionChipLabel(commit)}**. Say **no** to cancel.`,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n\n"),
    );
  }

  function markupSuggestion(cost: number | null, currency: string | null): string | null {
    const percent = markupPercentFromNotes(rateStayNotes?.markup ?? null);
    if (percent == null || cost == null) return null;
    const suggested = formatRoomMoney(clientPriceAtMarkup(cost, percent), currency);
    return `At the minimum markup of ${percent}% on file, the client price would be **${suggested}**. Send that amount, or a different one.`;
  }

  function roomsForPriceMath(): PricedRoom[] {
    if (!detail) return [];
    if (rateOptions.length > 0) {
      return rateOptions.slice(0, 6).map((option) => {
        const title = option.room_name || option.property_name || "Room";
        const saved = detail.rates.candidates.find((row) => {
          const label = `${row.subtitle ?? ""} ${row.title}`.toLowerCase();
          return !row.selected && label.includes(title.toLowerCase());
        });
        return {
          title,
          teamCost: option.cost_internal,
          clientPrice: saved?.sell_amount ?? null,
          currency: option.currency,
        };
      });
    }
    const legId = activeLegIdRef.current;
    return detail.rates.candidates
      .filter((row) => row.cost_internal != null && (!legId || row.leg_id === legId))
      .slice(0, 8)
      .map((row) => ({
        title: row.subtitle?.trim() || row.title,
        teamCost: row.cost_internal ?? 0,
        clientPrice: row.selected ? null : row.sell_amount,
        currency: row.currency,
      }));
  }

  function offerAddRoom(choice: ListedRate, price: MoneyReply | null, userLine: string) {
    const draft = draftFromChoice(choice);
    if (price?.currency && draft.currency && price.currency !== draft.currency) {
      setPendingOptionDraft(draft);
      setOffer(null);
      void appendTurn(
        userLine,
        `**${draft.title}** is priced in **${draft.currency}**. Send the client price in ${draft.currency}.`,
      );
      return;
    }
    if (choice.kind === "saved" && !price) {
      const current = formatMoney(choice.row.sell_amount, choice.row.currency);
      setPendingOptionDraft(draft);
      setOffer(null);
      void appendTurn(
        userLine,
        current
          ? `**${draft.title}** is already on the options quote. Client price **${current}**. Team cost **${draft.costLabel}**. Send a new amount to change it, for example **2400 ${draft.currency ?? "USD"}**.`
          : `**${draft.title}** is already on the options quote. Team cost **${draft.costLabel}**.\n\nWhat client price should the PDF show? Send the amount, for example **2400 ${draft.currency ?? "USD"}**, or say **to be confirmed**.`,
      );
      return;
    }
    if (!price) {
      setPendingOptionDraft(draft);
      setOffer(null);
      const cost = choice.kind === "search" ? choice.option.cost_internal : choice.row.cost_internal;
      const suggest = markupSuggestion(cost, draft.currency);
      void appendTurn(
        userLine,
        [
          roomFacts(choice),
          suggest,
          `What client price should this room show? Send the amount in **${draft.currency ?? "the room currency"}**, for example **2400 ${draft.currency ?? "USD"}**. Say **to be confirmed** to add it with no price yet.`,
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n\n"),
      );
      return;
    }
    armOptionCommit(
      {
        ...draft,
        mode: choice.kind === "saved" ? "price" : "add",
        amount: price.amount,
        currency: price.currency ?? draft.currency,
      },
      userLine,
      roomFacts(choice),
    );
  }

  function offerSelectRoom(choice: ListedRate, userLine: string) {
    const draft = draftFromChoice(choice);
    setPendingOptionDraft(null);
    setOffer({ type: "select-room", room: draft });
    setQuietChips(false);
    const room = draft.title.length > 32 ? `${draft.title.slice(0, 32).trim()}…` : draft.title;
    void appendTurn(
      userLine,
      `${roomFacts(choice)}\n\nThis is the room the client chose. The other options for this stay come off, and a pending booking is created.\n\nSay **yes** or tap **Client chose · ${room}**. Say **no** to cancel.`,
    );
  }

  function offerChooseSaved(lineItemId: string) {
    if (!detail) return;
    const row = detail.rates.candidates.find((item) => item.id === lineItemId && !item.selected);
    if (!row) return;
    if (detail.pricing_locked && row.sell_amount == null) {
      void appendTurn(
        "Client chose this",
        "This room has no client price on the accepted quote, so it cannot be chosen while pricing is locked. Reopen the quote on the trip page to price it.",
      );
      return;
    }
    const choice: ListedRate = {
      title: row.subtitle?.trim() || row.title,
      kind: "saved",
      row,
    };
    const draft = draftFromChoice(choice);
    setPendingOptionDraft(null);
    setOffer({ type: "select-room", room: draft });
    setQuietChips(false);
    const room = draft.title.length > 32 ? `${draft.title.slice(0, 32).trim()}…` : draft.title;
    void appendTurn(
      "Client chose this",
      `**${draft.title}** stays. ${
        draft.sellLabel
          ? `Client price on the options quote **${draft.sellLabel}**, and that becomes the trip's client price once every stay has a room. Team cost **${draft.costLabel}**.`
          : `Team cost **${draft.costLabel}**. No client price is set on the options quote for this room, so set the client price after choosing.`
      } The other options for this stay come off, and a pending booking is created.\n\nSay **yes** or tap **Client chose · ${room}**. Say **no** to cancel.`,
    );
  }

  /** Ask for a new client price on the client's chosen room. The reply runs the usual price confirm. */
  function offerRoomPrice(row: SavedRate, userLine: string) {
    const draft = draftFromChoice({
      title: row.subtitle?.trim() || row.title,
      kind: "saved",
      row,
    });
    setPendingOptionDraft(draft);
    setOffer(null);
    setQuietChips(false);
    const markup = markupPercentFromNotes(rateStayNotes?.markup ?? null);
    const cost = row.cost_internal == null ? null : Number(row.cost_internal);
    const suggestion =
      markup != null && cost != null && Number.isFinite(cost)
        ? ` At the ${markup}% minimum markup that is **${formatMoney(clientPriceAtMarkup(cost, markup), row.currency)}**.`
        : "";
    void appendTurn(
      userLine,
      `**${draft.title}**: client price ${draft.sellLabel ? `**${draft.sellLabel}**` : "not set"}. Team cost **${draft.costLabel}**.${suggestion}\n\nSend the new client price, for example **2400 ${draft.currency ?? "USD"}**. The trip price and the pending booking update with it.`,
    );
  }

  async function commitCostUpdate(update: CostUpdate) {
    if (!canWrite || !detail) return;
    setBusy(true);
    setPendingCostUpdate(null);
    const money = formatMoney(update.amount, update.currency);
    try {
      const response = await updateTripBuilderStayOption(update.lineItemId, {
        cost_internal: update.amount,
      });
      setDetail(response.data);
      const row = response.data.rates.candidates.find((item) => item.id === update.lineItemId);
      const sell = row ? formatMoney(row.sell_amount, row.currency) : "";
      appendTurn(
        `Use today's cost · ${money}`,
        `Team cost for **${update.room}** is now **${money}**. The pending booking and the margin are updated.${
          sell ? ` The client price stays **${sell}**.` : ""
        }\n\nTap **Set client price** if the client price needs to change, or book with the hotel and confirm the booking in **Bookings**.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  function acceptDraftPrice(userLine: string) {
    const draft = pendingOptionDraft;
    if (!draft) return;
    if (isPriceSkip(userLine) && quoteFrozen) {
      void appendTurn(
        userLine,
        `The client accepted this trip, so **${draft.title}** needs a client price. Send the amount, for example **2400 ${draft.currency ?? "USD"}**.`,
      );
      return;
    }
    if (isPriceSkip(userLine)) {
      armOptionCommit(
        {
          ...draft,
          mode: draft.option ? "add" : "price",
          amount: null,
          currency: draft.currency,
        },
        userLine,
      );
      return;
    }
    const price = parseMoneyReply(userLine);
    if (!price) return;
    if (price.currency && draft.currency && price.currency !== draft.currency) {
      void appendTurn(
        userLine,
        `**${draft.title}** is priced in **${draft.currency}**. Send the client price in ${draft.currency}.`,
      );
      return;
    }
    armOptionCommit(
      {
        ...draft,
        mode: draft.option ? "add" : "price",
        amount: price.amount,
        currency: price.currency ?? draft.currency,
      },
      userLine,
    );
  }

  async function commitOption(commit: OptionCommit, userLine: string) {
    if (!canWrite || !detail) return;
    setBusy(true);
    setOffer(null);
    setPendingOptionDraft(null);
    const backToBuilding = isQuoteWithClient(detail.trip.status)
      ? "\n\nThe client's copy is now out of date, so the trip is back in **Building**. Regenerate the options quote and send it again."
      : "";
    try {
      if (commit.mode === "price" && commit.lineItemId) {
        const response = await updateTripBuilderStayOption(commit.lineItemId, {
          sell_amount: commit.amount,
        });
        setDetail(response.data);
        const offer =
          commit.amount == null
            ? "To be confirmed"
            : formatMoney(commit.amount, commit.currency);
        if (quoteFrozen) {
          const total = formatMoney(response.data.trip.sell_total, response.data.trip.sell_currency);
          appendTurn(
            userLine,
            `Client price for **${commit.title}** is **${offer}**. The team cost stays **${commit.costLabel}**.${
              total ? ` The trip client price is **${total}**.` : ""
            } The pending booking and the margin are updated, and the trip stays in **Booking**.\n\nBook with the hotel, then confirm the booking in **Bookings**.`,
          );
          return;
        }
        const chosen = response.data.rates.candidates.some(
          (row) => row.id === commit.lineItemId && row.selected,
        );
        const tripTotal = formatMoney(response.data.trip.sell_total, response.data.trip.sell_currency);
        appendTurn(
          userLine,
          chosen
            ? `Client price for **${commit.title}** is **${offer}**. The team cost stays **${commit.costLabel}**.${
                tripTotal ? ` The trip client price is **${tripTotal}**.` : ""
              } The pending booking and the margin are updated.${backToBuilding}`
            : `Client price for **${commit.title}** is **${offer}**. The team cost stays **${commit.costLabel}**.\n\nSay **show the options quote** to see the PDF, or add another room.${backToBuilding}`,
        );
        return;
      }
      if (!commit.option) return;
      const created = await addTripBuilderRateOption({
        trip_id: detail.trip.id,
        leg_id: stayOn(detail, activeLegIdRef.current)?.leg_id ?? null,
        option: commit.option,
        select: false,
      });
      if (commit.amount != null) {
        const response = await updateTripBuilderStayOption(created.data.id, {
          sell_amount: commit.amount,
        });
        setDetail(response.data);
      } else {
        await refreshAfterMutation(detail.trip.id);
      }
      const offer =
        commit.amount == null
          ? "To be confirmed"
          : formatMoney(commit.amount, commit.currency);
      appendTurn(
        userLine,
        `Added **${commit.title}** to the options quote. Client price **${offer}**. Team cost **${commit.costLabel}**.\n\nAdd another room the same way, say **show the options quote** to see the PDF, or set the wording with **note:**.${backToBuilding}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function commitSelect(draft: OptionDraft, userLine: string) {
    setOffer(null);
    if (draft.option) {
      await selectSearchOption(draft.option, userLine);
      return;
    }
    if (draft.lineItemId) await selectCandidate(draft.lineItemId, userLine);
  }

  async function pasteQuote(pasteText: string) {
    if (!canWrite || !detail) return;
    const openStay = stayOn(detail, activeLegIdRef.current);
    if (!openStay?.check_in || !openStay.check_out) return;
    setBusy(true);
    setOffer(null);
    try {
      const created = await pasteTripBuilderLineItem({
        trip_id: detail.trip.id,
        leg_id: openStay.leg_id,
        property_id: openStay.property_id,
        property_name: openStay.property_name,
        check_in: openStay.check_in,
        check_out: openStay.check_out,
        currency: "USD",
        paste_text: pasteText,
      });
      await selectTripBuilderLineItem(created.data.id);
      await refreshAfterMutation(detail.trip.id);
      appendTurn(
        "Use pasted quote",
        "Saved and selected that pasted quote. The amount is advisor cost, not the client price.\n\nNext, set the client sell price, for example **sell 4500 USD**.",
      );
    } catch (error) {
      showApiError(error);
      setOffer({ type: "paste", text: pasteText });
    } finally {
      setBusy(false);
    }
  }

  async function selectCandidate(lineItemId: string, userLine?: string) {
    if (!canWrite || !detail) return;
    setBusy(true);
    try {
      await selectTripBuilderLineItem(lineItemId);
      const next = await refreshAfterMutation(detail.trip.id);
      const row = detail.rates.candidates.find((item) => item.id === lineItemId);
      const money = row ? formatMoney(row.cost_internal, row.currency) : "";
      const room = row?.subtitle?.trim() || row?.title || "That room";
      appendTurn(
        userLine ??
          (row
            ? money
              ? `Select · ${row.title} · ${money}`
              : `Select · ${row.title}`
            : "Select rate"),
        `${choiceSummary(room, row ?? null, next)}\n\n${
          quoteFrozen
            ? AFTER_ACCEPT_STEPS
            : isQuoteWithClient(detail.trip.status)
              ? `The trip keeps its status. When the client agrees to the quote, open the [trip page](${pageRoutes.trip(detail.trip.id)}) and mark **Client accepted** under Update status.`
              : `${CHOSEN_ROOM_NEXT}\n\nOpen **Bookings** and set it to confirmed only after you check the stay.`
        }`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function applySell(sell: SellDraft) {
    if (!canWrite || !detail) return;
    setBusy(true);
    setOffer(null);
    try {
      const response = await updateTripBuilderQuote(detail.trip.id, {
        sell_total: sell.sell_total,
        sell_currency: sell.sell_currency,
      });
      setDetail(response.data.detail);
      appendTurn(
        `Set sell ${sell.sell_currency} ${sell.sell_total}`,
        `Client sell price is **${sell.sell_currency} ${sell.sell_total}**. It stays on this trip. The booking stays pending in **Bookings**.`,
      );
    } catch (error) {
      showApiError(error);
      setOffer({ type: "sell", sell });
    } finally {
      setBusy(false);
    }
  }

  function describeRateSearch(
    options: NormalizedRateOption[],
    message: string | null,
    adults: number,
    children: number,
    rooms: number,
    markup: string | null,
  ): string {
    const party = `${adults} adults, ${children} children, ${rooms} ${rooms === 1 ? "room" : "rooms"}`;
    if (options.length === 0) {
      const note = message?.trim();
      return note
        ? `${note}\n\nPaste a supplier quote in chat, with the total, and I'll confirm it before saving.`
        : "No rates came back for this stay. Paste a supplier quote in chat, with the total, and I'll confirm it before saving.";
    }
    const first = explainRate(options[0]);
    const hotel = options[0].property_name?.trim() || first.room;
    const from = shortStayDate(options[0].check_in);
    const to = shortStayDate(options[0].check_out);
    const count = Math.min(options.length, 6);
    const rateWord = count === 1 ? "1 rate" : `${count} rates`;
    const markupPercent = markupPercentFromNotes(markup);
    const lines = options.slice(0, 6).map((option, index) => {
      const explained = explainRate(option);
      if (markupPercent == null) {
        return `${index + 1}. **${explained.room}** — ${explained.price}`;
      }
      const suggested = formatRoomMoney(
        clientPriceAtMarkup(option.cost_internal, markupPercent),
        option.currency,
      );
      return `${index + 1}. **${explained.room}** — team cost ${explained.price} · suggest ${suggested}`;
    });
    const suggestion =
      markupPercent == null
        ? null
        : `Minimum markup on file is ${markupPercent}%. The suggested client price is the team cost plus that percent. It is not saved.`;
    return [
      `**${hotel}** · ${from} – ${to} · ${first.nightsLabel} · ${party}`,
      `${rateWord}. Each amount on the card is the team cost.`,
      lines.join("\n"),
      suggestion,
      "Tap **Add for the client** on a room, then send the client price you want. Ask a percent question, such as **10% more on room 1**, and I will calculate it.",
      "Ask me if you want help choosing. Once the client has picked, use **Client chose this** on a saved room.",
    ].filter((line): line is string => Boolean(line)).join("\n\n");
  }

  return {
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
  };
}

