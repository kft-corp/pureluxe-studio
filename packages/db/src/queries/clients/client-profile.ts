import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  ClientDocument,
  ClientHealthProfile,
  ClientMergeCandidate,
  ClientPreference,
  ClientRelationship,
  FamilyMembership,
  GuestUser,
} from "../../schema";

/** Active preferences for a client. */
export async function listClientPreferences(
  clientId: string,
  options?: { limit?: number },
): Promise<ClientPreference[]> {
  const supabase = getServiceClient();
  const limit = options?.limit ?? 100;

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_preferences")
      .select("*")
      .eq("client_id", clientId)
      .eq("active", true)
      .order("category", { ascending: true })
      .order("label", { ascending: true })
      .limit(limit),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as ClientPreference[];
}

/** One preference by id, or null. */
export async function findClientPreferenceById(
  preferenceId: string,
): Promise<ClientPreference | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_preferences")
      .select("*")
      .eq("id", preferenceId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data as ClientPreference | null) ?? null;
}

export type InsertClientPreferenceInput = {
  category: string;
  label: string;
  sentiment: ClientPreference["sentiment"];
  source: ClientPreference["source"];
  is_confirmed: boolean;
  notes: string | null;
  created_by_id: string | null;
};

/** Insert a preference row. */
export async function insertClientPreference(
  clientId: string,
  input: InsertClientPreferenceInput,
): Promise<ClientPreference> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_preferences")
      .insert({
        client_id: clientId,
        category: input.category,
        label: input.label,
        sentiment: input.sentiment,
        source: input.source,
        is_confirmed: input.is_confirmed,
        notes: input.notes,
        created_by_id: input.created_by_id,
        active: true,
      })
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as ClientPreference;
}

export type UpdateClientPreferenceRecord = {
  category?: string;
  label?: string;
  sentiment?: ClientPreference["sentiment"];
  notes?: string | null;
  is_confirmed?: boolean;
  active?: boolean;
  confirmed_by_id?: string | null;
  confirmed_at?: string | null;
};

/** Update preference fields. */
export async function updateClientPreference(
  preferenceId: string,
  patch: UpdateClientPreferenceRecord,
): Promise<ClientPreference> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_preferences")
      .update({
        ...patch,
        updated_at: now,
      })
      .eq("id", preferenceId)
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as ClientPreference;
}

/** Health profile for a client, or null. */
export async function findClientHealth(
  clientId: string,
): Promise<ClientHealthProfile | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_health_profiles")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data as ClientHealthProfile | null) ?? null;
}

export type UpsertClientHealthInput = {
  dietary_restrictions: string[];
  mobility_notes: string | null;
  medication_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  share_with_hotels: boolean;
  notes: string | null;
  updated_by_id: string;
};

/** Insert or update the 1:1 health profile. */
export async function upsertClientHealth(
  clientId: string,
  input: UpsertClientHealthInput,
): Promise<ClientHealthProfile> {
  const supabase = getServiceClient();
  const existing = await findClientHealth(clientId);
  const now = new Date().toISOString();

  if (existing) {
    const { data, error } = await runSupabaseQuery(() =>
      supabase
        .from("client_health_profiles")
        .update({
          dietary_restrictions: input.dietary_restrictions,
          mobility_notes: input.mobility_notes,
          medication_notes: input.medication_notes,
          emergency_contact_name: input.emergency_contact_name,
          emergency_contact_phone: input.emergency_contact_phone,
          share_with_hotels: input.share_with_hotels,
          notes: input.notes,
          updated_by_id: input.updated_by_id,
          updated_at: now,
        })
        .eq("client_id", clientId)
        .select("*")
        .single(),
    );

    if (error) {
      throw dbQueryError(error);
    }

    return data as ClientHealthProfile;
  }

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_health_profiles")
      .insert({
        client_id: clientId,
        dietary_restrictions: input.dietary_restrictions,
        mobility_notes: input.mobility_notes,
        medication_notes: input.medication_notes,
        emergency_contact_name: input.emergency_contact_name,
        emergency_contact_phone: input.emergency_contact_phone,
        share_with_hotels: input.share_with_hotels,
        notes: input.notes,
        updated_by_id: input.updated_by_id,
      })
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as ClientHealthProfile;
}

