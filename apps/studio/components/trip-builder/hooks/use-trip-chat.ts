"use client";

import { useState } from "react";
import type { AgentPhase } from "@pureluxe/ai";

import {
  listTripChatMessages,
  saveTripBuilderChatLines,
  streamPreTripChat,
  streamTripChat,
} from "@/lib/api";
import { showApiError } from "@/lib/feedback";
import type { ChatMessage, TripDetail } from "@/lib/trip-builder";

import { applyChatStreamEvent, makeOptimisticUserMessage } from "../apply-chat-stream-event";

import type { TripCore } from "./use-trip-core";

const CHAT_PAGE_SIZE = 30;

/** The chat thread: loading it, streaming agent replies, and saving the local turns. */
export function useTripChat(core: TripCore, initialDetail: TripDetail | null) {
  const {
    detail,
    canWrite,
    setRateOptions,
    setClientHits,
    setSuggestedClients,
    setLeadHits,
    setRoleHits,
    setQuietChips,
    setOffer,
  } = core;

  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(() => Boolean(initialDetail));
  const [chatLoadingOlder, setChatLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [agentPhase, setAgentPhase] = useState<AgentPhase | null>(null);

  function resetChatUi() {
    setMessages([]);
    setChatLoading(false);
    setChatLoadingOlder(false);
    setHasMoreMessages(false);
    setStreamingContent(null);
    setAgentPhase(null);
    setClientHits([]);
    setSuggestedClients([]);
    setRateOptions([]);
    setLeadHits([]);
    setRoleHits([]);
    setOffer(null);
    setQuietChips(false);
  }

  async function loadChatMessages(tripId: string) {
    setChatLoading(true);
    setChatLoadingOlder(false);
    setStreamingContent(null);
    setAgentPhase(null);
    try {
      const response = await listTripChatMessages(tripId, {
        limit: CHAT_PAGE_SIZE,
      });
      setMessages(response.data.messages);
      setHasMoreMessages(response.data.hasMore);
    } catch (error) {
      showApiError(error);
      setMessages([]);
      setHasMoreMessages(false);
    } finally {
      setChatLoading(false);
    }
  }

  async function loadOlderMessages() {
    const tripId = detail?.trip.id;
    const oldest = messages[0];
    if (
      !tripId ||
      !oldest ||
      !hasMoreMessages ||
      chatLoading ||
      chatLoadingOlder
    ) {
      return;
    }

    setChatLoadingOlder(true);
    try {
      const response = await listTripChatMessages(tripId, {
        limit: CHAT_PAGE_SIZE,
        before: oldest.created_at,
      });
      setMessages((prev) => {
        const seen = new Set(prev.map((row) => row.id));
        const older = response.data.messages.filter((row) => !seen.has(row.id));
        return older.length > 0 ? [...older, ...prev] : prev;
      });
      setHasMoreMessages(response.data.hasMore);
    } catch (error) {
      showApiError(error);
    } finally {
      setChatLoadingOlder(false);
    }
  }

  /** Home chat — no trip yet (search_clients / get_client only). */
  async function sendHomeChat(message: string) {
    if (!canWrite || chatBusy) return;

    const clientRequestId = crypto.randomUUID();
    const optimisticUser = makeOptimisticUserMessage(message, clientRequestId);
    const history = messages
      .filter((row) => !row.incomplete && row.content.trim())
      .map((row) => ({ role: row.role, content: row.content }));

    setChatBusy(true);
    setMessages((prev) => [...prev, optimisticUser]);
    setStreamingContent("");
    setAgentPhase("thinking");

    try {
      await streamPreTripChat(
        { message, history, client_request_id: clientRequestId },
        {
          onEvent: (event) =>
            applyChatStreamEvent({
              event,
              optimisticId: optimisticUser.id,
              setMessages,
              setStreamingContent,
              setAgentPhase,
              onClients: rememberClients,
              showError: showApiError,
            }),
        },
      );
    } catch (error) {
      setStreamingContent(null);
      setAgentPhase(null);
      setMessages((prev) =>
        prev.filter((row) => row.id !== optimisticUser.id),
      );
      showApiError(error);
    } finally {
      setChatBusy(false);
    }
  }

  /** Trip chat — persisted messages + full trip tools. */
  async function sendTripChat(
    message: string,
    tripOverride?: TripDetail | null,
  ) {
    const activeTrip = tripOverride ?? detail;
    if (!canWrite || !activeTrip || chatBusy) return;

    const tripId = activeTrip.trip.id;
    const clientRequestId = crypto.randomUUID();
    const optimisticUser = makeOptimisticUserMessage(message, clientRequestId);

    setChatBusy(true);
    setMessages((prev) => [...prev, optimisticUser]);
    setStreamingContent("");
    setAgentPhase("thinking");

    try {
      await streamTripChat(
        tripId,
        { message, client_request_id: clientRequestId },
        {
          onEvent: (event) =>
            applyChatStreamEvent({
              event,
              optimisticId: optimisticUser.id,
              setMessages,
              setStreamingContent,
              setAgentPhase,
              showError: showApiError,
              onError: () => {
                void loadChatMessages(tripId);
              },
            }),
        },
      );
    } catch (error) {
      setStreamingContent(null);
      setAgentPhase(null);
      setMessages((prev) =>
        prev.filter((row) => row.id !== optimisticUser.id),
      );
      showApiError(error);
      void loadChatMessages(tripId);
    } finally {
      setChatBusy(false);
    }
  }

  function rememberClients(clients: { id: string; display_name: string }[]) {
    setSuggestedClients((prev) => {
      const byId = new Map(prev.map((client) => [client.id, client]));
      for (const client of clients) byId.set(client.id, client);
      return [...byId.values()].slice(-6);
    });
  }

  async function appendTurn(userText: string, assistantText: string) {
    setMessages((prev) => [
      ...prev,
      localChatMessage("user", userText),
      localChatMessage("assistant", assistantText),
    ]);
    const tripId = detail?.trip.id;
    if (!tripId) return;
    try {
      await saveTripBuilderChatLines(tripId, [
        { role: "user", content: userText },
        { role: "assistant", content: assistantText },
      ]);
    } catch (error) {
      showApiError(error);
    }
  }

  function localChatMessage(
    role: ChatMessage["role"],
    content: string,
  ): ChatMessage {
    return {
      id: `local-${role}-${crypto.randomUUID()}`,
      role,
      content,
      incomplete: false,
      client_request_id: null,
      created_at: new Date().toISOString(),
    };
  }

  return {
    chatBusy,
    setChatBusy,
    messages,
    setMessages,
    chatLoading,
    setChatLoading,
    chatLoadingOlder,
    setChatLoadingOlder,
    hasMoreMessages,
    setHasMoreMessages,
    streamingContent,
    setStreamingContent,
    agentPhase,
    setAgentPhase,
    resetChatUi,
    loadChatMessages,
    loadOlderMessages,
    sendHomeChat,
    sendTripChat,
    rememberClients,
    appendTurn,
    localChatMessage,
  };
}

export type TripChat = ReturnType<typeof useTripChat>;
