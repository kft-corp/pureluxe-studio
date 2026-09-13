import type {
  CreateClientInput,
  ListClientsQuery,
  UpdateClientInput,
} from "@pureluxe/shared";

import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { Client, ClientTierSummary } from "../../schema";
import { escapeIlike } from "../../utils/ilike";
import { findClientTierBySlug } from "./client-tiers";

const CLIENT_COLUMNS =
  "id, display_name, title, first_name, last_name, legal_name, email, phone, whatsapp, preferred_contact_method, preferred_language, timezone, nationality, city_of_residence, company, address_line_1, address_line_2, address_city, address_state, address_postal_code, address_country, relationship_owner_id, tier_id, client_since, referred_by_client_id, important_dates, guest_notes, internal_notes, source, review_status, reviewed_by_id, reviewed_at, profile_completeness, avatar_url, active, merged_into_client_id, deactivated_at, deactivated_by_id, created_by_id, updated_by_id, created_at, updated_at";

const TIER_EMBED = "client_tiers(id, slug, label, rank)";

const DIRECTORY_SELECT =
  `id, display_name, email, phone, preferred_contact_method, tier_id, review_status, client_since, profile_completeness, relationship_owner_id, created_at, updated_at, active, ${TIER_EMBED}, family_members(role, families(name))`;

const DIRECTORY_SELECT_HAS_FAMILY =
  `id, display_name, email, phone, preferred_contact_method, tier_id, review_status, client_since, profile_completeness, relationship_owner_id, created_at, updated_at, active, ${TIER_EMBED}, family_members!inner(role, families(name))`;

export type ClientDirectoryRow = Pick<
  Client,
  | "id"
  | "display_name"
  | "email"
  | "phone"
  | "preferred_contact_method"
  | "tier_id"
  | "review_status"
  | "client_since"
  | "profile_completeness"
  | "relationship_owner_id"
  | "created_at"
  | "updated_at"
  | "active"
> & {
  tier: ClientTierSummary;
  family_name: string | null;
  family_role: string | null;
};

export type ListClientsResult = {
  clients: ClientDirectoryRow[];
  total: number;
  limit: number;
  offset: number;
};

/** Create payload plus Studio lifecycle fields. */
export type InsertClientInput = CreateClientInput & {
  tier_id: string;
  source: Client["source"];
  review_status: Client["review_status"];
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  profile_completeness: number;
  created_by_id: string;
  updated_by_id: string;
  relationship_owner_id: string | null;
};

/** Patch payload plus id / actor. Completeness is optional (RPC may update it). */
export type UpdateClientRecord = UpdateClientInput & {
  id: string;
  profile_completeness?: number;
  updated_by_id: string;
};

function contactSearchFilter(q: string): string {
  const pattern = `%${escapeIlike(q)}%`.replaceAll('"', '\\"');
  return [
    `display_name.ilike."${pattern}"`,
    `email.ilike."${pattern}"`,
    `phone.ilike."${pattern}"`,
  ].join(",");
}

function parseTierEmbed(value: unknown): ClientTierSummary {
  const row = Array.isArray(value) ? value[0] : value;
  const tier = row as ClientTierSummary | null | undefined;
  if (!tier?.id || !tier.slug) {
    return {
      id: "",
      slug: "standard",
      label: "Standard",
      rank: 1,
    };
  }
  return {
    id: tier.id,
    slug: tier.slug,
    label: tier.label,
    rank: Number(tier.rank ?? 1),
  };
}

function toDirectoryRow(row: Record<string, unknown>): ClientDirectoryRow {
  const memberships = row.family_members as
    | Array<{
        role: string;
        families: { name: string } | { name: string }[] | null;
      }>
    | null
    | undefined;

  const membership = Array.isArray(memberships) ? memberships[0] : null;
  const family = membership?.families;
  const familyName = Array.isArray(family)
    ? (family[0]?.name ?? null)
    : (family?.name ?? null);

  const tier = parseTierEmbed(row.client_tiers);

  return {
    id: row.id as string,
    display_name: row.display_name as string,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    preferred_contact_method:
      (row.preferred_contact_method as Client["preferred_contact_method"]) ??
      null,
    tier_id: (row.tier_id as string) || tier.id,
    tier,
    review_status: row.review_status as Client["review_status"],
    client_since: (row.client_since as string | null) ?? null,
    profile_completeness: Number(row.profile_completeness ?? 0),
    relationship_owner_id: (row.relationship_owner_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    active: Boolean(row.active),
    family_name: familyName,
    family_role: membership?.role ?? null,
  };
}

/** One client by id, or null. */
export async function findClientById(clientId: string): Promise<Client | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("clients")
      .select(CLIENT_COLUMNS)
      .eq("id", clientId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data as unknown as Client | null) ?? null;
}

