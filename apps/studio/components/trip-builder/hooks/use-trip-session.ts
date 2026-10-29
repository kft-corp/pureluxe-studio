"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useTransition } from "react";

import { getTripBuilderTrip } from "@/lib/api";
import { showApiError } from "@/lib/feedback";
import { pageRoutes } from "@/lib/routes";

import { EMPTY_STAY, stayOn } from "../trip-builder-helpers";

import { clearSoftTripHandoff } from "./soft-trip-handoff";
import type { TripChat } from "./use-trip-chat";
import type { TripCore } from "./use-trip-core";

/** Which trip is open: the URL, opening trips, and the empty home chat. */
export function useTripSession(core: TripCore, chat: TripChat) {
  const {
    router,
    detail,
    setDetail,
    setSummaryOpen,
    setRateOptions,
    setStayDraft,
    chooseLeg,
    hydrateStayDraft,
    clearOfferedChips,
    refreshTrips,
  } = core;
  const {
    setMessages,
    setChatLoading,
    setHasMoreMessages,
    setStreamingContent,
    setAgentPhase,
    softRestoredTripId,
    resetChatUi,
    loadChatMessages,
  } = chat;

  const searchParams = useSearchParams();
  const tripParam = searchParams.get("trip");
  const [pending, startTransition] = useTransition();
  const chatLoadedForTripRef = useRef<string | null>(softRestoredTripId);
  /** Create-from-home: keep the live thread; URL sync must not wipe or skeleton. */
  const softHandoffTripRef = useRef<string | null>(softRestoredTripId);

  async function hydrateDesk(tripId: string) {
    const response = await getTripBuilderTrip(tripId);
    const opened = stayOn(response.data, null);
    chooseLeg(opened?.leg_id ?? null);
    setDetail(response.data);
    hydrateStayDraft(response.data, opened?.leg_id ?? null);
    clearOfferedChips();
    setRateOptions([]);
    void refreshTrips();
    return response.data;
  }

  const syncFromUrl = useEffectEvent(async (tripId: string | null) => {
    if (!tripId) {
      softHandoffTripRef.current = null;
      setDetail(null);
      setSummaryOpen(false);
      resetChatUi();
      chooseLeg(null);
      setStayDraft(EMPTY_STAY);
      chatLoadedForTripRef.current = null;
      return;
    }

    try {
      const soft = softHandoffTripRef.current === tripId;

      if (detail?.trip.id !== tripId) {
        if (soft) {
          // Keep bubbles; only attach trip chrome around the same thread.
          softHandoffTripRef.current = null;
          clearSoftTripHandoff(tripId);
          await hydrateDesk(tripId);
          chatLoadedForTripRef.current = tripId;
          return;
        }

        setChatLoading(true);
        setMessages([]);
        setHasMoreMessages(false);
        setStreamingContent(null);
        setAgentPhase(null);
        await hydrateDesk(tripId);
        chatLoadedForTripRef.current = null;
      } else if (soft) {
        softHandoffTripRef.current = null;
        clearSoftTripHandoff(tripId);
        chatLoadedForTripRef.current = tripId;
        return;
      }

      if (chatLoadedForTripRef.current !== tripId) {
        chatLoadedForTripRef.current = tripId;
        await loadChatMessages(tripId);
      }
    } catch (error) {
      showApiError(error);
      softHandoffTripRef.current = null;
      router.replace(pageRoutes.tripBuilder);
      setDetail(null);
      resetChatUi();
      setStayDraft(EMPTY_STAY);
      chatLoadedForTripRef.current = null;
    }
  });

  useEffect(() => {
    let cancelled = false;

    // Sync after tick so setState is not synchronous inside the effect body.
    const timer = window.setTimeout(() => {
      if (!cancelled) void syncFromUrl(tripParam);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tripParam]);

  /**
   * Home chat just created this trip: keep the live thread, hydrate the desk,
   * and quietly put `?trip=` in the URL. No skeleton.
   */
  function attachTripFromChat(tripId: string) {
    if (detail?.trip.id === tripId && chatLoadedForTripRef.current === tripId) {
      return;
    }
    softHandoffTripRef.current = tripId;
    chatLoadedForTripRef.current = tripId;
    startTransition(() => {
      router.replace(pageRoutes.tripBuilderTrip(tripId), { scroll: false });
    });
    void hydrateDesk(tripId)
      .then(() => {
        clearSoftTripHandoff(tripId);
      })
      .catch((error) => {
        showApiError(error);
        softHandoffTripRef.current = null;
        chatLoadedForTripRef.current = null;
        clearSoftTripHandoff(tripId);
        router.replace(pageRoutes.tripBuilder, { scroll: false });
        setDetail(null);
        resetChatUi();
        setStayDraft(EMPTY_STAY);
      });
  }

  /** Cold open (trips menu / open existing): wipe thread, skeleton, then load. */
  function openTrip(tripId: string) {
    if (detail?.trip.id === tripId && chatLoadedForTripRef.current === tripId) {
      return;
    }
    softHandoffTripRef.current = null;
    clearSoftTripHandoff();
    setChatLoading(true);
    setMessages([]);
    setHasMoreMessages(false);
    setStreamingContent(null);
    setAgentPhase(null);
    if (detail?.trip.id !== tripId) {
      setDetail(null);
    }
    chatLoadedForTripRef.current = null;
    startTransition(() => {
      router.replace(pageRoutes.tripBuilderTrip(tripId), { scroll: false });
    });
  }

  /** Clear to home — does not insert a trip. */
  function newChat() {
    softHandoffTripRef.current = null;
    clearSoftTripHandoff();
    setSummaryOpen(false);
    setDetail(null);
    resetChatUi();
    chooseLeg(null);
    setStayDraft(EMPTY_STAY);
    chatLoadedForTripRef.current = null;
    startTransition(() => {
      router.replace(pageRoutes.tripBuilder, { scroll: false });
    });
  }

  /** Status changes (sent, accepted, reopen) live on the trip page. */
  function openTripPage() {
    if (!detail) return;
    router.push(pageRoutes.trip(detail.trip.id));
  }

  return {
    pending,
    attachTripFromChat,
    openTrip,
    newChat,
    openTripPage,
  };
}
