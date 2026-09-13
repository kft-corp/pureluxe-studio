export type TripStatus =
  | "building"
  | "waiting_on_client"
  | "booking"
  | "confirmed"
  | "completed"
  | "cancelled";

export type TripClientVisibility = "draft" | "ready" | "shared";

export type TripSource = "studio" | "client_app" | "import";

export type TripClientRole = "primary" | "companion";

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

export type TripDocumentType = "itinerary" | "rates";

export type TripDocumentStatus = "ready" | "stale" | "generating";

export type TripChatChannel = "studio" | "guest";

export type TripChatRole = "user" | "assistant";

export type TripChatMode = "discover" | "execute";

/** Row from public.trips. */
export type Trip = {
  id: string;
  primary_client_id: string | null;
  relationship_owner_id: string | null;
  title: string | null;
  status: TripStatus;
  client_visibility: TripClientVisibility;
  published_at: string | null;
  published_by_id: string | null;
  sell_total: number | null;
  sell_currency: string | null;
  cost_total_internal: number | null;
  margin_internal: number | null;
  payment_plan: Record<string, unknown> | null;
  pricing_locked_at: string | null;
  pricing_locked_by_id: string | null;
  source: TripSource;
  created_by_id: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.trip_clients. */
export type TripClient = {
  id: string;
  trip_id: string;
  client_id: string;
  role: TripClientRole;
  created_at: string;
};

/** Row from public.trip_legs. */
export type TripLeg = {
  id: string;
  trip_id: string;
  sequence_order: number;
  destination: string;
  check_in: string | null;
  check_out: string | null;
  itinerary_status: TripLegItineraryStatus;
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
  raw_input: string | null;
  extracted_json: Record<string, unknown> | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.trip_documents. */
export type TripDocument = {
  id: string;
  trip_id: string;
  type: TripDocumentType;
  file_path: string;
  status: TripDocumentStatus;
  generated_at: string;
  source_updated_at: string;
};

/** Row from public.trip_chat_messages. */
export type TripChatMessage = {
  id: string;
  trip_id: string;
  channel: TripChatChannel;
  team_member_id: string | null;
  role: TripChatRole;
  content: string;
  tool_calls: unknown | null;
  mode: TripChatMode | null;
  is_demo: boolean;
  created_at: string;
};