/** Lightweight id → display_name map for profile embeds (one query). */
export async function findClientDisplayNamesByIds(
  clientIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(clientIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase.from("clients").select("id, display_name").in("id", uniqueIds),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return new Map(
    ((data as Array<{ id: string; display_name: string }> | null) ?? []).map(
      (row) => [row.id, row.display_name],
    ),
  );
}

/** Active client ids whose display_name matches (directory search). */
export async function findClientIdsByDisplayName(
  q: string,
  limit = 50,
): Promise<string[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];

  const pattern = `%${escapeIlike(trimmed)}%`;
  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("clients")
      .select("id")
      .eq("active", true)
      .eq("is_demo", false)
      .ilike("display_name", pattern)
      .limit(limit),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return ((data as Array<{ id: string }> | null) ?? []).map((row) => row.id);
}

/** Directory list — search, chips + advanced filters, sort, paginate. */
export async function listClients(
  query: ListClientsQuery & { actorMemberId?: string | null },
): Promise<ListClientsResult> {
  const supabase = getServiceClient();
  const {
    q,
    filters,
    tier,
    review_status,
    has_family,
    missing_contact,
    owner,
    sources,
    completeness,
    created_from,
    created_to,
    sort,
    limit,
    offset,
    actorMemberId,
  } = query;

  // Bookings not shipped yet — spend / last-booking sorts use created_at.
  const orderColumn =
    sort === "name_desc" || sort === "name_asc"
      ? "display_name"
      : "created_at";
  const ascending = sort === "name_asc";

  const select =
    has_family || filters.includes("has_family")
      ? DIRECTORY_SELECT_HAS_FAMILY
      : DIRECTORY_SELECT;

  let tierIdFilter: string | null = null;
  if (tier !== "any") {
    const matched = await findClientTierBySlug(tier);
    tierIdFilter = matched?.id ?? "00000000-0000-0000-0000-000000000000";
  }

  const { data, error, count } = await runSupabaseQuery(() => {
    let request = supabase
      .from("clients")
      .select(select, { count: "estimated" })
      .eq("active", true);

    if (q) {
      request = request.or(contactSearchFilter(q));
    }

    if (tierIdFilter) {
      request = request.eq("tier_id", tierIdFilter);
    }

    if (review_status !== "any") {
      request = request.eq("review_status", review_status);
    }

    if (missing_contact || filters.includes("missing_contact")) {
      request = request.is("email", null).is("phone", null);
    }

    if (sources.length > 0) {
      request = request.in("source", sources);
    }

    if (completeness === "under_25") {
      request = request.lt("profile_completeness", 25);
    } else if (completeness === "under_50") {
      request = request.lt("profile_completeness", 50);
    } else if (completeness === "under_75") {
      request = request.lt("profile_completeness", 75);
    } else if (completeness === "complete") {
      request = request.eq("profile_completeness", 100);
    }

    if (created_from) {
      request = request.gte("created_at", `${created_from}T00:00:00.000Z`);
    }
    if (created_to) {
      request = request.lte("created_at", `${created_to}T23:59:59.999Z`);
    }

    // Owner: panel wins over Me chip when panel is not "any".
    const wantsMine = filters.includes("mine");
    if (owner === "unassigned") {
      request = request.is("relationship_owner_id", null);
    } else if (owner === "me" || (owner === "any" && wantsMine)) {
      if (actorMemberId) {
        request = request.eq("relationship_owner_id", actorMemberId);
      }
    } else if (owner !== "any") {
      request = request.eq("relationship_owner_id", owner);
    }

    return request
      .order(orderColumn, { ascending })
      .range(offset, offset + limit - 1);
  });

  if (error) {
    throw dbQueryError(error);
  }

  const clients = (
    (data as unknown as Record<string, unknown>[] | null) ?? []
  ).map(toDirectoryRow);

  return {
    clients,
    total: count ?? clients.length,
    limit,
    offset,
  };
}

