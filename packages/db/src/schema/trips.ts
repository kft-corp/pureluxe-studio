import type {
  KbContractStatus,
  KbSelectionStatus,
  KbTier,
} from "./atlas-kb";

export type TripStatus =
  | "building"
  | "quote_sent"
  | "waiting_on_client"
  | "booking"
  | "confirmed"
  | "completed"
  | "cancelled";

export type TripClientVisibility = "draft" | "ready" | "shared";

export type TripSource = "studio" | "client_app" | "import";

export type TripClientRole = "primary" | "companion";

export type TripPartyRole = "adult" | "child";

export type TripLegItineraryStatus = "not_started" | "drafted" | "confirmed";

export type TripItineraryDaySource = "curated" | "generated" | "manual";

export type TripLineItemCategory =
  | "accommodation"
  | "activity"
  | "transfer"
  | "flight";

export type TripLineItemStatus =
  | "pending_review"
  | "pending"
  | "confirmed"
  | "rejected";

export type TripLineItemSource = "manual" | "offline_kb" | "api";

export type TripLineItemUnit = "night" | "person" | "flat";

export type TripLineItemAvailabilityStatus =
  | "unknown"
  | "available"
  | "unavailable"
  | "on_request";

export type TripDocumentType = "itinerary" | "rates" | "options";

export type TripDocumentStatus = "ready" | "stale" | "generating";

export type TripChatChannel = "studio" | "guest";

export type TripChatRole = "user" | "assistant";

export type TripChatMode = "discover" | "execute";

/** text = typed or agent reply; action = button tap; event = system line (Undo). */
export type TripChatKind = "text" | "action" | "event";

/** What the agent assumed when the advisor didn't say it. */
export type TripAssumptions = {
  /** The year of the trip dates was worked out (next occurrence after today). */
  year?: boolean;
  /** Rooms were set to one per two adults. */
  rooms?: boolean;
};

export type TripPendingConfirmStatus =
  | "pending"
  | "consumed"
  | "superseded"
  | "expired";

export type TripAttachmentPurpose = "quote_paste" | "email" | "image" | "other";

/** Row from public.trips. */
export type Trip = {
  id: string;
  primary_client_id: string | null;
  relationship_owner_id: string | null;
  title: string | null;
  /** First day of the whole trip. Stays must start on or after this. */
  starts_on: string | null;
  /** Last day of the whole trip. Stays must end on or before this. */
  ends_on: string | null;
  /** Set when the stay list is finished and hotel planning can start. */
  legs_confirmed_at: string | null;
  /** Set when the named party is finished. */
  travellers_confirmed_at: string | null;
  status: TripStatus;
  client_visibility: TripClientVisibility;
  published_at: string | null;
  published_by_id: string | null;
  sell_total: number | null;
  sell_currency: string | null;
  cost_total_internal: number | null;
  margin_internal: number | null;
  payment_plan: Record<string, unknown> | null;
  /** Client money recorded as received (offline collection). */
  amount_received: number | null;
  /** not_started | partial | paid | overdue */
  payment_status: string;
  pricing_locked_at: string | null;
  pricing_locked_by_id: string | null;
  source: TripSource;
  created_by_id: string | null;
  is_demo: boolean;
  archived_at: string | null;
  archived_by_id: string | null;
  last_studio_message_at: string | null;
  last_studio_message_preview: string | null;
  /** Bumped on every agent change and Undo; a change against an older version is refused. */
  version: number;
  /** Values the agent assumed rather than asked, e.g. { year: true }. */
  assumptions: TripAssumptions;
  created_at: string;
  updated_at: string;
};

/** Row from public.trip_clients. */
export type TripClient = {
  id: string;
  trip_id: string;
  client_id: string;
  role: TripClientRole;
  party_role: TripPartyRole;
  created_at: string;
};

