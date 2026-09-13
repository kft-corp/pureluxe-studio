export type BookingServiceType = "hotel" | "flight" | "transfer" | "activity";

export type BookingSource = "trip_builder" | "manual" | "client_app" | "import";

export type BookingStatus =
  | "pending"
  | "on_hold"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "superseded";

export type BookingTravellerRole = "lead" | "adult" | "child" | "infant";

export type BookingTravellerGender = "male" | "female" | "unspecified";

export type BookingAuditPerformedBy = "team" | "system" | "client";

/** Row from public.bookings. */
export type Booking = {
  id: string;
  client_id: string | null;
  trip_id: string | null;
  trip_leg_id: string | null;
  trip_line_item_id: string | null;
  service_type: BookingServiceType;
  relationship_owner_id: string | null;
  booked_by_id: string | null;
  source: BookingSource;
  title: string;
  property_id: string | null;
  hotel_name: string | null;
  city: string | null;
  country: string | null;
  chain: string | null;
  start_date: string | null;
  end_date: string | null;
  nights: number | null;
  num_rooms: number | null;
  num_adults: number | null;
  num_children: number | null;
  supplier_name: string | null;
  supplier_ref: string | null;
  booking_channel: string | null;
  currency: string | null;
  cost_amount: number | null;
  sell_amount: number | null;
  commission_expected: number | null;
  status: BookingStatus;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancellation_deadline: string | null;
  cancellation_policy: string | null;
  ticket_time_limit: string | null;
  amended_from_id: string | null;
  guest_visible: boolean;
  guest_notes: string | null;
  internal_notes: string | null;
  confirmation_file_path: string | null;
  service_details: Record<string, unknown>;
  vip_flag: boolean;
  special_occasion: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.booking_travellers. */
export type BookingTraveller = {
  id: string;
  booking_id: string;
  client_id: string | null;
  title: string | null;
  full_name: string;
  gender: BookingTravellerGender | null;
  role: BookingTravellerRole;
  date_of_birth: string | null;
  passport_number: string | null;
  passport_nationality: string | null;
  passport_expiry: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.booking_audit_log. */
export type BookingAuditLog = {
  id: string;
  booking_id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  performed_by: BookingAuditPerformedBy;
  team_member_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
