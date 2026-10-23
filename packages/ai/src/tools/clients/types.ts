/** One row from client_search. */
export type ClientSearchHit = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  tier: { slug: string; label: string };
  review_status: string;
  /** The same id means the same household. Null: not in a household. */
  household_id: string | null;
};

/**
 * Lean client profile for get_client.
 * Use `counts.*` for “how many …” answers.
 */
export type ClientBrief = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  preferred_contact_method: string | null;
  preferred_language: string | null;
  nationality: string | null;
  city_of_residence: string | null;
  company: string | null;
  review_status: string;
  client_since: string | null;
  tier: { slug: string; label: string };
  relationship_owner: { id: string; name: string } | null;
  counts: {
    preferences: number;
    preferences_prefer: number;
    preferences_avoid: number;
    preferences_require: number;
    documents: number;
    documents_passport: number;
    documents_visa: number;
    documents_insurance: number;
    documents_other: number;
    family_members: number;
    relationships: number;
    bookings: number;
    open_trips: number;
  };
  family: {
    name: string;
    role: string;
    is_primary: boolean;
    members: Array<{
      display_name: string;
      role: string;
      is_primary: boolean;
    }>;
  } | null;
  preferences: Array<{
    category: string;
    label: string;
    sentiment: string;
    is_confirmed: boolean;
  }>;
  health: {
    dietary_restrictions: string[];
    mobility_notes: string | null;
    has_emergency_contact: boolean;
  } | null;
  documents: Array<{
    document_type: string;
    status: string;
    expiry_date: string | null;
    issuing_country: string | null;
  }>;
  guest_notes: string | null;
  /** Start date of the latest live booking. Null when there is none. */
  last_booking_date: string | null;
  note: string | null;
};

/** Filters for client_list: questions about the whole client base, not one person. */
export type ClientListInput = {
  tier?: "standard" | "vip" | "vvip";
  reviewStatus?: "pending" | "approved";
  /** Added on or after, YYYY-MM-DD. */
  addedFrom?: string;
  /** Added on or before, YYYY-MM-DD. */
  addedTo?: string;
  owner?: "mine" | "unassigned";
  missingContact?: boolean;
  inHousehold?: boolean;
  /** newest (default) or name. */
  sort?: "newest" | "name";
  limit?: number;
};

/** One row from client_list. */
export type ClientListRow = {
  id: string;
  display_name: string;
  tier: { slug: string; label: string };
  review_status: string;
  /** YYYY-MM-DD the client was added. */
  added_on: string;
  client_since: string | null;
  /** Household name. Null: not in a household. */
  household: string | null;
};

/**
 * Host callbacks for client tools.
 * Studio injects these — @pureluxe/ai never hits DB.
 */
export type ClientToolHandlers = {
  searchClients: (input: {
    query: string;
    limit?: number;
  }) => Promise<{ clients: ClientSearchHit[] }>;
  getClient: (input: { clientId?: string }) => Promise<ClientBrief>;
  /** `total` counts every client matching the filters; `clients` is the first page. */
  listClients: (input: ClientListInput) => Promise<{ clients: ClientListRow[]; total: number }>;
};
