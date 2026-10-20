import type { Dispatch, SetStateAction } from "react";

import type { AgentPhase } from "@pureluxe/ai/chat-stream";

import type { ChatMessage, ChatStreamEvent } from "@/lib/trip-builder";

type ApplyOptions = {
  event: ChatStreamEvent;
  optimisticId: string;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setStreamingContent: Dispatch<SetStateAction<string | null>>;
  setAgentPhase: Dispatch<SetStateAction<AgentPhase | null>>;
  setAgentProgress?: Dispatch<SetStateAction<string | null>>;
  onClients?: (clients: { id: string; display_name: string }[]) => void;
  /** Another reply is still running on this trip. The turn was not saved. */
  onBusy?: (message: string) => void;
  /** The agent changed the trip. */
  onChanged?: () => void;
  onError?: () => void;
  showError: (error: unknown) => void;
};

function endStream(options: ApplyOptions) {
  options.setStreamingContent(null);
  options.setAgentPhase(null);
  options.setAgentProgress?.(null);
}

/** Apply one NDJSON chat event to local UI state. */
export function applyChatStreamEvent(options: ApplyOptions): void {
  const {
    event,
    optimisticId,
    setMessages,
    setStreamingContent,
    setAgentPhase,
    setAgentProgress,
    onClients,
    onBusy,
    onChanged,
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
    case "clients": {
      onClients?.(event.clients);
      return;
    }
    case "status": {
      setAgentPhase(event.phase);
      if (event.phase === "writing") setAgentProgress?.(null);
      return;
    }
    case "progress": {
      setAgentProgress?.(event.label);
      return;
    }
    case "delta": {
      setStreamingContent((prev) => `${prev ?? ""}${event.text}`);
      return;
    }
    case "changed": {
      onChanged?.();
      return;
    }
    case "done": {
      endStream(options);
      setMessages((prev) =>
        prev.some((row) => row.id === event.assistant.id)
          ? prev
          : [...prev, event.assistant],
      );
      return;
    }
    case "replay": {
      endStream(options);
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
    case "busy": {
      endStream(options);
      setMessages((prev) => prev.filter((row) => row.id !== optimisticId));
      onBusy?.(event.message);
      return;
    }
    case "error": {
      endStream(options);
      showError(new Error(event.message));
      onError?.();
      return;
    }
  }
}

export function makeOptimisticUserMessage(
  content: string,
  clientRequestId: string,
  kind: ChatMessage["kind"] = "text",
): ChatMessage {
  return {
    id: `local-${clientRequestId}`,
    role: "user",
    kind,
    content,
    incomplete: false,
    client_request_id: clientRequestId,
    created_at: new Date().toISOString(),
  };
}