/** Documents for a client (newest first). Excludes abandoned pending uploads. */
export async function listClientDocuments(
  clientId: string,
  options?: { limit?: number; includePendingUpload?: boolean },
): Promise<ClientDocument[]> {
  const supabase = getServiceClient();
  const limit = options?.limit ?? 50;

  const { data, error } = await runSupabaseQuery(() => {
    let request = supabase
      .from("client_documents")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!options?.includePendingUpload) {
      request = request.neq("status", "pending_upload");
    }

    return request;
  });

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as ClientDocument[];
}

/** One document by id, or null. */
export async function findClientDocumentById(
  documentId: string,
): Promise<ClientDocument | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data as ClientDocument | null) ?? null;
}

export type InsertClientDocumentInput = {
  id?: string;
  document_type: ClientDocument["document_type"];
  document_number: string | null;
  issuing_country: string | null;
  expiry_date: string | null;
  date_of_birth: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_by_id: string | null;
  status?: ClientDocument["status"];
  metadata?: Record<string, unknown>;
};

/** Insert a travel document row (usually pending_upload until the file lands). */
export async function insertClientDocument(
  clientId: string,
  input: InsertClientDocumentInput,
): Promise<ClientDocument> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_documents")
      .insert({
        ...(input.id ? { id: input.id } : {}),
        client_id: clientId,
        document_type: input.document_type,
        document_number: input.document_number,
        issuing_country: input.issuing_country,
        expiry_date: input.expiry_date,
        date_of_birth: input.date_of_birth,
        file_path: input.file_path,
        file_name: input.file_name,
        mime_type: input.mime_type,
        file_size_bytes: input.file_size_bytes,
        status: input.status ?? "pending_upload",
        uploaded_by_id: input.uploaded_by_id,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as ClientDocument;
}

export type UpdateClientDocumentRecord = {
  document_type?: ClientDocument["document_type"];
  document_number?: string | null;
  issuing_country?: string | null;
  expiry_date?: string | null;
  date_of_birth?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  status?: ClientDocument["status"];
  verified_at?: string | null;
  verified_by_id?: string | null;
  metadata?: Record<string, unknown>;
};

/** Update document metadata or verification fields. */
export async function updateClientDocument(
  documentId: string,
  patch: UpdateClientDocumentRecord,
): Promise<ClientDocument> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_documents")
      .update({
        ...patch,
        updated_at: now,
      })
      .eq("id", documentId)
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as ClientDocument;
}

/** Hard-delete a document row. */
export async function deleteClientDocument(
  documentId: string,
): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase.from("client_documents").delete().eq("id", documentId),
  );

  if (error) {
    throw dbQueryError(error);
  }
}

/** Non-household relationships for a client. */
export async function listClientRelationships(
  clientId: string,
  options?: { limit?: number },
): Promise<ClientRelationship[]> {
  const supabase = getServiceClient();
  const limit = options?.limit ?? 50;

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_relationships")
      .select("*")
      .or(`from_client_id.eq.${clientId},to_client_id.eq.${clientId}`)
      .order("created_at", { ascending: false })
      .limit(limit),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as ClientRelationship[];
}

/** One relationship by id, or null. */
export async function findClientRelationshipById(
  relationshipId: string,
): Promise<ClientRelationship | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_relationships")
      .select("*")
      .eq("id", relationshipId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data as ClientRelationship | null) ?? null;
}

export type InsertClientRelationshipInput = {
  from_client_id: string;
  to_client_id: string;
  relationship_type: ClientRelationship["relationship_type"];
  notes: string | null;
  created_by_id: string | null;
};

/** Insert a non-household relationship. */
export async function insertClientRelationship(
  input: InsertClientRelationshipInput,
): Promise<ClientRelationship> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_relationships")
      .insert({
        from_client_id: input.from_client_id,
        to_client_id: input.to_client_id,
        relationship_type: input.relationship_type,
        notes: input.notes,
        created_by_id: input.created_by_id,
      })
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as ClientRelationship;
}

/** Delete a relationship row. */
export async function deleteClientRelationship(
  relationshipId: string,
): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase.from("client_relationships").delete().eq("id", relationshipId),
  );

  if (error) {
    throw dbQueryError(error);
  }
}

