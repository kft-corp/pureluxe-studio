/**
 * Parallel entity detail load for GET /entities/[id].
 * Staff notes/feedback only when include_staff=true (studio view).
 */
import type {
  KbActivityDetails,
  KbCustomerFeedback,
  KbEntity,
  KbFact,
  KbHotelConsortia,
  KbHotelDetails,
  KbHotelRoomCategory,
  KbInternalNote,
  KbRestaurantDetails,
  KbVendorDetails,
} from "../../schema";
import {
  findActiveKbEntityById,
  findKbEntityById,
} from "./entities";
import {
  findKbActivityDetails,
  findKbHotelDetails,
  findKbRestaurantDetails,
  findKbVendorDetails,
  listActiveKbHotelRoomCategories,
  listKbHotelConsortia,
  type KbHotelDetailBundle,
} from "./entity-details";
import { listApprovedKbFactsForEntity } from "./facts";
import {
  listKbCustomerFeedbackForEntity,
  listKbInternalNotesForEntity,
} from "./staff";

export type KbEntityDetailBundle = {
  entity: KbEntity;
  hotel: KbHotelDetailBundle | null;
  restaurant: KbRestaurantDetails | null;
  activity: KbActivityDetails | null;
  vendor: KbVendorDetails | null;
  facts: KbFact[];
  /** Null when include_staff=false (client/PDF). */
  internal_notes: KbInternalNote[] | null;
  customer_feedback: KbCustomerFeedback[] | null;
};

/**
 * One round-trip set for getEntity.
 * Pass include_staff=false for client/PDF — notes/feedback stay null (rule 6).
 */
export async function loadKbEntityDetailBundle(input: {
  entity_id: string;
  /** Default true. Studio may include notes/feedback; client must not. */
  include_staff?: boolean;
  /** Default true — inactive rows return null. */
  active_only?: boolean;
}): Promise<KbEntityDetailBundle | null> {
  const entity =
    input.active_only === false
      ? await findKbEntityById(input.entity_id)
      : await findActiveKbEntityById(input.entity_id);

  if (!entity) return null;

  const includeStaff = input.include_staff !== false;

  const [
    hotelDetails,
    rooms,
    consortia,
    restaurant,
    activity,
    vendor,
    facts,
    internal_notes,
    customer_feedback,
  ] = await Promise.all([
    entity.entity_type === "hotel"
      ? findKbHotelDetails(entity.id)
      : Promise.resolve(null),
    entity.entity_type === "hotel"
      ? listActiveKbHotelRoomCategories(entity.id)
      : Promise.resolve([] as KbHotelRoomCategory[]),
    entity.entity_type === "hotel"
      ? listKbHotelConsortia(entity.id)
      : Promise.resolve([] as KbHotelConsortia[]),
    entity.entity_type === "restaurant"
      ? findKbRestaurantDetails(entity.id)
      : Promise.resolve(null),
    entity.entity_type === "activity"
      ? findKbActivityDetails(entity.id)
      : Promise.resolve(null),
    entity.entity_type === "vendor"
      ? findKbVendorDetails(entity.id)
      : Promise.resolve(null),
    listApprovedKbFactsForEntity(entity.id),
    includeStaff
      ? listKbInternalNotesForEntity(entity.id)
      : Promise.resolve(null),
    includeStaff
      ? listKbCustomerFeedbackForEntity(entity.id)
      : Promise.resolve(null),
  ]);

  const hotel: KbHotelDetailBundle | null =
    entity.entity_type === "hotel"
      ? {
          details: hotelDetails as KbHotelDetails | null,
          rooms,
          consortia,
        }
      : null;

  return {
    entity,
    hotel,
    restaurant,
    activity,
    vendor,
    facts,
    internal_notes,
    customer_feedback,
  };
}
