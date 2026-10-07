import type { Dispatch, SetStateAction } from "react";

import type { AgentPhase } from "@pureluxe/ai";

import type { ChatMessage, ChatStreamEvent } from "@/lib/trip-builder";

type ApplyOptions = {
  event: ChatStreamEvent;
  optimisticId: string;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setStreamingContent: Dispatch<SetStateAction<string | null>>;
  setAgentPhase: Dispatch<SetStateAction<AgentPhase | null>>;
  onError?: () => void;
  showError: (error: unknown) => void;
};

function endStream(
  setStreamingContent: ApplyOptions["setStreamingContent"],
  setAgentPhase: ApplyOptions["setAgentPhase"],
) {
  setStreamingContent(null);
  setAgentPhase(null);
}

/** Apply one NDJSON chat event to local UI state. */
export function applyChatStreamEvent(options: ApplyOptions): void {
  const {
    event,
    optimisticId,
    setMessages,
    setStreamingContent,
    setAgentPhase,
    onError,
    showError,
  } = options;

  switch (event.type) {
    case "meta": {
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((row) => row.id !== optimisticId);
        if (withoutOptimistic.some((row) => row.id === event.user.id)) {
          return withoutOptimistic;
        }
        return [...withoutOptimistic, event.user];
      });
      setStreamingContent("");
      return;
    }
    case "status": {
      setAgentPhase(event.phase);
      return;
    }
    case "delta": {
      setStreamingContent((prev) => `${prev ?? ""}${event.text}`);
      return;
    }
    case "done": {
      endStream(setStreamingContent, setAgentPhase);
      setMessages((prev) =>
        prev.some((row) => row.id === event.assistant.id)
          ? prev
          : [...prev, event.assistant],
      );
      return;
    }
    case "replay": {
      endStream(setStreamingContent, setAgentPhase);
      setMessages((prev) => {
        const without = prev.filter(
          (row) =>
            row.id !== optimisticId &&
            row.id !== event.user.id &&
            row.id !== event.assistant.id,
        );
        return [...without, event.user, event.assistant];
      });
      return;
    }
    case "error": {
      endStream(setStreamingContent, setAgentPhase);
      showError(new Error(event.message));
      onError?.();
      return;
    }
  }
}

export function makeOptimisticUserMessage(
  message: string,
  clientRequestId: string,
): ChatMessage {
  return {
    id: `local-${clientRequestId}`,
    role: "user",
    content: message,
    incomplete: false,
    client_request_id: clientRequestId,
    created_at: new Date().toISOString(),
  };
}
