import type {
  CreateBookingTravellerInput,
  UpdateBookingTravellerInput,
} from "@pureluxe/shared";

import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { BookingTraveller } from "../../schema";

const TRAVELLER_COLUMNS = [
  "id",
  "booking_id",
  "client_id",
  "title",
  "full_name",
  "gender",
  "role",
  "date_of_birth",
  "passport_number",
  "passport_nationality",
  "passport_expiry",
  "created_at",
  "updated_at",
].join(", ");

/** Named travellers on a booking (passport fields for ops). */
export async function listBookingTravellers(
  bookingId: string,
  limit = 50,
): Promise<BookingTraveller[]> {
  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("booking_travellers")
      .select(TRAVELLER_COLUMNS)
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true })
      .limit(limit),
  );

  if (error) throw dbQueryError(error);
  return (data as unknown as BookingTraveller[] | null) ?? [];
}

/** One traveller on a booking, or null. */
export async function findBookingTravellerById(
  travellerId: string,
): Promise<BookingTraveller | null> {
  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("booking_travellers")
      .select(TRAVELLER_COLUMNS)
      .eq("id", travellerId)
      .maybeSingle(),
  );

  if (error) throw dbQueryError(error);
  return (data as unknown as BookingTraveller | null) ?? null;
}

/** Insert a traveller on a booking. */
export async function insertBookingTraveller(
  input: {
    booking_id: string;
  } & CreateBookingTravellerInput,
): Promise<BookingTraveller> {
  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("booking_travellers")
      .insert({
        booking_id: input.booking_id,
        client_id: input.client_id ?? null,
        title: input.title ?? null,
        full_name: input.full_name,
        gender: input.gender ?? null,
        role: input.role ?? "adult",
        date_of_birth: input.date_of_birth ?? null,
        passport_number: input.passport_number ?? null,
        passport_nationality: input.passport_nationality ?? null,
        passport_expiry: input.passport_expiry ?? null,
      })
      .select(TRAVELLER_COLUMNS)
      .single(),
  );

  if (error) throw dbQueryError(error);
  return data as unknown as BookingTraveller;
}

/** Update traveller fields. */
export async function updateBookingTraveller(
  input: {
    id: string;
    booking_id: string;
  } & UpdateBookingTravellerInput,
): Promise<BookingTraveller> {
  const supabase = getServiceClient();
  const { id, booking_id, ...patch } = input;

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("booking_travellers")
      .update(patch)
      .eq("id", id)
      .eq("booking_id", booking_id)
      .select(TRAVELLER_COLUMNS)
      .single(),
  );

  if (error) throw dbQueryError(error);
  return data as unknown as BookingTraveller;
}

/** Delete a traveller from a booking. */
export async function deleteBookingTraveller(input: {
  id: string;
  booking_id: string;
}): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await runSupabaseQuery(() =>
    supabase
      .from("booking_travellers")
      .delete()
      .eq("id", input.id)
      .eq("booking_id", input.booking_id),
  );

  if (error) throw dbQueryError(error);
}
