import {
  insertClientAuditLogs,
  upsertClientHealth as dbUpsertClientHealth,
  type ClientHealthProfile,
} from "@pureluxe/db";
import type { UpsertClientHealthInput } from "@pureluxe/shared";

import { refreshClientCompleteness } from "./refresh-client-completeness";
import { requireActiveClient } from "./require-active-client";

/** Create or update health profile for a Studio client. */
export async function upsertClientHealth(
  clientId: string,
  input: UpsertClientHealthInput,
  actor: { memberId: string },
): Promise<ClientHealthProfile> {
  await requireActiveClient(clientId);

  const health = await dbUpsertClientHealth(clientId, {
    dietary_restrictions: input.dietary_restrictions ?? [],
    mobility_notes: input.mobility_notes ?? null,
    medication_notes: input.medication_notes ?? null,
    emergency_contact_name: input.emergency_contact_name ?? null,
    emergency_contact_phone: input.emergency_contact_phone ?? null,
    share_with_hotels: input.share_with_hotels ?? false,
    notes: input.notes ?? null,
    updated_by_id: actor.memberId,
  });

  await insertClientAuditLogs([
    {
      client_id: clientId,
      action: "updated",
      field_name: "health_profile",
      team_member_id: actor.memberId,
      metadata: { source: "studio" },
    },
  ]);

  await refreshClientCompleteness(clientId, actor);

  return health;
}
