import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  BookingServiceType,
  BookingStatus,
  TripLineItemCategory,
  TripLineItemStatus,
} from "../../schema";

const LINE_COLUMNS = [
  "id",
  "leg_id",
  "category",
  "title",
  "subtitle",
  "property_name",
  "status",
  "selected",
  "sell_amount",
  "currency",
  "extracted_json",
].join(", ");

const BOOKING_COLUMNS = [
  "id",
  "trip_leg_id",
  "trip_line_item_id",
  "service_type",
  "title",
  "hotel_name",
  "city",
  "start_date",
  "end_date",
  "status",
].join(", ");

export type JourneyLineItemRow = {
  id: string;
  leg_id: string | null;
  category: TripLineItemCategory;
  title: string;
  subtitle: string | null;
  property_name: string | null;
  status: TripLineItemStatus;
  selected: boolean;
  sell_amount: number | string | null;
  currency: string | null;
  extracted_json: Record<string, unknown> | null;
};

export type JourneyBookingRow = {
  id: string;
  trip_leg_id: string | null;
  trip_line_item_id: string | null;
  service_type: BookingServiceType;
  title: string;
  hotel_name: string | null;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  status: BookingStatus;
};

/** Selected plan rows and linked inventory for one journey page. */
export async function listJourneyPieces(tripId: string): Promise<{
  lineItems: JourneyLineItemRow[];
  bookings: JourneyBookingRow[];
}> {
  const supabase = getServiceClient();

  const [linesResult, bookingsResult] = await Promise.all([
    runSupabaseQuery(() =>
      supabase.from("trip_line_items").select(LINE_COLUMNS).eq("trip_id", tripId),
    ),
    runSupabaseQuery(() =>
      supabase
        .from("bookings")
        .select(BOOKING_COLUMNS)
        .eq("trip_id", tripId)
        .eq("is_demo", false)
        .is("deleted_at", null)
        .neq("status", "superseded")
        .order("start_date", { ascending: true }),
    ),
  ]);

  if (linesResult.error) throw dbQueryError(linesResult.error);
  if (bookingsResult.error) throw dbQueryError(bookingsResult.error);

  return {
    lineItems: (linesResult.data as JourneyLineItemRow[] | null) ?? [],
    bookings: (bookingsResult.data as JourneyBookingRow[] | null) ?? [],
  };
}