/** Open merge suggestions for a client. */
export async function listClientMergeCandidates(
  clientId: string,
  options?: { limit?: number },
): Promise<ClientMergeCandidate[]> {
  const supabase = getServiceClient();
  const limit = options?.limit ?? 10;

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_merge_candidates")
      .select("*")
      .eq("status", "open")
      .or(`client_id_a.eq.${clientId},client_id_b.eq.${clientId}`)
      .order("similarity", { ascending: false })
      .limit(limit),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as ClientMergeCandidate[];
}

/** Guest App access rows for a client. */
export async function listClientGuests(
  clientId: string,
): Promise<GuestUser[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("guest_users")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as GuestUser[];
}

/** Household membership + member list, or null. */
export async function findClientFamily(
  clientId: string,
): Promise<FamilyMembership | null> {
  const supabase = getServiceClient();

  const { data: membership, error: membershipError } = await runSupabaseQuery(
    () =>
      supabase
        .from("family_members")
        .select("family_id, role, is_primary, families(name)")
        .eq("client_id", clientId)
        .maybeSingle(),
  );

  if (membershipError) {
    throw dbQueryError(membershipError);
  }

  if (!membership) {
    return null;
  }

  const familyId = membership.family_id as string;
  const families = membership.families as
    | { name: string }
    | { name: string }[]
    | null;
  const familyName = Array.isArray(families)
    ? (families[0]?.name ?? "")
    : (families?.name ?? "");

  const { data: members, error: membersError } = await runSupabaseQuery(() =>
    supabase
      .from("family_members")
      .select("client_id, role, is_primary, clients(display_name)")
      .eq("family_id", familyId)
      .order("is_primary", { ascending: false }),
  );

  if (membersError) {
    throw dbQueryError(membersError);
  }

  return {
    family_id: familyId,
    family_name: familyName,
    role: membership.role as FamilyMembership["role"],
    is_primary: Boolean(membership.is_primary),
    members: ((members as Record<string, unknown>[] | null) ?? []).map(
      (row) => {
        const client = row.clients as
          | { display_name: string }
          | { display_name: string }[]
          | null;
        const displayName = Array.isArray(client)
          ? (client[0]?.display_name ?? "")
          : (client?.display_name ?? "");

        return {
          client_id: row.client_id as string,
          display_name: displayName,
          role: row.role as FamilyMembership["role"],
          is_primary: Boolean(row.is_primary),
        };
      },
    ),
  };
}

export type FamilySearchHit = {
  family_id: string;
  family_name: string;
  member_count: number;
};

/** Search households by name (max 10). */
export async function searchFamilies(
  query: string,
): Promise<FamilySearchHit[]> {
  const supabase = getServiceClient();
  const trimmed = query.trim();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("families")
      .select("id, name, family_members(count)")
      .ilike("name", `%${trimmed}%`)
      .order("name", { ascending: true })
      .limit(10),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return ((data as Record<string, unknown>[] | null) ?? []).map((row) => {
    const members = row.family_members as
      | Array<{ count: number }>
      | { count: number }
      | null;
    const count = Array.isArray(members)
      ? Number(members[0]?.count ?? 0)
      : Number(members?.count ?? 0);

    return {
      family_id: row.id as string,
      family_name: row.name as string,
      member_count: count,
    };
  });
}

/** Create a household row. */
export async function insertFamily(input: {
  name: string;
  created_by_id: string | null;
}): Promise<{ id: string; name: string }> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("families")
      .insert({
        name: input.name,
        created_by_id: input.created_by_id,
      })
      .select("id, name")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as { id: string; name: string };
}

/** Rename a household. */
export async function updateFamilyName(
  familyId: string,
  name: string,
): Promise<void> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { error } = await runSupabaseQuery(() =>
    supabase
      .from("families")
      .update({ name, updated_at: now })
      .eq("id", familyId),
  );

  if (error) {
    throw dbQueryError(error);
  }
}

/** Delete an empty household. */
export async function deleteFamily(familyId: string): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase.from("families").delete().eq("id", familyId),
  );

  if (error) {
    throw dbQueryError(error);
  }
}

export type InsertFamilyMemberInput = {
  family_id: string;
  client_id: string;
  role: FamilyMembership["role"];
  is_primary: boolean;
};

