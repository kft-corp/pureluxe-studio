import { z } from "zod";

import { aiError } from "../errors";

import { executeClientTool, type ClientToolHandlers } from "./clients";
import { executeTripTool, type TripToolHandlers } from "./trip";

type ToolHandlers = ClientToolHandlers | TripToolHandlers;

function userMessageFromError(cause: unknown): string | null {
  if (
    cause &&
    typeof cause === "object" &&
    "userMessage" in cause &&
    typeof (cause as { userMessage: unknown }).userMessage === "string"
  ) {
    return (cause as { userMessage: string }).userMessage;
  }
  return null;
}

/**
 * Route one tool call to the right domain module.
 * Bad input / unknown name → `{ error }` for the model (loop continues).
 */
export async function executeTool(
  name: string,
  input: unknown,
  handlers: ToolHandlers,
): Promise<unknown> {
  try {
    switch (name) {
      case "search_clients":
      case "get_client":
        return executeClientTool(name, input, handlers);

      case "get_trip":
        return executeTripTool(input, handlers);

      default:
        return {
          error:
            "Unknown tool. Available: get_trip (on-trip only), search_clients, get_client.",
        };
    }
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      return { error: cause.issues[0]?.message ?? "Invalid tool input." };
    }
    const userMessage = userMessageFromError(cause);
    if (userMessage) return { error: userMessage };
    throw aiError({
      userMessage: "A tool failed while answering. Try again.",
      code: "ai.tool_failed",
      status: 503,
      cause,
    });
  }
}
