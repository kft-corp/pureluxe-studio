/** Studio role — must match DB CHECK on team_members.role. */
export type StudioRole = "advisor" | "ops" | "finance" | "admin";

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
