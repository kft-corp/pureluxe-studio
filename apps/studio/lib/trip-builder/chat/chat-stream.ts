import { AppError, tripMessages } from "@pureluxe/shared";

import type { ChatStreamEvent, PreparedChatTurn } from "./chat";

/** Encode one NDJSON chat event. */
export function encodeChatStreamEvent(event: ChatStreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

/**
 * Pipe a prepared chat turn into an NDJSON ReadableStream.
 * Pre-stream failures should be handled by the route as JSON errors.
 */
export function createChatStream(
  prepared: PreparedChatTurn,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        controller.enqueue(encodeChatStreamEvent(event));
      };

      try {
        if (prepared.kind === "replay") {
          send({
            type: "replay",
            user: prepared.user,
            assistant: prepared.assistant,
          });
          controller.close();
          return;
        }

        send({ type: "meta", user: prepared.user });

        let full = "";
        try {
          for await (const chunk of prepared.chunks) {
            if (chunk.kind === "status") {
              send({ type: "status", phase: chunk.phase });
              continue;
            }
            full += chunk.text;
            send({ type: "delta", text: chunk.text });
          }
          const assistant = await prepared.complete(full);
          send({ type: "done", assistant });
        } catch (cause) {
          await prepared.abandon(full).catch(() => null);
          send({
            type: "error",
            message:
              cause instanceof AppError
                ? cause.userMessage
                : tripMessages.error.aiFailed,
          });
        }

        controller.close();
      } catch (cause) {
        send({
          type: "error",
          message:
            cause instanceof AppError
              ? cause.userMessage
              : tripMessages.error.chatSendFailed,
        });
        controller.close();
      }
    },
  });
}
