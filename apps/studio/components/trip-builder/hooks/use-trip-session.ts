"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useTransition } from "react";

import { createTripBuilderTrip, getTripBuilderTrip, saveTripBuilderChatLines } from "@/lib/api";
import { showApiError } from "@/lib/feedback";
import { pageRoutes } from "@/lib/routes";
import type { ChatMessage, TripDetail } from "@/lib/trip-builder";

import { whoElseText } from "../trip-builder-copy";
import { EMPTY_STAY, stayOn } from "../trip-builder-helpers";

import type { TripChat } from "./use-trip-chat";
import type { TripCore } from "./use-trip-core";

/** Which trip is open: the URL, opening and creating trips, and the empty home chat. */
export function useTripSession(core: TripCore, chat: TripChat, prefillClientId: string | null) {
  const {
    router,
    detail,
    setDetail,
    canWrite,
    setSummaryOpen,
    setBusy,
    setRateOptions,
    setClientHits,
    suggestedClients,
    setSuggestedClients,
    setStayDraft,
    setOffer,
    chooseLeg,
    hydrateStayDraft,
    refreshTrips,
    clearOfferedChips,
  } = core;
  const {
    messages,
    setMessages,
    setChatLoading,
    setHasMoreMessages,
    setStreamingContent,
    setAgentPhase,
    resetChatUi,
    loadChatMessages,
    localChatMessage,
  } = chat;

  const searchParams = useSearchParams();
  const tripParam = searchParams.get("trip");
  const [pending, startTransition] = useTransition();
  const chatLoadedForTripRef = useRef<string | null>(null);
  const skipChatLoadForTripRef = useRef<string | null>(null);

  const syncFromUrl = useEffectEvent(async (tripId: string | null) => {
    if (!tripId) {
      setDetail(null);
      setSummaryOpen(false);
      resetChatUi();
      chooseLeg(null);
      setStayDraft(EMPTY_STAY);
      chatLoadedForTripRef.current = null;
      skipChatLoadForTripRef.current = null;
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

      if (skipChatLoadForTripRef.current === tripId) {
        skipChatLoadForTripRef.current = null;
        chatLoadedForTripRef.current = tripId;
        setChatLoading(false);
        return;
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
    skipChatLoadForTripRef.current = null;
    startTransition(() => {
      router.replace(pageRoutes.tripBuilder);
    });
  }

  async function createTrip(clientId?: string | null, clientName?: string) {
    if (!canWrite) return null;
    setBusy(true);
    try {
      const response = await createTripBuilderTrip({
        primary_client_id: clientId ?? prefillClientId ?? null,
      });
      setDetail(response.data);
      setClientHits([]);
      setSuggestedClients([]);
      setOffer(null);
      setRateOptions([]);
      setStreamingContent(null);
      setAgentPhase(null);
      setHasMoreMessages(false);
      setChatLoading(false);
      chooseLeg(null);
      hydrateStayDraft(response.data, null);
      skipChatLoadForTripRef.current = response.data.trip.id;
      chatLoadedForTripRef.current = response.data.trip.id;
      await refreshTrips();
      const name =
        response.data.client?.display_name?.trim() || clientName?.trim();
      const kept = messages
        .filter((row) => !row.incomplete && row.content.trim())
        .map((row) => ({ role: row.role, content: row.content }));
      const userLine = name ? `Create trip for ${name}` : "Create trip";
      const assistant = createdTripReply(response.data);
      const lines = [
        ...kept,
        { role: "user" as const, content: userLine },
        { role: "assistant" as const, content: assistant.content },
      ].slice(-40);
      try {
        const saved = await saveTripBuilderChatLines(
          response.data.trip.id,
          lines,
        );
        setMessages(saved.data);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          localChatMessage("user", userLine),
          assistant,
        ]);
        showApiError(error);
      }
      router.replace(pageRoutes.tripBuilderTrip(response.data.trip.id));
      return response.data;
    } catch (error) {
      showApiError(error);
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** Status changes (sent, accepted, reopen) live on the trip page. */
  function openTripPage() {
    if (!detail) return;
    router.push(pageRoutes.trip(detail.trip.id));
  }

  function createdTripReply(saved: TripDetail): ChatMessage {
    const name = saved.client?.display_name?.trim();
    const content = name
      ? `I've created this trip for **${name}**.\n\n${whoElseText(saved)}`
      : "I've created this trip. Tell me which client it is for, and a confirm chip will appear before they are added.";
    return localChatMessage("assistant", content);
  }

  function promptCreateTrip() {
    const names = suggestedClients.map((client) => client.display_name);
    const content =
      names.length > 0
        ? `Pick a client to start this trip:\n${names.map((name) => `- **Create trip · ${name}**`).join("\n")}`
        : "Tell me which client this trip is for. When I find them, tap **Create trip · their name** below.";
    setMessages((prev) => [
      ...prev,
      localChatMessage("user", "Create trip"),
      localChatMessage("assistant", content),
    ]);
  }

  return {
    pending,
    openTrip,
    newChat,
    createTrip,
    openTripPage,
    promptCreateTrip,
  };
}

