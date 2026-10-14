import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  ClientAuditAction,
  ClientAuditLog,
  SimilarClientMatch,
} from "../../schema";

/** Append audit rows. Never store health field values here. */
export async function insertClientAuditLogs(
  entries: Array<{
    client_id: string;
    action: ClientAuditAction;
    field_name?: string | null;
    old_value?: string | null;
    new_value?: string | null;
    team_member_id: string | null;
    metadata?: Record<string, unknown>;
  }>,
): Promise<void> {
  if (entries.length === 0) return;

  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase.from("client_audit_log").insert(
      entries.map((entry) => ({
        client_id: entry.client_id,
        action: entry.action,
        field_name: entry.field_name ?? null,
        old_value: entry.old_value ?? null,
        new_value: entry.new_value ?? null,
        team_member_id: entry.team_member_id,
        metadata: entry.metadata ?? {},
      })),
    ),
  );

  if (error) {
    throw dbQueryError(error);
  }
}

/** Recent audit rows for a client profile. */
export async function listClientAuditLogs(
  clientId: string,
  limit = 5,
): Promise<ClientAuditLog[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_audit_log")
      .select(
        "id, client_id, action, field_name, old_value, new_value, team_member_id, metadata, created_at",
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(limit),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as ClientAuditLog[];
}

/** Similar display names (pg_trgm) for create / merge UX. */
export async function findSimilarClients(input: {
  searchName: string;
  excludeClientId?: string | null;
  threshold?: number;
  limit?: number;
}): Promise<SimilarClientMatch[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase.rpc("find_similar_clients", {
      search_name: input.searchName,
      similarity_threshold: input.threshold ?? 0.3,
      exclude_client_id: input.excludeClientId ?? null,
      result_limit: input.limit ?? 5,
    }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as SimilarClientMatch[];
}
