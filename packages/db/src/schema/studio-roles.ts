/** Built-in roles seeded in migration 001 — not an exhaustive list. */
export const DEFAULT_STUDIO_ROLE_SLUGS = [
  "advisor",
  "ops",
  "finance",
  "admin",
] as const;

export type DefaultStudioRoleSlug = (typeof DEFAULT_STUDIO_ROLE_SLUGS)[number];

/** Role slug stored on team_members.role — references studio_roles.slug. */
export type StudioRole = string;

/** Row from studio_roles — admin can add more over time. */
export type StudioRoleRecord = {
  slug: string;
  label: string;
  description: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
