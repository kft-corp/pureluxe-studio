"use client";

import { useRef, useState } from "react";
import type { AgentPhase } from "@pureluxe/ai/chat-stream";
import type { TripBuilderChatSendBody, TripBuilderPreTripChatSendBody } from "@pureluxe/shared";

import {
  listTripChatMessages,
  saveTripBuilderChatLines,
  streamPreTripChat,
  streamTripChat,
} from "@/lib/api";
import { showApiError, showWarningToast } from "@/lib/feedback";
import { pageRoutes } from "@/lib/routes";
import type { ChatMessage, TripDetail } from "@/lib/trip-builder";

import { applyChatStreamEvent, makeOptimisticUserMessage } from "../apply-chat-stream-event";

import type { TripCore } from "./use-trip-core";

const CHAT_PAGE_SIZE = 30;
/** Wait before re-sending a message that hit another reply still running on this trip. */
const BUSY_RETRY_MS = 5000;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A button that asks the agent to run one of its tools directly. */
export type TripChatAction = {
  action: string;
  args?: Record<string, unknown>;
  label: string;
};

/** The chat thread: loading it, streaming agent replies, and saving the local turns. */
export function useTripChat(core: TripCore, initialDetail: TripDetail | null) {
  const {
    router,
    detail,
    canWrite,
    setRateOptions,
    setQuietChips,
    setOffer,
    refreshAfterMutation,
  } = core;

  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(() => Boolean(initialDetail));
  const [chatLoadingOlder, setChatLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [agentPhase, setAgentPhase] = useState<AgentPhase | null>(null);
  const [agentSteps, setAgentSteps] = useState<string[]>([]);

  /** The chip being tapped. Its user line is saved as an action, never as typed text. */
  const tapRef = useRef<{ id: string } | null>(null);
  /** Messages typed while a reply is running. Sent in order when the chat is free. */
  const queueRef = useRef<string[]>([]);
  const [queuedCount, setQueuedCount] = useState(0);
  const [queuePaused, setQueuePaused] = useState(false);

  function resetChatUi() {
    setMessages([]);
    setChatLoading(false);
    setChatLoadingOlder(false);
    setHasMoreMessages(false);
    setStreamingContent(null);
    setAgentPhase(null);
    setAgentSteps([]);
    setRateOptions([]);
    setOffer(null);
    setQuietChips(false);
    tapRef.current = null;
    queueRef.current = [];
    setQueuedCount(0);
  }

  function enqueueMessage(text: string, options: { front?: boolean } = {}) {
    queueRef.current = options.front ? [text, ...queueRef.current] : [...queueRef.current, text];
    setQueuedCount(queueRef.current.length);
  }

  function dequeueMessage(): string | null {
    const [next, ...rest] = queueRef.current;
    queueRef.current = rest;
    setQueuedCount(rest.length);
    return next ?? null;
  }

  /** Hold the queue for a moment after a busy reply, then try again. */
  function pauseQueue() {
    setQueuePaused(true);
    window.setTimeout(() => setQueuePaused(false), BUSY_RETRY_MS);
  }

  function beginTap(chipId: string) {
    tapRef.current = { id: chipId };
  }

  function clearTap() {
    tapRef.current = null;
  }

  async function loadChatMessages(tripId: string) {
    setChatLoading(true);
    setChatLoadingOlder(false);
    setStreamingContent(null);
    setAgentPhase(null);
    setAgentSteps([]);
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

  /**
   * Home chat (no trip open): a typed message or a button tap. When the agent creates
   * or picks a trip, the trip opens and the conversation continues there.
   */
  async function streamHomeTurn(
    body: DistributiveOmit<TripBuilderPreTripChatSendBody, "history" | "client_request_id">,
    label: string,
  ) {
    if (!canWrite || chatBusy) return;
    clearTap();

    const clientRequestId = crypto.randomUUID();
    const optimisticUser = makeOptimisticUserMessage(
      label,
      clientRequestId,
      body.kind === "action" ? "action" : "text",
    );
    const history = messages
      .filter((row) => !row.incomplete && row.content.trim())
      .map((row) => ({ role: row.role, content: row.content }));

    setChatBusy(true);
    setMessages((prev) => [...prev, optimisticUser]);
    setStreamingContent("");
    setAgentPhase("thinking");
    setAgentSteps([]);

    try {
      await streamPreTripChat(
        { ...body, history, client_request_id: clientRequestId },
        {
          onEvent: (event) =>
            applyChatStreamEvent({
              event,
              optimisticId: optimisticUser.id,
              setMessages,
              setStreamingContent,
              setAgentPhase,
              setAgentSteps,
              onOpened: (tripId) => router.replace(pageRoutes.tripBuilderTrip(tripId)),
              showError: showApiError,
            }),
        },
      );
    } catch (error) {
      setStreamingContent(null);
      setAgentPhase(null);
      setAgentSteps([]);
      setMessages((prev) =>
        prev.filter((row) => row.id !== optimisticUser.id),
      );
      showApiError(error);
    } finally {
      setChatBusy(false);
    }
  }

  function sendHomeChat(message: string) {
    return streamHomeTurn({ kind: "message", message }, message);
  }

  function sendHomeAction(action: TripChatAction) {
    return streamHomeTurn(
      { kind: "action", action: action.action, args: action.args ?? {}, label: action.label },
      action.label,
    );
  }

  /** Stream one trip turn (typed message, button action or approval) and keep the thread in sync. */
  async function streamTripTurn(
    tripId: string,
    body: TripBuilderChatSendBody,
    optimisticUser: ChatMessage | null,
    onBusy: (message: string) => void,
  ) {
    setChatBusy(true);
    if (optimisticUser) {
      setMessages((prev) => [...prev, optimisticUser]);
    }
    setStreamingContent("");
    setAgentPhase("thinking");
    setAgentSteps([]);
    let changed = false;
    const optimisticId = optimisticUser?.id ?? `retry-${body.client_request_id}`;

    try {
      await streamTripChat(tripId, body, {
        onEvent: (event) =>
          applyChatStreamEvent({
            event,
            optimisticId,
            setMessages,
            setStreamingContent,
            setAgentPhase,
            setAgentSteps,
            onBusy,
            onChanged: () => {
              changed = true;
            },
            onQuotePreview: (url) => {
              changed = true;
              window.open(url, "_blank", "noopener,noreferrer");
            },
            showError: showApiError,
            onError: () => {
              void loadChatMessages(tripId);
            },
          }),
      });
    } catch (error) {
      setStreamingContent(null);
      setAgentPhase(null);
      setAgentSteps([]);
      if (optimisticUser) {
        setMessages((prev) =>
          prev.filter((row) => row.id !== optimisticUser.id),
        );
      }
      showApiError(error);
      void loadChatMessages(tripId);
    } finally {
      setChatBusy(false);
    }
    // Also after a failed reply: changes made before it stopped are saved.
    if (changed) await refreshAfterMutation(tripId).catch(showApiError);
  }

  /**
   * Resume an incomplete assistant reply using the same client_request_id so the
   * server continues from the LangGraph checkpointer.
   */
  async function continueIncomplete() {
    if (!canWrite || !detail || chatBusy) return;
    clearTap();

    let incompleteIdx = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const row = messages[i];
      if (row?.role === "assistant" && row.incomplete) {
        incompleteIdx = i;
        break;
      }
    }
    if (incompleteIdx < 1) return;
    const user = messages[incompleteIdx - 1];
    if (!user || user.role !== "user" || !user.client_request_id) {
      showWarningToast("Nothing to continue — send a new message instead.");
      return;
    }

    setMessages((prev) => prev.slice(0, incompleteIdx));
    await streamTripTurn(
      detail.trip.id,
      {
        kind: "message",
        message: user.content.trim() || "Continue",
        client_request_id: user.client_request_id,
      },
      null,
      (message) => showWarningToast(message),
    );
  }

  /** Trip chat — persisted messages + full trip tools. */
  async function sendTripChat(
    message: string,
    tripOverride?: TripDetail | null,
  ) {
    const activeTrip = tripOverride ?? detail;
    if (!canWrite || !activeTrip || chatBusy) return;
    clearTap();

    const clientRequestId = crypto.randomUUID();
    await streamTripTurn(
      activeTrip.trip.id,
      { kind: "message", message, client_request_id: clientRequestId },
      makeOptimisticUserMessage(message, clientRequestId),
      () => {
        enqueueMessage(message, { front: true });
        pauseQueue();
      },
    );
  }

  /** A button that runs an agent tool directly. Sent as an action, never as typed text. */
  async function sendTripAction(action: TripChatAction) {
    if (!canWrite || !detail || chatBusy) return;
    clearTap();

    const clientRequestId = crypto.randomUUID();
    await streamTripTurn(
      detail.trip.id,
      {
        kind: "action",
        action: action.action,
        args: action.args ?? {},
        label: action.label,
        client_request_id: clientRequestId,
      },
      makeOptimisticUserMessage(action.label, clientRequestId, "action"),
      (message) => showWarningToast(message),
    );
  }

  /** Confirm or Cancel on the agent's approval card: the paused reply continues. */
  async function sendApproval(decision: "approve" | "cancel") {
    if (!canWrite || !detail || chatBusy) return;
    clearTap();

    const label = decision === "approve" ? "Confirm" : "Cancel";
    const clientRequestId = crypto.randomUUID();
    await streamTripTurn(
      detail.trip.id,
      { kind: "resume", decision, label, client_request_id: clientRequestId },
      makeOptimisticUserMessage(label, clientRequestId, "action"),
      (message) => showWarningToast(message),
    );
  }

  async function appendTurn(userText: string, assistantText: string) {
    const tap = tapRef.current;
    tapRef.current = null;
    setMessages((prev) => [
      ...prev,
      localChatMessage("user", userText, tap ? "action" : "text"),
      localChatMessage("assistant", assistantText),
    ]);
    const tripId = detail?.trip.id;
    if (!tripId) return;
    try {
      await saveTripBuilderChatLines(tripId, [
        tap
          ? { role: "user", kind: "action", action: tap.id, content: userText }
          : { role: "user", content: userText },
        { role: "assistant", content: assistantText },
      ]);
    } catch (error) {
      showApiError(error);
    }
  }

  function localChatMessage(
    role: ChatMessage["role"],
    content: string,
    kind: ChatMessage["kind"] = "text",
  ): ChatMessage {
    return {
      id: `local-${role}-${crypto.randomUUID()}`,
      role,
      kind,
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
    agentSteps,
    resetChatUi,
    loadChatMessages,
    loadOlderMessages,
    sendHomeChat,
    sendHomeAction,
    sendTripChat,
    sendTripAction,
    sendApproval,
    continueIncomplete,
    appendTurn,
    localChatMessage,
    beginTap,
    clearTap,
    queuedCount,
    queuePaused,
    enqueueMessage,
    dequeueMessage,
  };
}

export type TripChat = ReturnType<typeof useTripChat>;
