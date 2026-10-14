import { z } from "zod";

import type { ClientToolHandlers } from "./types";

const searchClientsInputSchema = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(10).optional(),
});

const getClientInputSchema = z.object({
  client_id: z.string().uuid().optional(),
});

/**
 * Run a client-domain tool.
 * Throws ZodError / AppError-shaped errors for the root executor to wrap.
 */
export async function executeClientTool(
  name: "search_clients" | "get_client",
  input: unknown,
  handlers: ClientToolHandlers,
): Promise<unknown> {
  switch (name) {
    case "search_clients": {
      const parsed = searchClientsInputSchema.parse(input ?? {});
      return handlers.searchClients({
        query: parsed.query,
        limit: parsed.limit,
      });
    }
    case "get_client": {
      const parsed = getClientInputSchema.parse(input ?? {});
      return handlers.getClient({ clientId: parsed.client_id });
    }
  }
}
