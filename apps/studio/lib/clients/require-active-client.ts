import { findClientById, type Client } from "@pureluxe/db";
import { AppError, clientMessages } from "@pureluxe/shared";

/** Load a client that exists and is still active, or throw 404. */
export async function requireActiveClient(clientId: string): Promise<Client> {
  const client = await findClientById(clientId);
  if (!client || !client.active) {
    throw new AppError({
      userMessage: clientMessages.error.notFound,
      code: "clients.not_found",
      status: 404,
    });
  }
  return client;
}
