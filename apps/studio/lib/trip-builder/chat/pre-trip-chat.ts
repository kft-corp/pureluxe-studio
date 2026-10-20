import { createTurnMeter, streamPreTripTurn } from "@pureluxe/ai";
import { AppError, tripMessages, type TripBuilderPreTripChatSendInput } from "@pureluxe/shared";

import type { DeskActor } from "@/lib/ai/create-desk-tools";
import { createPreTripTools } from "@/lib/ai/create-pre-trip-tools";

import type { ChatMessage, ChatStreamEvent } from "./chat";
import { encodeChatStreamEvent } from "./chat-stream";
import { recordAgentTurn, type AgentTurnOutcome } from "./record-agent-turn";

function makeLocalMessage(
  role: "user" | "assistant",
  content: string,
  clientRequestId: string | null = null,
): ChatMessage {
  return {
    id: `pretrip-${crypto.randomUUID()}`,
    role,
    kind: "text",
    content,
    incomplete: false,
    client_request_id: clientRequestId,
    created_at: new Date().toISOString(),
  };
}

/**
 * Home chat NDJSON stream — no trip row, nothing saved to DB.
 */
export function createPreTripChatStream(
  input: TripBuilderPreTripChatSendInput,
  actor: DeskActor,
): ReadableStream<Uint8Array> {
  const user = makeLocalMessage(
    "user",
    input.message,
    input.client_request_id,
  );
  const history = input.history
    .filter((row) => row.content.trim().length > 0)
    .map((row) => ({ role: row.role, content: row.content }));

  const meter = createTurnMeter();
  const finish = (outcome: AgentTurnOutcome) =>
    recordAgentTurn({
      meter,
      outcome,
      channel: "home",
      tripId: null,
      memberId: actor.memberId,
      clientRequestId: input.client_request_id,
    });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        controller.enqueue(encodeChatStreamEvent(event));
      };

      send({ type: "meta", user });

      let fullText = "";
      try {
        for await (const chunk of streamPreTripTurn({
          message: input.message,
          history,
          handlers: createPreTripTools(actor, (clients) => {
            send({ type: "clients", clients });
          }),
          meter,
        })) {
          if (chunk.kind === "status") {
            send({ type: "status", phase: chunk.phase });
            continue;
          }
          if (chunk.kind === "progress") {
            send({ type: "progress", label: chunk.label });
            continue;
          }
          fullText += chunk.text;
          send({ type: "delta", text: chunk.text });
        }

        send({
          type: "done",
          assistant: makeLocalMessage(
            "assistant",
            fullText.trim() ||
              "I couldn't generate a reply. Please try again.",
          ),
        });
        await finish({ status: "ok" });
        controller.close();
      } catch (cause) {
        send({
          type: "error",
          message:
            cause instanceof AppError
              ? cause.userMessage
              : tripMessages.error.aiFailed,
        });
        await finish({ status: "error", cause });
        controller.close();
      }
    },
  });
}
