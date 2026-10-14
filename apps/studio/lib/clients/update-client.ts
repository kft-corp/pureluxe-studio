import {
  findClientById,
  insertClientAuditLogs,
  refreshClientProfileCompletenessRpc,
  updateClient as dbUpdateClient,
  type Client,
} from "@pureluxe/db";
import {
  AppError,
  clientMessages,
  type UpdateClientInput,
} from "@pureluxe/shared";

import { AUDIT_CLIENT_FIELDS } from "./client-fields";
import { resolveClientTierId } from "./client-tiers";
import { requireActiveClient } from "./require-active-client";

function toAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** Patch whitelisted fields; recompute completeness; write one batched audit row. */
export async function updateClient(
  clientId: string,
  patch: UpdateClientInput,
  actor: { memberId: string },
  options?: { ifUnmodifiedSince?: string | null },
): Promise<Client> {
  const existing = await requireActiveClient(clientId);

  if (options?.ifUnmodifiedSince) {
    const expected = new Date(options.ifUnmodifiedSince).getTime();
    const actual = new Date(existing.updated_at).getTime();
    if (
      Number.isFinite(expected) &&
      Number.isFinite(actual) &&
      actual > expected
    ) {
      throw new AppError({
        userMessage: clientMessages.error.conflict,
        code: "CONFLICT",
        status: 409,
      });
    }
  }

  const email = patch.email !== undefined ? patch.email : existing.email;
  const phone = patch.phone !== undefined ? patch.phone : existing.phone;

  if (!email && !phone) {
    throw new AppError({
      userMessage: clientMessages.error.contactRequired,
      code: "clients.contact_required",
      status: 400,
    });
  }

  const { tier_slug, ...restPatch } = patch;
  const resolvedPatch: UpdateClientInput = { ...restPatch };

  if (tier_slug !== undefined || patch.tier_id !== undefined) {
    resolvedPatch.tier_id = await resolveClientTierId({
      tier_id: patch.tier_id,
      tier_slug,
    });
    delete resolvedPatch.tier_slug;
  }

  const fieldChanges: Record<
    string,
    { old_value: string | null; new_value: string | null }
  > = {};

  for (const field of AUDIT_CLIENT_FIELDS) {
    if (!(field in resolvedPatch)) continue;
    const nextValue = resolvedPatch[field as keyof UpdateClientInput];
    const previousValue = existing[field as keyof Client];
    const oldValue = toAuditValue(previousValue);
    const newValue = toAuditValue(nextValue);
    if (oldValue === newValue) continue;
    fieldChanges[field] = { old_value: oldValue, new_value: newValue };
  }

  await dbUpdateClient({
    id: clientId,
    ...resolvedPatch,
    updated_by_id: actor.memberId,
  });

  await refreshClientProfileCompletenessRpc(clientId, actor.memberId);

  if (Object.keys(fieldChanges).length > 0) {
    const changedFields = Object.keys(fieldChanges);
    await insertClientAuditLogs([
      {
        client_id: existing.id,
        action: "updated",
        field_name:
          changedFields.length === 1 ? changedFields[0]! : "profile",
        old_value:
          changedFields.length === 1
            ? (fieldChanges[changedFields[0]!]?.old_value ?? null)
            : null,
        new_value:
          changedFields.length === 1
            ? (fieldChanges[changedFields[0]!]?.new_value ?? null)
            : null,
        team_member_id: actor.memberId,
        metadata: {
          source: "studio",
          fields: fieldChanges,
        },
      },
    ]);
  }

  const refreshed = await findClientById(clientId);
  return refreshed ?? existing;
}
