/**
 * Type-specific child rows for one kb_entity (hotel / restaurant / …).
 * Loaded with the entity for studio detail cards — no prices.
 */
import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  KbActivityDetails,
  KbHotelConsortia,
  KbHotelDetails,
  KbHotelRoomCategory,
  KbRestaurantDetails,
  KbVendorDetails,
} from "../../schema";

/** 1:1 hotel amenities / dining / wellness. */
export async function findKbHotelDetails(
  entityId: string,
): Promise<KbHotelDetails | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_hotel_details")
      .select("*")
      .eq("entity_id", entityId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbHotelDetails | null;
}

/** Active room categories for a hotel (no rates). */
export async function listActiveKbHotelRoomCategories(
  entityId: string,
): Promise<KbHotelRoomCategory[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_hotel_room_categories")
      .select("*")
      .eq("entity_id", entityId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbHotelRoomCategory[];
}

/** Partner clubs for a hotel (Rate Layer reads negotiated_rate_code_id after select). */
export async function listKbHotelConsortia(
  entityId: string,
): Promise<KbHotelConsortia[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_hotel_consortia")
      .select("*")
      .eq("entity_id", entityId)
      .order("club_name", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbHotelConsortia[];
}

export async function findKbRestaurantDetails(
  entityId: string,
): Promise<KbRestaurantDetails | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_restaurant_details")
      .select("*")
      .eq("entity_id", entityId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbRestaurantDetails | null;
}

export async function findKbActivityDetails(
  entityId: string,
): Promise<KbActivityDetails | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_activity_details")
      .select("*")
      .eq("entity_id", entityId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbActivityDetails | null;
}

export async function findKbVendorDetails(
  entityId: string,
): Promise<KbVendorDetails | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_vendor_details")
      .select("*")
      .eq("entity_id", entityId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbVendorDetails | null;
}

export type KbHotelDetailBundle = {
  details: KbHotelDetails | null;
  rooms: KbHotelRoomCategory[];
  consortia: KbHotelConsortia[];
};

/** Parallel load for hotel studio/client detail. */
export async function loadKbHotelDetailBundle(
  entityId: string,
): Promise<KbHotelDetailBundle> {
  const [details, rooms, consortia] = await Promise.all([
    findKbHotelDetails(entityId),
    listActiveKbHotelRoomCategories(entityId),
    listKbHotelConsortia(entityId),
  ]);

  return { details, rooms, consortia };
}
