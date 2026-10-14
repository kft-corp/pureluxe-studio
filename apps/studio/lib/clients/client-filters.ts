import { listClientDirectoryFilterValues } from "@pureluxe/db";
import type { ClientSourceFilter, ListClientsQuery } from "@pureluxe/shared";

import { getActiveClientTiers } from "./client-tiers";

export type ClientFilterOption = {
  value: string;
  label: string;
};

export type ClientFilterToggle = {
  id: "has_family" | "missing_contact";
  label: string;
};

/** Catalog for the Clients Filters dialog (DB-backed + static). */
export type ClientDirectoryFilters = {
  tiers: ClientFilterOption[];
  review_statuses: ClientFilterOption[];
  sources: ClientFilterOption[];
  /** Active team members excluding the signed-in owner (shown as `me_label`). */
  owners: Array<{ id: string; name: string }>;
  /** Relationship-owner shortcut, e.g. "Me (Vijay Jawalkar)". */
  me_label: string;
  completeness: ClientFilterOption[];
  toggles: ClientFilterToggle[];
  created_date_range: { enabled: true };
};

type CurrentOwner = {
  memberId: string;
  name: string;
};

function meOwnerLabel(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? `Me (${trimmed})` : "Me";
}

/** Applied advanced filters on the directory list. */
export type ClientAdvancedFilters = {
  tier: ListClientsQuery["tier"];
  review_status: ListClientsQuery["review_status"];
  has_family: boolean;
  missing_contact: boolean;
  owner: string;
  sources: ClientSourceFilter[];
  completeness: ListClientsQuery["completeness"];
  created_from: string;
  created_to: string;
};

const STATIC_REVIEW: ClientFilterOption[] = [
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending review" },
];

const STATIC_SOURCES: ClientFilterOption[] = [
  { value: "studio", label: "Studio" },
  { value: "trip_builder", label: "Trip Builder" },
  { value: "client_app", label: "Client App" },
  { value: "import", label: "Import" },
];

const STATIC_TOGGLES: ClientFilterToggle[] = [
  { id: "has_family", label: "Has family" },
  { id: "missing_contact", label: "Missing contact" },
];

const STATIC_COMPLETENESS: ClientFilterOption[] = [
  { value: "under_25", label: "Under 25%" },
  { value: "under_50", label: "Under 50%" },
  { value: "under_75", label: "Under 75%" },
  { value: "complete", label: "100%" },
];

/** Empty catalog used when filter load fails (keeps static labels). */
export const EMPTY_CLIENT_DIRECTORY_FILTERS: ClientDirectoryFilters = {
  tiers: [],
  review_statuses: STATIC_REVIEW,
  sources: STATIC_SOURCES,
  owners: [],
  me_label: "Me",
  completeness: STATIC_COMPLETENESS,
  toggles: STATIC_TOGGLES,
  created_date_range: { enabled: true },
};

export const EMPTY_ADVANCED_FILTERS: ClientAdvancedFilters = {
  tier: "any",
  review_status: "any",
  has_family: false,
  missing_contact: false,
  owner: "any",
  sources: [],
  completeness: "any",
  created_from: "",
  created_to: "",
};

export function countAdvancedFilters(filters: ClientAdvancedFilters): number {
  let count = 0;
  if (filters.tier !== "any") count += 1;
  if (filters.review_status !== "any") count += 1;
  if (filters.has_family) count += 1;
  if (filters.missing_contact) count += 1;
  if (filters.owner !== "any") count += 1;
  if (filters.sources.length > 0) count += 1;
  if (filters.completeness !== "any") count += 1;
  if (filters.created_from || filters.created_to) count += 1;
  return count;
}

export type RelationshipOwnerOption = {
  id: string;
  name: string;
};

/** Active team members available as account / relationship owners. */
export async function listRelationshipOwnerOptions(): Promise<
  RelationshipOwnerOption[]
> {
  const values = await listClientDirectoryFilterValues();
  return values.owners;
}

/** Filter catalog for the directory dialog. */
export async function getClientDirectoryFilters(
  currentOwner?: CurrentOwner | null,
): Promise<ClientDirectoryFilters> {
  const [values, tiers] = await Promise.all([
    listClientDirectoryFilterValues(),
    getActiveClientTiers(),
  ]);

  const currentMemberId = currentOwner?.memberId;
  const owners = currentMemberId
    ? values.owners.filter((member) => member.id !== currentMemberId)
    : values.owners;

  return {
    tiers: tiers.map((tier) => ({
      value: tier.slug,
      label: tier.label,
    })),
    review_statuses: STATIC_REVIEW,
    sources: STATIC_SOURCES,
    owners,
    me_label: meOwnerLabel(currentOwner?.name),
    completeness: STATIC_COMPLETENESS,
    toggles: STATIC_TOGGLES,
    created_date_range: { enabled: true },
  };
}
