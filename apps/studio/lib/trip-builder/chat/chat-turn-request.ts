import type { AgentTurnRequest, ApprovalDecision } from "@pureluxe/ai";
import type { TripChatKind, TripChatMessage } from "@pureluxe/db";
import type { TripBuilderChatSendInput } from "@pureluxe/shared";

/** How the advisor's turn is stored: text for typing, an action row for a tap or approval. */
export type AdvisorRowFields = {
  kind: TripChatKind;
  content: string;
  payload: Record<string, unknown> | null;
};

/** `decision`: how the server settled an approval (it may have expired since the card was shown). */
export function advisorRowFields(
  input: TripBuilderChatSendInput,
  decision?: ApprovalDecision,
): AdvisorRowFields {
  switch (input.kind) {
    case "message":
      return { kind: "text", content: input.message, payload: null };
    case "action":
      return {
        kind: "action",
        content: input.label,
        payload: { action: input.action, args: input.args },
      };
    case "resume":
      return { kind: "action", content: input.label, payload: { resume: decision ?? input.decision } };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const DECISIONS: readonly unknown[] = ["approve", "cancel", "expired"] satisfies ApprovalDecision[];

/** The agent request a stored advisor row stands for (also used when a send is retried). */
export function agentRequestFromRow(row: TripChatMessage): AgentTurnRequest {
  const payload = row.payload ?? {};
  if (row.kind === "action" && DECISIONS.includes(payload.resume)) {
    return { kind: "resume", decision: payload.resume as ApprovalDecision };
  }
  if (row.kind === "action" && typeof payload.action === "string") {
    return {
      kind: "action",
      action: {
        tool: payload.action,
        args: isRecord(payload.args) ? payload.args : {},
        label: row.content,
      },
    };
  }
  return { kind: "message", text: row.content };
}
