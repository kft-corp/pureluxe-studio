"use client";

import {
  addTripBuilderLeg,
  removeTripBuilderLeg,
  updateTripBuilderLeg,
  askTripBuilderAtlas,
  setTripBuilderStay,
  shiftTripBuilderDates,
  updateTripBuilderTrip,
} from "@/lib/api";
import { showApiError } from "@/lib/feedback";
import { stayDraftReady } from "@/lib/trip-builder/intents";

import { staySavedText } from "../trip-builder-copy";
import { stayAskText } from "../stay-prompt";
import {
  draftFromStay,
  shiftLabel,
  stayOn,
  withPartyCounts,
  type AtlasHotel,
} from "../trip-builder-helpers";
import {
  findOverlappingStay,
  partyFromTravellers,
  travellersConfirmed,
  stayIsComplete,
  tripStays,
} from "../stages";

import type { TripChat } from "./use-trip-chat";
import type { TripCore } from "./use-trip-core";

/** Where and when: the trip dates, each stay, its hotel and party, and hotel picks from Atlas. */
export function useTripStays(core: TripCore, chat: TripChat) {
  const {
    detail,
    setDetail,
    canWrite,
    setBusy,
    setRateOptions,
    setQuietChips,
    activeLegIdRef,
    stayDraft,
    setStayDraft,
    setOffer,
    setAtlasPlace,
    setAtlasHotels,
    closeOffer,
    chooseLeg,
    hydrateStayDraft,
    refreshTrips,
    quoteRefreshNote,
    clearStayPrompts,
  } = core;
  const {
    appendTurn,
  } = chat;

  function selectLeg(legId: string) {
    if (!detail || legId === activeLegIdRef.current) return;
    chooseLeg(legId);
    setStayDraft(withPartyCounts(draftFromStay(stayOn(detail, legId)), detail));
    setRateOptions([]);
    closeOffer("rate-search", "paste");
  }

  async function saveStayFromDraft(confirmOverlap = false) {
    if (!canWrite || !detail || !stayDraftReady(stayDraft)) return;
    if (detail.pricing_locked) {
      showApiError(new Error("Pricing is locked on this trip."));
      return;
    }
    const openStay = stayOn(detail, activeLegIdRef.current);
    const clash = findOverlappingStay(
      tripStays(detail),
      stayDraft.checkIn,
      stayDraft.checkOut,
      openStay?.leg_id,
    );
    if (clash && !confirmOverlap) {
      setOffer({ type: "stay-overlap" });
      appendTurn(
        `Save stay · ${stayDraft.hotel}`,
        `**${stayDraft.city}** ${stayDraft.checkIn} to ${stayDraft.checkOut} overlaps **${clash.city}** (${clash.check_in} to ${clash.check_out}). Say **yes** to save anyway, or **no** to keep the current dates.`,
      );
      return;
    }
    const hadRate = Boolean(
      openStay &&
        detail.rates.candidates.some(
          (rate) => rate.selected && rate.leg_id === openStay.leg_id,
        ) &&
        (openStay.check_in !== stayDraft.checkIn ||
          openStay.check_out !== stayDraft.checkOut ||
          (openStay.property_name ?? "").trim().toLowerCase() !==
            stayDraft.hotel.trim().toLowerCase()),
    );
    const quoteNote = quoteRefreshNote();
    closeOffer("stay-overlap", "stay-update");
    setBusy(true);
    try {
      const hotel = stayDraft.hotel.trim();
      const savedName = openStay?.property_name?.trim() ?? "";
      const response = await setTripBuilderStay(detail.trip.id, {
        leg_id: openStay?.leg_id ?? null,
        city: stayDraft.city.trim(),
        property_name: hotel,
        property_id:
          hotel.toLowerCase() === savedName.toLowerCase()
            ? (openStay?.property_id ?? null)
            : null,
        check_in: stayDraft.checkIn,
        check_out: stayDraft.checkOut,
        adults: travellersConfirmed(detail)
          ? partyFromTravellers(detail).adults
          : (stayDraft.adults ?? 0),
        children: travellersConfirmed(detail)
          ? partyFromTravellers(detail).children
          : (stayDraft.children ?? 0),
        rooms: stayDraft.rooms ?? 0,
        confirm_overlap: confirmOverlap,
      });
      const saved = response.data.detail;
      setDetail(saved);
      await refreshTrips();
      const stay = stayOn(saved, openStay?.leg_id ?? null);
      const party = `${stayDraft.adults} adults, ${stayDraft.children} children, ${stayDraft.rooms} ${stayDraft.rooms === 1 ? "room" : "rooms"}`;
      const nextStay = tripStays(saved).find((item) => !stayIsComplete(item));
      if (nextStay) {
        chooseLeg(nextStay.leg_id);
        hydrateStayDraft(saved, nextStay.leg_id);
      } else {
        hydrateStayDraft(saved, openStay?.leg_id ?? null);
      }
      const savedText = staySavedText({
        hotel: stay?.property_name ?? hotel,
        city: stay?.city ?? stayDraft.city.trim(),
        checkIn: stay?.check_in ?? stayDraft.checkIn,
        checkOut: stay?.check_out ?? stayDraft.checkOut,
        party,
        status: response.data.property_match.status,
        names: response.data.property_match.names,
      });
      const rateNote = hadRate
        ? "\n\nThe selected rate was cleared. Search rates again for these dates."
        : "";
      appendTurn(
        `Save stay · ${stay?.property_name ?? hotel} · ${stay?.city ?? stayDraft.city}`,
        nextStay
          ? `${savedText}\n\nNext, plan **${nextStay.city}**, ${nextStay.check_in} to ${nextStay.check_out}. Send the hotel and party for that stay, then tap **Save stay**.${rateNote}${quoteNote}`
          : `${savedText}${rateNote}${quoteNote}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  function matchAtlasPick(
    message: string,
    hotels: AtlasHotel[],
  ) {
    const numbered = message.match(/^(?:select|use|pick|choose)\s+(\d+)\b/i);
    if (numbered) {
      const index = Number(numbered[1]) - 1;
      return hotels[index] ?? null;
    }
    const lower = message.trim().toLowerCase().replace(/[?.!]+$/g, "");
    return (
      hotels.find(
        (hotel) =>
          lower === hotel.name.toLowerCase() ||
          lower === `use ${hotel.name.toLowerCase()}`,
      ) ?? null
    );
  }

  async function pickAtlasHotel(
    hotel: AtlasHotel,
    userLine: string,
  ) {
    if (!canWrite || !detail) return;
    const openStay = stayOn(detail, activeLegIdRef.current);
    if (!openStay?.check_in || !openStay.check_out) {
      setStayDraft((current) => ({
        ...current,
        hotel: hotel.name,
        city: hotel.city || current.city,
      }));
      setAtlasHotels([]);
      void appendTurn(
        userLine,
        `**${hotel.name}** in **${hotel.city}** is the hotel to use. Set the trip start and end next, save the stay, then ask me to search rates when you are ready.`,
      );
      return;
    }
    const stayCity = openStay.city.trim().toLowerCase();
    const hotelCity = hotel.city.trim().toLowerCase();
    const samePlace =
      !hotelCity ||
      stayCity === hotelCity ||
      stayCity.includes(hotelCity) ||
      hotelCity.includes(stayCity);
    if (!samePlace) {
      void appendTurn(
        userLine,
        `**${hotel.name}** is on file for **${hotel.city}**. The open stay is **${openStay.city}**. Open that stay, or add **${hotel.city}**, then choose the hotel.`,
      );
      return;
    }
    const named = travellersConfirmed(detail) ? partyFromTravellers(detail) : null;
    const adults = named && named.adults >= 1 ? named.adults : (stayDraft.adults ?? openStay.adults);
    const children =
      named && named.adults >= 1 ? named.children : (stayDraft.children ?? openStay.children ?? 0);
    const rooms = stayDraft.rooms ?? openStay.rooms;
    if (adults == null || rooms == null) {
      setStayDraft((current) => ({
        ...current,
        hotel: hotel.name,
        city: openStay.city,
        checkIn: openStay.check_in ?? current.checkIn,
        checkOut: openStay.check_out ?? current.checkOut,
        adults: adults ?? current.adults,
        children,
      }));
      void appendTurn(
        userLine,
        adults == null
          ? `**${hotel.name}** is the hotel for **${openStay.city}**. Finish the traveller list first, then send **Rooms: 1**.`
          : `**${hotel.name}** is the hotel for **${openStay.city}**. Send **Rooms: 1**, then tap **Use ${hotel.name}**.`,
      );
      return;
    }
    setBusy(true);
    try {
      const response = await setTripBuilderStay(detail.trip.id, {
        leg_id: openStay.leg_id,
        city: openStay.city,
        property_name: hotel.name,
        property_id: hotel.propertyId,
        check_in: openStay.check_in,
        check_out: openStay.check_out,
        adults,
        children,
        rooms,
      });
      setDetail(response.data.detail);
      hydrateStayDraft(response.data.detail, openStay.leg_id);
      await refreshTrips();
      const linked = hotel.propertyId
        ? "Ask me to search rates when you are ready."
        : "This hotel is saved. A rate search may not find a price yet. You can still search or paste a supplier quote when you are ready.";
      appendTurn(
        userLine,
        `Saved **${hotel.name}** on **${openStay.city}**, ${openStay.check_in} to ${openStay.check_out}. ${linked}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function askAtlas(message: string, city: string | null): Promise<boolean> {
    try {
      const response = await askTripBuilderAtlas({ question: message, city });
      if (response.data.place.city || response.data.place.country) {
        setAtlasPlace(response.data.place);
      }
      if (!response.data.matched) {
        setAtlasHotels([]);
        return false;
      }
      setAtlasHotels(response.data.hotels);
      if (response.data.hotels.length > 0) setQuietChips(false);
      return false;
    } catch (error) {
      showApiError(error);
      return true;
    }
  }

  async function commitAddLeg(
    draft: { city: string; checkIn: string; checkOut: string; confirmOverlap?: boolean },
    userLine = `Add stay · ${draft.city}`,
  ) {
    if (!canWrite || !detail) return;
    clearStayPrompts();
    setBusy(true);
    try {
      const confirmed = Boolean(detail.trip.legs_confirmed_at);
      const quoteNote = quoteRefreshNote();
      const response = await addTripBuilderLeg(detail.trip.id, {
        city: draft.city,
        check_in: draft.checkIn,
        check_out: draft.checkOut,
        confirm_overlap: draft.confirmOverlap ?? false,
      });
      chooseLeg(response.data.leg_id);
      setDetail(response.data.detail);
      hydrateStayDraft(response.data.detail, response.data.leg_id);
      setRateOptions([]);
      closeOffer("rate-search");
      const start = response.data.detail.trip.starts_on;
      const end = response.data.detail.trip.ends_on;
      appendTurn(
        userLine,
        confirmed
          ? `**${draft.city}**, ${draft.checkIn} to ${draft.checkOut} is on the trip. Send the hotel and party, then tap **Save stay**.${quoteNote}`
          : `**${draft.city}**, ${draft.checkIn} to ${draft.checkOut} is inside the trip${start && end ? ` (${start} to ${end})` : ""}.\n\nSend the next stay the same way, or tap **Plan these stays** when the list is complete.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function commitRevise(
    draft: {
      legId: string;
      city: string;
      checkIn: string;
      checkOut: string;
      confirmOverlap?: boolean;
    },
    userLine = `Update ${draft.city}`,
  ) {
    if (!canWrite || !detail) return;
    const hadRate = detail.rates.candidates.some(
      (rate) => rate.selected && rate.leg_id === draft.legId,
    );
    const quoteNote = quoteRefreshNote();
    clearStayPrompts();
    setBusy(true);
    try {
      const saved = await updateTripBuilderLeg(detail.trip.id, draft.legId, {
        city: draft.city,
        check_in: draft.checkIn,
        check_out: draft.checkOut,
        confirm_overlap: draft.confirmOverlap ?? false,
      });
      setDetail(saved.data);
      chooseLeg(draft.legId);
      hydrateStayDraft(saved.data, draft.legId);
      setRateOptions([]);
      appendTurn(
        userLine,
        `**${draft.city}** is now ${draft.checkIn} to ${draft.checkOut}.${
          hadRate ? " The selected rate was cleared. Search rates again for these dates." : ""
        }${quoteNote}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function commitRemove(target: { legId: string; city: string }, userLine?: string) {
    if (!canWrite || !detail) return;
    const quoteNote = quoteRefreshNote();
    clearStayPrompts();
    setBusy(true);
    try {
      const saved = await removeTripBuilderLeg(detail.trip.id, target.legId);
      setDetail(saved.data);
      const stays = tripStays(saved.data);
      const next = stays[0] ?? null;
      if (next) {
        chooseLeg(next.leg_id);
        hydrateStayDraft(saved.data, next.leg_id);
      } else {
        chooseLeg(null);
        setStayDraft(draftFromStay(null));
      }
      setRateOptions([]);
      appendTurn(
        userLine ?? `Remove ${target.city}`,
        stays.length === 0
          ? `**${target.city}** is removed. That was the only stay. List the stays again, inside **${saved.data.trip.starts_on}** to **${saved.data.trip.ends_on}**.${quoteNote}`
          : `**${target.city}** is removed. Its booking is cancelled. The open stay is **${next?.city}**.${quoteNote}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function saveTripDates(
    dates: { checkIn: string; checkOut: string },
    dropOutside = false,
  ) {
    if (!canWrite || !detail) return;
    const hadDates = Boolean(detail.trip.starts_on);
    const listed = Boolean(detail.trip.legs_confirmed_at);
    const quoteNote = quoteRefreshNote();
    closeOffer("trip-dates", "date-drop");
    setBusy(true);
    try {
      const response = await updateTripBuilderTrip(detail.trip.id, {
        starts_on: dates.checkIn,
        ends_on: dates.checkOut,
        drop_outside_legs: dropOutside || undefined,
      });
      const saved = response.data;
      setDetail(saved);
      const stays = tripStays(saved);
      setRateOptions([]);
      const stillOpen = stays.find((stay) => stay.leg_id === activeLegIdRef.current);
      if (!stillOpen) {
        if (stays[0]) {
          chooseLeg(stays[0].leg_id);
          hydrateStayDraft(saved, stays[0].leg_id);
        } else {
          chooseLeg(null);
          setStayDraft(draftFromStay(null));
        }
      }
      const open = stayOn(saved, activeLegIdRef.current);
      const followUp = !hadDates
        ? `Now list each stay inside those dates. For example:\n\nCity: Maldives\nCheck-in: ${dates.checkIn}\nCheck-out: ${dates.checkOut}\n\nA city on its own uses the full trip for the first stay. When the list is complete, tap **Plan these stays**.`
        : dropOutside
          ? "Stays outside that window were removed, and their bookings were cancelled."
          : listed
            ? `Every stay that still fits keeps its own check-in and check-out.${open ? ` The open stay is **${open.city}**.` : ""} The previous rate list is cleared. Change a stay if its nights should move, then search rates again.`
            : "Keep listing stays inside the new dates, then tap **Plan these stays**.";
      appendTurn(
        `Trip dates ${dates.checkIn} to ${dates.checkOut}`,
        `Trip dates are **${dates.checkIn}** to **${dates.checkOut}**.\n\n${followUp}${quoteNote}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function commitShift(days: number) {
    if (!canWrite || !detail) return;
    const quoteNote = quoteRefreshNote();
    const label = shiftLabel(days);
    clearStayPrompts();
    setBusy(true);
    try {
      const response = await shiftTripBuilderDates(detail.trip.id, { days });
      const saved = response.data;
      setDetail(saved);
      hydrateStayDraft(saved, activeLegIdRef.current);
      setRateOptions([]);
      const lines = tripStays(saved)
        .map((stay) => `- **${stay.city}**: ${stay.check_in} to ${stay.check_out}`)
        .join("\n");
      appendTurn(
        `Shift every stay ${label}`,
        `Moved the trip ${label}: **${saved.trip.starts_on}** to **${saved.trip.ends_on}**.${lines ? `\n\n${lines}` : ""}\n\nHotels stay the same. Selected rates were cleared, so search rates again for the new dates.${quoteNote}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function confirmLegs() {
    if (!canWrite || !detail) return;
    setBusy(true);
    try {
      const response = await updateTripBuilderTrip(detail.trip.id, {
        confirm_legs: true,
      });
      const saved = response.data;
      setDetail(saved);
      const first = tripStays(saved)[0];
      if (first) {
        chooseLeg(first.leg_id);
        hydrateStayDraft(saved, first.leg_id);
      }
      appendTurn(
        "Plan these stays",
        first
          ? stayAskText(
              `The stay list is set. Plan **${first.city}** first (${first.check_in} to ${first.check_out}). You can still add a stay, change one, or change the trip dates later.`,
            )
          : "The stay list is set. Send the hotel for the open stay.",
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  function updateStay() {
    closeOffer("stay-update");
    void saveStayFromDraft();
  }

  return {
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
  };
}

