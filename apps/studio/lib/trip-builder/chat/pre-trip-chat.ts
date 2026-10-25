import {
  HOME_PROMPT_VERSION,
  createTurnMeter,
  streamHomeAgentTurn,
  type AgentChoice,
  type AgentTurnRequest,
  type ChatHistoryMessage,
} from "@pureluxe/ai";
import {
  AppError,
  journeyToday,
  tripMessages,
  type TripBuilderChatLinesInput,
  type TripBuilderPreTripChatSendInput,
} from "@pureluxe/shared";

import type { DeskActor } from "@/lib/ai/create-desk-tools";
import { createHomeAgentTools } from "@/lib/ai/create-home-agent-tools";

import { saveTripChatLines, type ChatMessage, type ChatStreamEvent } from "./chat";
import { encodeChatStreamEvent } from "./chat-stream";
import { recordAgentTurn, type AgentTurnOutcome } from "./record-agent-turn";

/** Lines of the home conversation copied into a trip it creates. */
const COPIED_LINES = 20;

function localMessage(
  role: ChatMessage["role"],
  content: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: `pretrip-${crypto.randomUUID()}`,
    role,
    kind: "text",
    content,
    incomplete: false,
    client_request_id: null,
    created_at: new Date().toISOString(),
    ...extra,
  };
}

function toAgentRequest(input: TripBuilderPreTripChatSendInput): Exclude<AgentTurnRequest, { kind: "resume" }> {
  return input.kind === "action"
    ? { kind: "action", action: { tool: input.action, args: input.args, label: input.label } }
    : { kind: "message", text: input.message };
}

/** The home conversation becomes the start of the new trip's chat, so the trip agent picks it up. */
async function copyIntoTrip(
  tripId: string,
  lines: { history: ChatHistoryMessage[]; input: TripBuilderPreTripChatSendInput; reply: string },
  actor: DeskActor,
): Promise<void> {
  const { history, input, reply } = lines;
  const advisor: TripBuilderChatLinesInput["lines"][number] =
    input.kind === "action"
      ? { role: "user", kind: "action", action: input.action, content: input.label }
      : { role: "user", kind: "text", content: input.message };
  await saveTripChatLines(
    tripId,
    [
      ...history.slice(-COPIED_LINES).map((row) => ({ ...row, kind: "text" as const })),
      advisor,
      { role: "assistant", kind: "text", content: reply },
    ],
    actor,
  );
}

/**
 * Home chat NDJSON stream (no trip open). Nothing is saved, unless the agent creates
 * a trip: then the conversation moves into that trip and the browser opens it.
 */
export function createPreTripChatStream(
  input: TripBuilderPreTripChatSendInput,
  actor: DeskActor,
): ReadableStream<Uint8Array> {
  const user = localMessage("user", input.kind === "action" ? input.label : input.message, {
    kind: input.kind === "action" ? "action" : "text",
    client_request_id: input.client_request_id,
  });
  const history = input.history
    .filter((row) => row.content.trim().length > 0)
    .map((row) => ({ role: row.role, content: row.content }));

  const meter = createTurnMeter();
  const controller = new AbortController();
  const finish = (outcome: AgentTurnOutcome) =>
    recordAgentTurn({
      meter,
      outcome,
      channel: "home",
      tripId: null,
      memberId: actor.memberId,
      clientRequestId: input.client_request_id,
      promptVersion: HOME_PROMPT_VERSION,
    });

  let cancelled = false;
  return new ReadableStream<Uint8Array>({
    async start(stream) {
      const send = (event: ChatStreamEvent) => {
        if (!cancelled) stream.enqueue(encodeChatStreamEvent(event));
      };
      send({ type: "meta", user });

      let reply = "";
      let choices: AgentChoice[] = [];
      let opened: { tripId: string; created: boolean } | null = null;
      try {
        for await (const chunk of streamHomeAgentTurn({
          request: toAgentRequest(input),
          handlers: createHomeAgentTools({ ...actor, clientRequestId: input.client_request_id }),
          history,
          today: journeyToday(),
          meter,
          signal: controller.signal,
        })) {
          if (chunk.kind === "status") send({ type: "status", phase: chunk.phase });
          else if (chunk.kind === "progress") send({ type: "progress", label: chunk.label });
          else if (chunk.kind === "delta") {
            reply += chunk.text;
            send({ type: "delta", text: chunk.text });
          } else if (chunk.kind === "choices") choices = chunk.choices;
          else if (chunk.kind === "opened") opened = { tripId: chunk.tripId, created: chunk.created };
        }

        const content = reply.trim() || "I couldn't generate a reply. Please try again.";
        if (opened?.created) await copyIntoTrip(opened.tripId, { history, input, reply: content }, actor);
        send({
          type: "done",
          assistant: localMessage("assistant", content, choices.length > 0 ? { cards: { choices } } : {}),
        });
        if (opened) send({ type: "opened", tripId: opened.tripId });
        await finish({ status: "ok" });
      } catch (cause) {
        const content = reply.trim() || tripMessages.error.replyInterrupted;
        send({
          type: "error",
          message: cause instanceof AppError ? cause.userMessage : tripMessages.error.aiFailed,
          assistant: localMessage("assistant", content, { incomplete: true }),
        });
        await finish({ status: cancelled ? "aborted" : "error", cause });
      }
      if (!cancelled) stream.close();
    },
    cancel() {
      cancelled = true;
      controller.abort();
    },
  });
}
