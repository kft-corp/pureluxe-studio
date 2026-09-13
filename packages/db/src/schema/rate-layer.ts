/** Row from public.company_settings. */
export type CompanySetting = {
  key: string;
  value: Record<string, unknown>;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Seeded shape for company_settings.key = rate_sources. */
export type RateSourcesSetting = {
  preference_order: string[];
  allow_offline_paste: boolean;
  default_currency: string;
};

/** Row from public.properties. */
export type Property = {
  id: string;
  name: string;
  destination: string | null;
  brand: string | null;
  chain: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  property_type: string | null;
  sabre_hotel_code: string | null;
  hotelbeds_hotel_code: string | null;
  default_commission: number | null;
  commission_channel: string | null;
  commissionable: boolean | null;
  relationship_strength: string | null;
  booking_notes: string | null;
  vip_contact_notes: string | null;
  reservations_email: string | null;
  general_phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.offline_trip_types. */
export type OfflineTripType = {
  id: string;
  trip_type: string;
  notes: string | null;
  active: boolean;
  created_at: string;
};

/** Row from public.wholesaler_destinations. */
export type WholesalerDestination = {
  id: string;
  destination: string;
  wholesaler_name: string;
  api_source: string;
  active: boolean;
  created_at: string;
};

/** Row from public.high_value_routing. */
export type HighValueRouting = {
  id: string;
  destination: string | null;
  property_id: string | null;
  wholesale_source: string;
  notes: string | null;
  active: boolean;
  created_at: string;
};