/** Row from public.trip_legs. */
export type TripLeg = {
  id: string;
  trip_id: string;
  sequence_order: number;
  destination: string;
  destination_profile_id: string | null;
  check_in: string | null;
  check_out: string | null;
  itinerary_status: TripLegItineraryStatus;
  /** Atlas gate: pending → resolved | empty after resolve-candidates. */
  kb_selection_status: KbSelectionStatus;
  /** Atlas country for matching (021); destination text stays for display. */
  kb_country_id: string | null;
  /** Atlas city for matching (021); destination text stays for display. */
  kb_city_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.trip_itinerary_days. */
export type TripItineraryDay = {
  id: string;
  trip_id: string;
  leg_id: string;
  day_num: number;
  date: string | null;
  title: string | null;
  items: unknown[];
  source: TripItineraryDaySource;
  verified: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.trip_line_items. */
export type TripLineItem = {
  id: string;
  trip_id: string;
  leg_id: string | null;
  category: TripLineItemCategory;
  title: string;
  subtitle: string | null;
  details: string | null;
  property_id: string | null;
  property_name: string | null;
  /** Atlas entity selected for this line (016). */
  kb_entity_id: string | null;
  /** Copied from kb_entities at select time. Rate search must not clear this. */
  kb_tier: KbTier | null;
  kb_contract_status: KbContractStatus | null;
  unit: TripLineItemUnit | null;
  quantity: number | null;
  unit_count: number;
  rate_per_unit: number | null;
  tax_percentage: number | null;
  currency: string | null;
  sell_amount: number | null;
  cost_internal: number | null;
  rate_source_code: string | null;
  inclusions: unknown[];
  cancellation_policy: string | null;
  payment_policy: string | null;
  breakdown: Record<string, unknown> | null;
  room_size: string | null;
  room_features: unknown | null;
  segments: unknown | null;
  loyalty_hotel_eligible: boolean | null;
  loyalty_pureluxe_eligible: boolean | null;
  status: TripLineItemStatus;
  selected: boolean;
  guest_leaning: boolean;
  source: TripLineItemSource;
  availability_status: TripLineItemAvailabilityStatus | null;
  raw_input: string | null;
  extracted_json: Record<string, unknown> | null;
  /** Stored rate offer this option was copied from (021). */
  rate_search_result_id: string | null;
  /** Markup used when the option was added (021). */
  markup_percent: number | null;
  /** Option 1 / option 2 order per hotel (021). */
  option_rank: number | null;
  /** How the option was added: agent / button / paste / manual (021). */
  added_via: "agent" | "button" | "paste" | "manual" | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.trip_documents. */
export type TripDocument = {
  id: string;
  trip_id: string;
  type: TripDocumentType;
  file_path: string | null;
  status: TripDocumentStatus;
  generated_at: string | null;
  source_updated_at: string | null;
  source_fingerprint: string | null;
  narrative_json: Record<string, unknown> | null;
  generated_by_id: string | null;
  updated_at: string;
};

/** Row from public.trip_chat_messages. */
export type TripChatMessage = {
  id: string;
  trip_id: string;
  channel: TripChatChannel;
  team_member_id: string | null;
  role: TripChatRole;
  kind: TripChatKind;
  content: string;
  /** Structured data for action / event rows. */
  payload: Record<string, unknown> | null;
  tool_calls: unknown | null;
  mode: TripChatMode | null;
  is_demo: boolean;
  incomplete: boolean;
  client_request_id: string | null;
  /** Agent run behind this reply. */
  trace_id: string | null;
  created_at: string;
};

/** Row from public.trip_pending_confirms. */
export type TripPendingConfirm = {
  id: string;
  trip_id: string;
  member_id: string;
  tool: string;
  args: Record<string, unknown>;
  status: TripPendingConfirmStatus;
  /** Agent thread paused on this approval. */
  thread_id: string | null;
  /** trips.version when the card was shown. */
  trip_version: number | null;
  /** What Confirm will do. */
  summary: string | null;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  consumed_by_id: string | null;
};

/** Row from public.trip_attachments. */
export type TripAttachment = {
  id: string;
  trip_id: string;
  chat_message_id: string | null;
  line_item_id: string | null;
  uploaded_by_id: string | null;
  purpose: TripAttachmentPurpose;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
};

/** Row from public.trip_undo_actions. */
export type TripUndoAction = {
  id: string;
  trip_id: string;
  member_id: string;
  action: string;
  /** Agent tool that made the change. */
  tool: string | null;
  args: Record<string, unknown>;
  /** What changed, shown on the Undo button. */
  summary: string | null;
  before_payload: Record<string, unknown>;
  after_payload: Record<string, unknown>;
  idempotency_key: string | null;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
};

/** Row from public.trip_idempotency_keys. */
export type TripIdempotencyKey = {
  id: string;
  trip_id: string | null;
  member_id: string;
  idempotency_key: string;
  request_hash: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  expires_at: string;
};

/** Row from public.trip_attention_snoozes. */
export type TripAttentionSnooze = {
  id: string;
  trip_id: string;
  member_id: string;
  signal_key: string;
  snoozed_until: string;
  created_at: string;
};
