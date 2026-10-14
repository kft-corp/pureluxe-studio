import {
  approveClientRecord,
  insertClientAuditLogs,
  type Client,
} from "@pureluxe/db";
import { AppError, clientMessages } from "@pureluxe/shared";

import { requireActiveClient } from "./require-active-client";

/** Pending → approved. */
export async function approveClient(
  clientId: string,
  actor: { memberId: string },
): Promise<Client> {
  const existing = await requireActiveClient(clientId);

  if (existing.review_status === "approved") {
    throw new AppError({
      userMessage: clientMessages.error.alreadyApproved,
      code: "clients.already_approved",
      status: 400,
    });
  }

  const approved = await approveClientRecord({
    id: clientId,
    reviewedById: actor.memberId,
  });

  await insertClientAuditLogs([
    {
      client_id: clientId,
      action: "approved",
      team_member_id: actor.memberId,
    },
  ]);

  return approved;
}
