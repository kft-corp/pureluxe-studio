import type { StudioRole } from "./studio-roles";

export type { StudioRole } from "./studio-roles";

/** Row from team_members — someone allowed in Studio. */
export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: StudioRole;
  title: string | null;
  phone: string | null;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};
