export type ClientReviewStatus = "pending" | "approved";
export type ClientSource = "studio" | "trip_builder" | "client_app" | "import";
export type PreferredContactMethod = "email" | "phone" | "whatsapp";

/** Row from public.client_tiers. */
export type ClientTier = {
  id: string;
  slug: string;
  label: string;
  rank: number;
  description: string | null;
  is_default: boolean;
  active: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Compact tier shape for directory / profile joins. */
export type ClientTierSummary = {
  id: string;
  slug: string;
  label: string;
  rank: number;
};

export type ClientImportantDate = {
  label: string;
  date: string;
  recurring?: boolean;
};

/** Row from public.clients. */
export type Client = {
  id: string;
  display_name: string;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  preferred_contact_method: PreferredContactMethod | null;
  preferred_language: string | null;
  timezone: string | null;
  nationality: string | null;
  city_of_residence: string | null;
  company: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  relationship_owner_id: string | null;
  tier_id: string;
  client_since: string | null;
  referred_by_client_id: string | null;
  important_dates: ClientImportantDate[];
  guest_notes: string | null;
  internal_notes: string | null;
  source: ClientSource;
  review_status: ClientReviewStatus;
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  profile_completeness: number;
  avatar_url: string | null;
  active: boolean;
  is_demo: boolean;
  merged_into_client_id: string | null;
  deactivated_at: string | null;
  deactivated_by_id: string | null;
  created_by_id: string | null;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientAuditAction =
  | "created"
  | "updated"
  | "merged"
  | "deactivated"
  | "reactivated"
  | "approved"
  | "document_verified"
  | "preference_confirmed"
  | "guest_invited";

export type ClientAuditLog = {
  id: string;
  client_id: string;
  action: ClientAuditAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  team_member_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ClientPreference = {
  id: string;
  client_id: string;
  category: string;
  label: string;
  sentiment: "prefer" | "avoid" | "require";
  source: "advisor" | "guest" | "import" | "trainer";
  is_confirmed: boolean;
  notes: string | null;
  active: boolean;
  created_by_id: string | null;
  confirmed_by_id: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientHealthProfile = {
  id: string;
  client_id: string;
  dietary_restrictions: string[];
  mobility_notes: string | null;
  medication_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  share_with_hotels: boolean;
  notes: string | null;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientDocument = {
  id: string;
  client_id: string;
  document_type: "passport" | "visa" | "insurance" | "other";
  document_number: string | null;
  issuing_country: string | null;
  expiry_date: string | null;
  date_of_birth: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  status: "pending_upload" | "pending_review" | "verified" | "rejected" | "expired";
  verified_at: string | null;
  verified_by_id: string | null;
  uploaded_by_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ClientRelationship = {
  id: string;
  from_client_id: string;
  to_client_id: string;
  relationship_type:
    | "assistant"
    | "travel_companion"
    | "colleague"
    | "referrer"
    | "other";
  notes: string | null;
  created_by_id: string | null;
  created_at: string;
};

export type ClientMergeCandidate = {
  id: string;
  client_id_a: string;
  client_id_b: string;
  similarity: number;
  match_reason: string;
  status: "open" | "merged" | "dismissed";
  notes: string | null;
  resolved_by_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GuestUser = {
  id: string;
  email: string;
  client_id: string;
  status: "active" | "pending_access" | "disabled";
  invited_by_id: string | null;
  invited_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FamilyMemberRole =
  | "primary"
  | "spouse"
  | "partner"
  | "child"
  | "parent"
  | "member";

export type FamilyMembership = {
  family_id: string;
  family_name: string;
  role: FamilyMemberRole;
  is_primary: boolean;
  members: Array<{
    client_id: string;
    display_name: string;
    role: FamilyMemberRole;
    is_primary: boolean;
  }>;
};

export type SimilarClientMatch = {
  client_id: string;
  display_name: string;
  similarity: number;
};
