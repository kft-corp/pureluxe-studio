import { z } from "zod";

import { aiError, userMessageOf } from "../errors";

import { executeClientTool } from "./clients";
import type { DeskToolHandlers } from "./handlers";
import { executeHistoryTool } from "./history";
import { executeHotelTool } from "./hotels";

/**
 * Route one tool call to the right domain module.
 * Bad input / unknown name → `{ error }` for the model (loop continues).
 */
export async function executeTool(
  name: string,
  input: unknown,
  handlers: DeskToolHandlers,
): Promise<unknown> {
  try {
    switch (name) {
      case "search_clients":
      case "get_client":
        return executeClientTool(name, input, handlers);

      case "search_trips":
      case "search_bookings":
      case "get_booking":
        return executeHistoryTool(name, input, handlers);

      case "get_hotel":
        return executeHotelTool(input, handlers);

      default:
        return {
          error:
            "Unknown tool. Available: search_clients, get_client, search_trips, search_bookings, get_booking, get_hotel.",
        };
    }
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      return { error: cause.issues[0]?.message ?? "Invalid tool input." };
    }
    const userMessage = userMessageOf(cause);
    if (userMessage) return { error: userMessage };
    throw aiError({
      userMessage: "A tool failed while answering. Try again.",
      code: "ai.tool_failed",
      status: 503,
      cause,
    });
  }
}
