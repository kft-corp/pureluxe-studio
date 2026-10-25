import { AppError, tripMessages } from "@pureluxe/shared";

import type { ChatStreamEvent, PreparedChatTurn, ReplyOutcome } from "./chat";
import { logChatFailure } from "./log-chat-error";

/** Encode one NDJSON chat event. */
export function encodeChatStreamEvent(event: ChatStreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

/**
 * Pipe a prepared chat turn into an NDJSON ReadableStream.
 * Pre-stream failures should be handled by the route as JSON errors.
 * When the advisor leaves mid-reply the agent is stopped; the partial reply is kept.
 */
export function createChatStream(
  prepared: PreparedChatTurn,
): ReadableStream<Uint8Array> {
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        if (cancelled) return;
        controller.enqueue(encodeChatStreamEvent(event));
      };
      const close = () => {
        if (!cancelled) controller.close();
      };

      try {
        if (prepared.kind === "replay") {
          send({
            type: "replay",
            user: prepared.user,
            assistant: prepared.assistant,
          });
          close();
          return;
        }

        if (prepared.kind === "busy") {
          console.info("[trip-chat] trip stream busy", { message: prepared.message });
          send({ type: "busy", message: prepared.message });
          close();
          return;
        }

        console.info("[trip-chat] trip stream start", {
          userId: prepared.user.id,
          clientRequestId: prepared.user.client_request_id,
        });
        send({ type: "meta", user: prepared.user });

        let full = "";
        const outcome: ReplyOutcome = {
          undo: false,
          choices: [],
          rateCompare: null,
          legSplit: null,
          approval: null,
        };
        let quotePreviewUrl: string | null = null;
        try {
          for await (const chunk of prepared.chunks) {
            switch (chunk.kind) {
              case "status":
                send({ type: "status", phase: chunk.phase });
                break;
              case "progress":
                send({ type: "progress", label: chunk.label });
                break;
              case "delta":
                full += chunk.text;
                send({ type: "delta", text: chunk.text });
                break;
              case "changed":
                outcome.undo = chunk.undo;
                send({ type: "changed", summary: chunk.summary });
                break;
              case "choices":
                outcome.choices = chunk.choices;
                break;
              case "rate_compare":
                outcome.rateCompare = chunk.compare;
                break;
              case "leg_split":
                outcome.legSplit = chunk.split;
                break;
              case "approval":
                outcome.approval = chunk.approval;
                break;
              case "quote_preview":
                quotePreviewUrl = chunk.url;
                break;
            }
          }
          const assistant = await prepared.complete(full, outcome);
          send({ type: "done", assistant });
          if (quotePreviewUrl) send({ type: "quote_preview", url: quotePreviewUrl });
          await prepared.finish({ status: "ok" });
          console.info("[trip-chat] trip stream ok", {
            userId: prepared.user.id,
            replyChars: full.length,
          });
        } catch (cause) {
          logChatFailure("trip stream failed", {
            userId: prepared.user.id,
            clientRequestId: prepared.user.client_request_id,
            cancelled,
            partialChars: full.length,
            cause,
          });
          const assistant = await prepared.abandon(full).catch(() => null);
          send({
            type: "error",
            message:
              cause instanceof AppError
                ? cause.userMessage
                : tripMessages.error.aiFailed,
            ...(assistant ? { assistant } : {}),
          });
          await prepared.finish({ status: cancelled ? "aborted" : "error", cause });
        }

        close();
      } catch (cause) {
        logChatFailure("trip stream setup failed", { cancelled, cause });
        send({
          type: "error",
          message:
            cause instanceof AppError
              ? cause.userMessage
              : tripMessages.error.chatSendFailed,
        });
        close();
      }
    },
    cancel() {
      cancelled = true;
      console.info("[trip-chat] trip stream cancelled by client");
      if (prepared.kind === "stream") prepared.abort();
    },
  });
}
