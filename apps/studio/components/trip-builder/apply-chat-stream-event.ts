import type { Dispatch, SetStateAction } from "react";

import type { AgentPhase } from "@pureluxe/ai/chat-stream";

import type { ChatMessage, ChatStreamEvent } from "@/lib/trip-builder";

type ApplyOptions = {
  event: ChatStreamEvent;
  optimisticId: string;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setStreamingContent: Dispatch<SetStateAction<string | null>>;
  setAgentPhase: Dispatch<SetStateAction<AgentPhase | null>>;
  /** The steps of this reply so far, in order ("Finding the client…"). */
  setAgentSteps?: Dispatch<SetStateAction<string[]>>;
  /** Another reply is still running on this trip. The turn was not saved. */
  onBusy?: (message: string) => void;
  /** The agent changed the trip. */
  onChanged?: () => void;
  /** Home chat: the agent created or chose a trip to open. */
  onOpened?: (tripId: string, meta: { created: boolean }) => void;
  /** Open the options quote PDF in a new tab. */
  onQuotePreview?: (url: string) => void;
  onError?: () => void;
  showError: (error: unknown) => void;
};

function endStream(options: ApplyOptions) {
  options.setStreamingContent(null);
  options.setAgentPhase(null);
  options.setAgentSteps?.([]);
}

/** Apply one NDJSON chat event to local UI state. */
export function applyChatStreamEvent(options: ApplyOptions): void {
  const {
    event,
    optimisticId,
    setMessages,
    setStreamingContent,
    setAgentPhase,
    setAgentSteps,
    onBusy,
    onChanged,
    onOpened,
    onQuotePreview,
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
    case "progress": {
      setAgentSteps?.((steps) => (steps.at(-1) === event.label ? steps : [...steps, event.label]));
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
    case "opened": {
      onOpened?.(event.tripId, { created: event.created });
      return;
    }
    case "quote_preview": {
      onQuotePreview?.(event.url);
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
      if (event.assistant) {
        setMessages((prev) =>
          prev.some((row) => row.id === event.assistant!.id)
            ? prev
            : [...prev, event.assistant!],
        );
      }
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
