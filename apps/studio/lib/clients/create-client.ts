import {
  AppError,
  clientMessages,
  type CreateClientInput,
} from "@pureluxe/shared";
import {
  findSimilarClients,
  findTeamMemberById,
  insertClient,
  insertClientAuditLogs,
  type Client,
  type SimilarClientMatch,
} from "@pureluxe/db";

import { resolveClientTierId } from "./client-tiers";
import { computeProfileCompletenessFromClient } from "./profile-completeness";

export type CreateClientResult = {
  client: Client;
  similar_clients: SimilarClientMatch[];
  relationship_owner: { id: string; name: string } | null;
};

/** Studio New client — pending until manually approved; default tier = Standard. */
export async function createClient(
  input: CreateClientInput,
  actor: { memberId: string },
): Promise<CreateClientResult> {
  if (!input.email && !input.phone) {
    throw new AppError({
      userMessage: clientMessages.error.contactRequired,
      code: "clients.contact_required",
      status: 400,
    });
  }

  const relationshipOwnerId =
    input.relationship_owner_id === undefined
      ? actor.memberId
      : input.relationship_owner_id;

  const tierId = await resolveClientTierId({
    tier_id: input.tier_id,
    tier_slug: input.tier_slug,
  });

  const profileCompleteness = computeProfileCompletenessFromClient({
    display_name: input.display_name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    nationality: input.nationality ?? null,
    city_of_residence: input.city_of_residence ?? null,
    important_dates: input.important_dates ?? [],
    guest_notes: input.guest_notes ?? null,
    relationship_owner_id: relationshipOwnerId,
  });

  const { tier_slug, ...insertFields } = input;
  void tier_slug;

  const client = await insertClient({
    ...insertFields,
    tier_id: tierId,
    relationship_owner_id: relationshipOwnerId,
    source: "studio",
    review_status: "pending",
    reviewed_by_id: null,
    reviewed_at: null,
    profile_completeness: profileCompleteness,
    created_by_id: actor.memberId,
    updated_by_id: actor.memberId,
  });

  await insertClientAuditLogs([
    {
      client_id: client.id,
      action: "created",
      team_member_id: actor.memberId,
      metadata: { source: "studio" },
    },
  ]);

  const [similarClients, owner] = await Promise.all([
    findSimilarClients({
      searchName: client.display_name,
      excludeClientId: client.id,
      limit: 5,
    }),
    relationshipOwnerId
      ? findTeamMemberById(relationshipOwnerId)
      : Promise.resolve(null),
  ]);

  return {
    client,
    similar_clients: similarClients,
    relationship_owner: owner
      ? { id: owner.id, name: owner.name }
      : null,
  };
}
