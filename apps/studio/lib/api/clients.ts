import type { Client } from "@pureluxe/db";
import {
  clientMessages,
  type CreateClientBody,
  type CreateClientDocumentBody,
  type CreateClientPreferenceBody,
  type CreateClientRelationshipBody,
  type ListClientsQuery,
  type SearchClientsQuery,
  type UpdateClientBody,
  type UpdateClientDocumentBody,
  type UpdateClientFamilyBody,
  type UpdateClientPreferenceBody,
  type UpsertClientFamilyBody,
  type UpsertClientHealthBody,
} from "@pureluxe/shared";

import type {
  ClientDirectoryFilters,
  ClientProfile,
} from "@/lib/clients";
import { apiRoutes } from "@/lib/routes";

import { fetchApi } from "./client";

export type ClientTierSummary = {
  id: string;
  slug: string;
  label: string;
  rank: number;
};

export type ClientDirectoryItem = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  preferred_contact_method: string | null;
  tier_id: string;
  tier: ClientTierSummary;
  review_status: string;
  client_since: string | null;
  profile_completeness: number;
  relationship_owner_id: string | null;
  family_name: string | null;
  family_role: string | null;
  created_at: string;
  updated_at: string;
  stats: {
    total_spend_usd: number;
    booking_count: number;
    last_booking_date: string | null;
  };
};

export type ClientDirectoryData = {
  clients: ClientDirectoryItem[];
  total: number;
  limit: number;
  offset: number;
};

export type ClientSearchHit = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  tier_id: string;
  tier: ClientTierSummary;
  review_status: string;
  /** Present when the client already belongs to a household. */
  family_id?: string | null;
};

export type FamilySearchHit = {
  family_id: string;
  family_name: string;
  member_count: number;
};

function toQueryString(
  params:
    | Partial<ListClientsQuery>
    | Partial<SearchClientsQuery>
    | { q: string },
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(","));
      continue;
    }
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Load the Clients directory. */
export function listClients(params: Partial<ListClientsQuery> = {}) {
  return fetchApi<ClientDirectoryData>(
    `${apiRoutes.clients.root}${toQueryString(params)}`,
    { cache: "no-store" },
  );
}

/** Filter catalog for the directory Filters panel. */
export function getClientDirectoryFilters() {
  return fetchApi<ClientDirectoryFilters>(apiRoutes.clients.filters, {
    cache: "no-store",
  });
}

/** Autocomplete search (max 10). */
export function searchClients(params: SearchClientsQuery) {
  return fetchApi<{ clients: ClientSearchHit[] }>(
    `${apiRoutes.clients.search}${toQueryString(params)}`,
    { cache: "no-store" },
  );
}

/** Search households by name (max 10). */
export function searchFamilies(params: { q: string }) {
  return fetchApi<{ families: FamilySearchHit[] }>(
    `${apiRoutes.families.search}${toQueryString(params)}`,
    { cache: "no-store" },
  );
}

/** Load a Studio client profile. */
export function getClientProfile(clientId: string) {
  return fetchApi<ClientProfile>(apiRoutes.clients.byId(clientId), {
    cache: "no-store",
  });
}

