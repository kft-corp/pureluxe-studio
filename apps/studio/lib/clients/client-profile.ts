import {
  findClientDisplayNamesByIds,
  findClientFamily,
  findClientHealth,
  findClientTierById,
  findTeamMemberById,
  listClientAuditLogs,
  listClientDocuments,
  listClientMergeCandidates,
  listClientPreferences,
  listClientRelationships,
  type Client,
  type ClientDocument,
  type ClientHealthProfile,
  type ClientPreference,
  type ClientTierSummary,
} from "@pureluxe/db";

import { PROFILE_LIST_LIMITS } from "./client-limits";
import { requireActiveClient } from "./require-active-client";

export type ClientProfile = {
  client: Client & {
    tier: ClientTierSummary;
    relationship_owner: { id: string; name: string } | null;
    stats: {
      total_spend_usd: number;
      booking_count: number;
      last_booking_date: string | null;
      open_trip_count: number;
    };
    family: {
      id: string;
      name: string;
      role: string;
      is_primary: boolean;
      members: Array<{
        client_id: string;
        display_name: string;
        role: string;
        is_primary: boolean;
      }>;
      total_spend_usd: number;
    } | null;
    preferences: ClientPreference[];
    health_profile: ClientHealthProfile | null;
    documents: ClientDocument[];
    relationships: Array<
      Awaited<ReturnType<typeof listClientRelationships>>[number] & {
        related_client_id: string;
        related_display_name: string | null;
      }
    >;
    merge_candidates: Array<{
      client_id: string;
      display_name: string | null;
      similarity: number;
      match_reason: string;
    }>;
    recent_audit: Awaited<ReturnType<typeof listClientAuditLogs>>;
  };
  bookings: [];
  trips: [];
};

/** Full Studio profile — nested lists are capped; bookings/trips empty until those modules ship. */
export async function getClientProfile(
  clientId: string,
): Promise<ClientProfile> {
  const client = await requireActiveClient(clientId);

  const [
    owner,
    tierRow,
    family,
    preferences,
    healthProfile,
    documents,
    relationships,
    mergeCandidates,
    recentAudit,
  ] = await Promise.all([
    client.relationship_owner_id
      ? findTeamMemberById(client.relationship_owner_id)
      : Promise.resolve(null),
    findClientTierById(client.tier_id),
    findClientFamily(clientId),
    listClientPreferences(clientId, {
      limit: PROFILE_LIST_LIMITS.preferences,
    }),
    findClientHealth(clientId),
    listClientDocuments(clientId, {
      limit: PROFILE_LIST_LIMITS.documents,
    }),
    listClientRelationships(clientId, {
      limit: PROFILE_LIST_LIMITS.relationships,
    }),
    listClientMergeCandidates(clientId, {
      limit: PROFILE_LIST_LIMITS.mergeCandidates,
    }),
    listClientAuditLogs(clientId, PROFILE_LIST_LIMITS.audit),
  ]);

  const tier: ClientTierSummary = tierRow
    ? {
        id: tierRow.id,
        slug: tierRow.slug,
        label: tierRow.label,
        rank: tierRow.rank,
      }
    : {
        id: client.tier_id,
        slug: "standard",
        label: "Standard",
        rank: 1,
      };

  const otherIds = mergeCandidates.map((row) =>
    row.client_id_a === clientId ? row.client_id_b : row.client_id_a,
  );

  const relatedIds = [
    ...new Set(
      relationships.map((rel) =>
        rel.from_client_id === clientId
          ? rel.to_client_id
          : rel.from_client_id,
      ),
    ),
  ];

  const lookupIds = [...new Set([...otherIds, ...relatedIds])];
  const nameById = await findClientDisplayNamesByIds(lookupIds);

  return {
    client: {
      ...client,
      tier,
      relationship_owner: owner
        ? { id: owner.id, name: owner.name }
        : null,
      stats: {
        total_spend_usd: 0,
        booking_count: 0,
        last_booking_date: null,
        open_trip_count: 0,
      },
      family: family
        ? {
            id: family.family_id,
            name: family.family_name,
            role: family.role,
            is_primary: family.is_primary,
            members: family.members,
            total_spend_usd: 0,
          }
        : null,
      preferences,
      health_profile: healthProfile,
      documents,
      relationships: relationships.map((rel) => {
        const relatedId =
          rel.from_client_id === clientId
            ? rel.to_client_id
            : rel.from_client_id;
        return {
          ...rel,
          related_client_id: relatedId,
          related_display_name: nameById.get(relatedId) ?? null,
        };
      }),
      merge_candidates: mergeCandidates.map((row, index) => {
        const otherId = otherIds[index]!;
        return {
          client_id: otherId,
          display_name: nameById.get(otherId) ?? null,
          similarity: Number(row.similarity),
          match_reason: row.match_reason,
        };
      }),
      recent_audit: recentAudit,
    },
    bookings: [],
    trips: [],
  };
}