/** Add a client to a household. */
export async function insertFamilyMember(
  input: InsertFamilyMemberInput,
): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase.from("family_members").insert({
      family_id: input.family_id,
      client_id: input.client_id,
      role: input.role,
      is_primary: input.is_primary,
    }),
  );

  if (error) {
    throw dbQueryError(error);
  }
}

/** Update a membership row. */
export async function updateFamilyMember(
  familyId: string,
  clientId: string,
  patch: { role?: FamilyMembership["role"]; is_primary?: boolean },
): Promise<void> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { error } = await runSupabaseQuery(() =>
    supabase
      .from("family_members")
      .update({
        ...patch,
        updated_at: now,
      })
      .eq("family_id", familyId)
      .eq("client_id", clientId),
  );

  if (error) {
    throw dbQueryError(error);
  }
}

/** Clear primary flag for everyone in a household. */
export async function clearFamilyPrimary(familyId: string): Promise<void> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { error } = await runSupabaseQuery(() =>
    supabase
      .from("family_members")
      .update({ is_primary: false, updated_at: now })
      .eq("family_id", familyId)
      .eq("is_primary", true),
  );

  if (error) {
    throw dbQueryError(error);
  }
}

/** Remove a client from a household. */
export async function deleteFamilyMember(
  familyId: string,
  clientId: string,
): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase
      .from("family_members")
      .delete()
      .eq("family_id", familyId)
      .eq("client_id", clientId),
  );

  if (error) {
    throw dbQueryError(error);
  }
}

/** Count members in a household. */
export async function countFamilyMembers(familyId: string): Promise<number> {
  const supabase = getServiceClient();

  const { count, error } = await runSupabaseQuery(() =>
    supabase
      .from("family_members")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return count ?? 0;
}

/** Related flags used for profile completeness scoring. */
export async function getClientProfileSignals(clientId: string): Promise<{
  hasPreference: boolean;
  hasVerifiedPassport: boolean;
  hasFamily: boolean;
  hasHealthBasics: boolean;
}> {
  const supabase = getServiceClient();

  const [prefs, docs, family, health] = await Promise.all([
    runSupabaseQuery(() =>
      supabase
        .from("client_preferences")
        .select("id")
        .eq("client_id", clientId)
        .eq("active", true)
        .limit(1),
    ),
    runSupabaseQuery(() =>
      supabase
        .from("client_documents")
        .select("id")
        .eq("client_id", clientId)
        .eq("document_type", "passport")
        .eq("status", "verified")
        .limit(1),
    ),
    runSupabaseQuery(() =>
      supabase
        .from("family_members")
        .select("id")
        .eq("client_id", clientId)
        .limit(1),
    ),
    runSupabaseQuery(() =>
      supabase
        .from("client_health_profiles")
        .select(
          "dietary_restrictions, emergency_contact_name, emergency_contact_phone",
        )
        .eq("client_id", clientId)
        .maybeSingle(),
    ),
  ]);

  for (const result of [prefs, docs, family, health]) {
    if (result.error) {
      throw dbQueryError(result.error);
    }
  }

  const healthRow = health.data as {
    dietary_restrictions?: string[] | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
  } | null;

  const hasDietary =
    Array.isArray(healthRow?.dietary_restrictions) &&
    healthRow.dietary_restrictions.length > 0;
  const hasEmergency = Boolean(
    healthRow?.emergency_contact_name || healthRow?.emergency_contact_phone,
  );

  return {
    hasPreference: (prefs.data?.length ?? 0) > 0,
    hasVerifiedPassport: (docs.data?.length ?? 0) > 0,
    hasFamily: (family.data?.length ?? 0) > 0,
    hasHealthBasics: hasDietary || hasEmergency,
  };
}

/**
 * Recompute and persist profile_completeness in one DB round-trip.
 * Returns the new score, or null if the client is missing/inactive.
 */
export async function refreshClientProfileCompletenessRpc(
  clientId: string,
  actorMemberId?: string | null,
): Promise<number | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase.rpc("refresh_client_profile_completeness", {
      p_client_id: clientId,
      p_actor_id: actorMemberId ?? null,
    }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  if (data === null || data === undefined) return null;
  return Number(data);
}
