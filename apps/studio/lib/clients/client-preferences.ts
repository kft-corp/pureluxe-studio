import {
  findClientPreferenceById,
  insertClientAuditLogs,
  insertClientPreference,
  updateClientPreference as dbUpdateClientPreference,
  type ClientPreference,
} from "@pureluxe/db";
import {
  AppError,
  clientMessages,
  type CreateClientPreferenceInput,
  type UpdateClientPreferenceInput,
} from "@pureluxe/shared";

import { refreshClientCompleteness } from "./refresh-client-completeness";
import { requireActiveClient } from "./require-active-client";

/** Add a Studio preference (advisor source, confirmed). */
export async function createClientPreference(
  clientId: string,
  input: CreateClientPreferenceInput,
  actor: { memberId: string },
): Promise<ClientPreference> {
  await requireActiveClient(clientId);

  const preference = await insertClientPreference(clientId, {
    category: input.category,
    label: input.label,
    sentiment: input.sentiment,
    source: "advisor",
    is_confirmed: true,
    notes: input.notes ?? null,
    created_by_id: actor.memberId,
  });

  await insertClientAuditLogs([
    {
      client_id: clientId,
      action: "updated",
      field_name: "preference",
      new_value: preference.label,
      team_member_id: actor.memberId,
      metadata: { source: "studio", preference_id: preference.id },
    },
  ]);

  await refreshClientCompleteness(clientId, actor);

  return preference;
}

/** Update, confirm, or soft-deactivate a preference. */
export async function updateClientPreference(
  clientId: string,
  preferenceId: string,
  input: UpdateClientPreferenceInput,
  actor: { memberId: string },
): Promise<ClientPreference> {
  await requireActiveClient(clientId);

  const existing = await findClientPreferenceById(preferenceId);
  if (!existing || existing.client_id !== clientId) {
    throw new AppError({
      userMessage: clientMessages.error.preferenceNotFound,
      code: "clients.preference_not_found",
      status: 404,
    });
  }

  const confirming =
    input.is_confirmed === true && existing.is_confirmed === false;
  const deactivating = input.active === false;

  const preference = await dbUpdateClientPreference(preferenceId, {
    category: input.category,
    label: input.label,
    sentiment: input.sentiment,
    notes: input.notes,
    is_confirmed: input.is_confirmed,
    active: input.active,
    ...(confirming
      ? {
          confirmed_by_id: actor.memberId,
          confirmed_at: new Date().toISOString(),
        }
      : {}),
  });

  await insertClientAuditLogs([
    {
      client_id: clientId,
      action: confirming ? "preference_confirmed" : "updated",
      field_name: "preference",
      old_value: existing.label,
      new_value: preference.label,
      team_member_id: actor.memberId,
      metadata: {
        source: "studio",
        preference_id: preference.id,
        ...(deactivating ? { deactivated: true } : {}),
        ...(confirming ? { confirmed: true } : {}),
      },
    },
  ]);

  await refreshClientCompleteness(clientId, actor);

  return preference;
}
