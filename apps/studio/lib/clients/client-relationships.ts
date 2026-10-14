import {
  deleteClientRelationship as dbDeleteClientRelationship,
  findClientRelationshipById,
  insertClientAuditLogs,
  insertClientRelationship,
  type ClientRelationship,
} from "@pureluxe/db";
import {
  AppError,
  clientMessages,
  type CreateClientRelationshipInput,
} from "@pureluxe/shared";

import { requireActiveClient } from "./require-active-client";

/** Link a non-household related person. */
export async function createClientRelationship(
  clientId: string,
  input: CreateClientRelationshipInput,
  actor: { memberId: string },
): Promise<ClientRelationship> {
  await requireActiveClient(clientId);

  if (input.to_client_id === clientId) {
    throw new AppError({
      userMessage: clientMessages.error.cannotLinkSelf,
      code: "clients.cannot_link_self",
      status: 400,
    });
  }

  await requireActiveClient(input.to_client_id);

  const relationship = await insertClientRelationship({
    from_client_id: clientId,
    to_client_id: input.to_client_id,
    relationship_type: input.relationship_type,
    notes: input.notes ?? null,
    created_by_id: actor.memberId,
  });

  await insertClientAuditLogs([
    {
      client_id: clientId,
      action: "updated",
      field_name: "relationship",
      new_value: input.to_client_id,
      team_member_id: actor.memberId,
      metadata: {
        source: "studio",
        relationship_id: relationship.id,
        relationship_type: relationship.relationship_type,
      },
    },
  ]);

  return relationship;
}

/** Remove a relationship linked to this client. */
export async function deleteClientRelationship(
  clientId: string,
  relationshipId: string,
  actor: { memberId: string },
): Promise<void> {
  await requireActiveClient(clientId);

  const existing = await findClientRelationshipById(relationshipId);
  if (
    !existing ||
    (existing.from_client_id !== clientId &&
      existing.to_client_id !== clientId)
  ) {
    throw new AppError({
      userMessage: clientMessages.error.relationshipNotFound,
      code: "clients.relationship_not_found",
      status: 404,
    });
  }

  await dbDeleteClientRelationship(relationshipId);

  await insertClientAuditLogs([
    {
      client_id: clientId,
      action: "updated",
      field_name: "relationship",
      old_value: relationshipId,
      team_member_id: actor.memberId,
      metadata: {
        source: "studio",
        relationship_id: relationshipId,
        removed: true,
      },
    },
  ]);
}