/** Create a client (Studio — pending until approved). */
export function createClient(input: CreateClientBody) {
  return fetchApi<{
    client: Client;
    similar_clients: Array<{
      client_id: string;
      display_name: string;
      similarity: number;
    }>;
    relationship_owner: { id: string; name: string } | null;
  }>(apiRoutes.clients.root, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/** Approve a pending client; returns full profile. */
export function approveClient(clientId: string) {
  return fetchApi<ClientProfile>(apiRoutes.clients.approve(clientId), {
    method: "POST",
    cache: "no-store",
  });
}

/** Update a client profile. */
export function updateClient(
  clientId: string,
  input: UpdateClientBody,
  options?: { ifUnmodifiedSince?: string },
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.ifUnmodifiedSince) {
    headers["If-Unmodified-Since"] = options.ifUnmodifiedSince;
  }

  return fetchApi<ClientProfile>(apiRoutes.clients.byId(clientId), {
    method: "PATCH",
    headers,
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Soft-deactivate a client. */
export function deactivateClient(clientId: string) {
  return fetchApi<{ id: string; active: boolean }>(
    apiRoutes.clients.byId(clientId),
    { method: "DELETE" },
  );
}

/** Upsert health profile; returns full client profile. */
export function upsertClientHealth(
  clientId: string,
  input: UpsertClientHealthBody,
) {
  return fetchApi<ClientProfile>(apiRoutes.clients.health(clientId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Add a preference; returns full client profile. */
export function createClientPreference(
  clientId: string,
  input: CreateClientPreferenceBody,
) {
  return fetchApi<ClientProfile>(apiRoutes.clients.preferences(clientId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Update / confirm / deactivate a preference; returns full profile. */
export function updateClientPreference(
  clientId: string,
  preferenceId: string,
  input: UpdateClientPreferenceBody,
) {
  return fetchApi<ClientProfile>(
    apiRoutes.clients.preference(clientId, preferenceId),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );
}

/** Create, join, or add a household member; returns full profile. */
export function upsertClientFamily(
  clientId: string,
  input: UpsertClientFamilyBody,
) {
  return fetchApi<ClientProfile>(apiRoutes.clients.family(clientId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Update household name / role / primary; returns full profile. */
export function updateClientFamily(
  clientId: string,
  input: UpdateClientFamilyBody,
) {
  return fetchApi<ClientProfile>(apiRoutes.clients.family(clientId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Leave household; returns full profile. */
export function leaveClientFamily(clientId: string) {
  return fetchApi<ClientProfile>(apiRoutes.clients.family(clientId), {
    method: "DELETE",
    cache: "no-store",
  });
}

/** Remove another member from this client's household; returns full profile. */
export function removeClientFamilyMember(
  clientId: string,
  memberClientId: string,
) {
  return fetchApi<ClientProfile>(apiRoutes.clients.family(clientId), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member_client_id: memberClientId }),
    cache: "no-store",
  });
}

/** Link a related person; returns full profile. */
export function createClientRelationship(
  clientId: string,
  input: CreateClientRelationshipBody,
) {
  return fetchApi<ClientProfile>(apiRoutes.clients.relationships(clientId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Remove a related-person link; returns full profile. */
export function deleteClientRelationship(
  clientId: string,
  relationshipId: string,
) {
  return fetchApi<ClientProfile>(
    apiRoutes.clients.relationship(clientId, relationshipId),
    {
      method: "DELETE",
      cache: "no-store",
    },
  );
}

export type CreateClientDocumentResponse = {
  document: {
    id: string;
    document_type: string;
    file_path: string | null;
    file_name: string | null;
  };
  upload: {
    path: string;
    signedUrl: string;
    token: string;
  };
};

/** Register a document upload; returns signed URL (confirm after file PUT). */
export function createClientDocument(
  clientId: string,
  input: CreateClientDocumentBody,
) {
  return fetchApi<CreateClientDocumentResponse>(
    apiRoutes.clients.documents(clientId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );
}

/** Confirm file landed in storage — pending_upload → pending_review + profile. */
export function confirmClientDocumentUpload(
  clientId: string,
  documentId: string,
) {
  return fetchApi<ClientProfile>(
    apiRoutes.clients.documentConfirm(clientId, documentId),
    {
      method: "POST",
      cache: "no-store",
    },
  );
}

/** Upload a file to a signed Supabase Storage URL. */
export async function uploadClientDocumentFile(
  signedUrl: string,
  file: File,
): Promise<void> {
  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(clientMessages.error.documentTransferFailed);
  }
}

/** Update / verify / reject a document; returns full profile. */
export function updateClientDocument(
  clientId: string,
  documentId: string,
  input: UpdateClientDocumentBody,
) {
  return fetchApi<ClientProfile>(
    apiRoutes.clients.document(clientId, documentId),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );
}

/** Delete a document; returns full profile. */
export function deleteClientDocument(clientId: string, documentId: string) {
  return fetchApi<ClientProfile>(
    apiRoutes.clients.document(clientId, documentId),
    {
      method: "DELETE",
      cache: "no-store",
    },
  );
}

/** Get a short-lived signed URL to view/download the file. */
export function getClientDocumentFileUrl(
  clientId: string,
  documentId: string,
) {
  return fetchApi<{
    url: string;
    fileName: string | null;
    mimeType: string | null;
  }>(apiRoutes.clients.documentUrl(clientId, documentId), {
    cache: "no-store",
  });
}
