/** One row from search_clients. */
export type ClientSearchHit = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  tier: { slug: string; label: string };
  review_status: string;
  has_family: boolean;
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
};

/** @deprecated Use ClientToolHandlers */
export type ClientLookupHandlers = ClientToolHandlers;
