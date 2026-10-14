import { listTeamMembers } from "../auth/team-management";
import type { ClientReviewStatus, ClientSource } from "../../schema";

export type ClientFilterOwnerOption = {
  id: string;
  name: string;
};

export type ClientDirectoryFilterValues = {
  review_statuses: ClientReviewStatus[];
  sources: ClientSource[];
  owners: ClientFilterOwnerOption[];
};

const KNOWN_REVIEW_STATUSES: ClientReviewStatus[] = ["pending", "approved"];
const KNOWN_SOURCES: ClientSource[] = [
  "studio",
  "trip_builder",
  "client_app",
  "import",
];

/**
 * Filter catalog for the directory dialog.
 * Enums are static (no full-table scan). Owners come from active team members.
 */
export async function listClientDirectoryFilterValues(): Promise<ClientDirectoryFilterValues> {
  const members = await listTeamMembers();

  const owners = members
    .filter((member) => member.active)
    .map((member) => ({ id: member.id, name: member.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    review_statuses: [...KNOWN_REVIEW_STATUSES],
    sources: [...KNOWN_SOURCES],
    owners,
  };
}
