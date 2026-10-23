"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useTransition } from "react";

import { getTripBuilderTrip } from "@/lib/api";
import { showApiError } from "@/lib/feedback";
import { pageRoutes } from "@/lib/routes";

import { EMPTY_STAY, stayOn } from "../trip-builder-helpers";

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
  } = core;
  const {
    setMessages,
    setChatLoading,
    setHasMoreMessages,
    setStreamingContent,
    setAgentPhase,
    resetChatUi,
    loadChatMessages,
  } = chat;

  const searchParams = useSearchParams();
  const tripParam = searchParams.get("trip");
  const [pending, startTransition] = useTransition();
  const chatLoadedForTripRef = useRef<string | null>(null);

  const syncFromUrl = useEffectEvent(async (tripId: string | null) => {
    if (!tripId) {
      setDetail(null);
      setSummaryOpen(false);
      resetChatUi();
      chooseLeg(null);
      setStayDraft(EMPTY_STAY);
      chatLoadedForTripRef.current = null;
      return;
    }

    try {
      if (detail?.trip.id !== tripId) {
        setChatLoading(true);
        setMessages([]);
        setHasMoreMessages(false);
        setStreamingContent(null);
        setAgentPhase(null);
        const response = await getTripBuilderTrip(tripId);
        const opened = stayOn(response.data, null);
        chooseLeg(opened?.leg_id ?? null);
        setDetail(response.data);
        hydrateStayDraft(response.data, opened?.leg_id ?? null);
        clearOfferedChips();
        setRateOptions([]);
        chatLoadedForTripRef.current = null;
      }

      if (chatLoadedForTripRef.current !== tripId) {
        chatLoadedForTripRef.current = tripId;
        await loadChatMessages(tripId);
      }
    } catch (error) {
      showApiError(error);
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

  function openTrip(tripId: string) {
    if (detail?.trip.id === tripId && chatLoadedForTripRef.current === tripId) {
      return;
    }
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
      router.replace(pageRoutes.tripBuilderTrip(tripId));
    });
  }

  /** Clear to home — does not insert a trip. */
  function newChat() {
    setSummaryOpen(false);
    setDetail(null);
    resetChatUi();
    chooseLeg(null);
    setStayDraft(EMPTY_STAY);
    chatLoadedForTripRef.current = null;
    startTransition(() => {
      router.replace(pageRoutes.tripBuilder);
    });
  }

  /** Status changes (sent, accepted, reopen) live on the trip page. */
  function openTripPage() {
    if (!detail) return;
    router.push(pageRoutes.trip(detail.trip.id));
  }

  return {
    pending,
    openTrip,
    newChat,
    openTripPage,
  };
}