/** Autocomplete — max 10 for Trip Builder / mid-call. */
export async function searchClients(input: {
  q: string;
  limit: number;
}): Promise<
  Array<
    Pick<
      Client,
      "id" | "display_name" | "email" | "phone" | "tier_id" | "review_status"
    > & { tier: ClientTierSummary; family_id: string | null }
  >
> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("clients")
      .select(
        `id, display_name, email, phone, tier_id, review_status, ${TIER_EMBED}, family_members(family_id)`,
      )
      .eq("active", true)
      .or(contactSearchFilter(input.q))
      .order("display_name", { ascending: true })
      .limit(input.limit),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return ((data as Record<string, unknown>[] | null) ?? []).map((row) => {
    const tier = parseTierEmbed(row.client_tiers);
    const memberships = row.family_members as
      | Array<{ family_id: string }>
      | null
      | undefined;
    const familyId = memberships?.[0]?.family_id ?? null;
    return {
      id: row.id as string,
      display_name: row.display_name as string,
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      tier_id: (row.tier_id as string) || tier.id,
      tier,
      review_status: row.review_status as Client["review_status"],
      family_id: familyId,
    };
  });
}

/** Insert a client row. */
export async function insertClient(input: InsertClientInput): Promise<Client> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("clients")
      .insert({
        display_name: input.display_name,
        title: input.title ?? null,
        first_name: input.first_name ?? null,
        last_name: input.last_name ?? null,
        legal_name: input.legal_name ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        whatsapp: input.whatsapp ?? null,
        preferred_contact_method: input.preferred_contact_method ?? null,
        preferred_language: input.preferred_language ?? null,
        timezone: input.timezone ?? null,
        nationality: input.nationality ?? null,
        city_of_residence: input.city_of_residence ?? null,
        company: input.company ?? null,
        address_line_1: input.address_line_1 ?? null,
        address_line_2: input.address_line_2 ?? null,
        address_city: input.address_city ?? null,
        address_state: input.address_state ?? null,
        address_postal_code: input.address_postal_code ?? null,
        address_country: input.address_country ?? null,
        relationship_owner_id: input.relationship_owner_id,
        tier_id: input.tier_id,
        client_since: input.client_since ?? null,
        referred_by_client_id: input.referred_by_client_id ?? null,
        important_dates: input.important_dates ?? [],
        guest_notes: input.guest_notes ?? null,
        internal_notes: input.internal_notes ?? null,
        source: input.source,
        review_status: input.review_status,
        reviewed_by_id: input.reviewed_by_id,
        reviewed_at: input.reviewed_at,
        profile_completeness: input.profile_completeness,
        avatar_url: input.avatar_url ?? null,
        created_by_id: input.created_by_id,
        updated_by_id: input.updated_by_id,
      })
      .select(CLIENT_COLUMNS)
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as unknown as Client;
}

/** Update active client fields. */
export async function updateClient(
  input: UpdateClientRecord,
): Promise<Client> {
  const supabase = getServiceClient();
  const { id, updated_by_id, profile_completeness, ...patch } = input;
  const { tier_slug: _ignored, ...safePatch } = patch as UpdateClientInput & {
    tier_slug?: string;
  };

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("clients")
      .update({
        ...safePatch,
        ...(profile_completeness !== undefined
          ? { profile_completeness }
          : {}),
        updated_by_id,
      })
      .eq("id", id)
      .eq("active", true)
      .select(CLIENT_COLUMNS)
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as unknown as Client;
}

/** Soft-deactivate a client. */
export async function deactivateClient(input: {
  id: string;
  deactivatedById: string;
}): Promise<Client> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("clients")
      .update({
        active: false,
        deactivated_at: now,
        deactivated_by_id: input.deactivatedById,
        updated_by_id: input.deactivatedById,
      })
      .eq("id", input.id)
      .eq("active", true)
      .select(CLIENT_COLUMNS)
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as unknown as Client;
}

/** Mark a pending client as approved. */
export async function approveClientRecord(input: {
  id: string;
  reviewedById: string;
}): Promise<Client> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("clients")
      .update({
        review_status: "approved",
        reviewed_by_id: input.reviewedById,
        reviewed_at: now,
        updated_by_id: input.reviewedById,
      })
      .eq("id", input.id)
      .eq("active", true)
      .eq("review_status", "pending")
      .select(CLIENT_COLUMNS)
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as unknown as Client;
}
