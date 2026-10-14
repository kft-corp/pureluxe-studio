import {
  deactivateClient as dbDeactivateClient,
  findClientById,
  insertClientAuditLogs,
  type Client,
} from "@pureluxe/db";
import { AppError, clientMessages } from "@pureluxe/shared";

/** Soft-delete — keeps history and FK targets intact. */
export async function deactivateClient(
  clientId: string,
  actor: { memberId: string },
): Promise<Client> {
  const existing = await findClientById(clientId);

  if (!existing) {
    throw new AppError({
      userMessage: clientMessages.error.notFound,
      code: "clients.not_found",
      status: 404,
    });
  }

  if (!existing.active) {
    throw new AppError({
      userMessage: clientMessages.error.alreadyInactive,
      code: "clients.already_inactive",
      status: 400,
    });
  }

  const deactivated = await dbDeactivateClient({
    id: clientId,
    deactivatedById: actor.memberId,
  });

  await insertClientAuditLogs([
    {
      client_id: clientId,
      action: "deactivated",
      team_member_id: actor.memberId,
    },
  ]);

  return deactivated;
}
