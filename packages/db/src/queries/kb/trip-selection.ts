/**
 * Trip Builder handshake for Atlas resolve (§3.2 re-run).
 * Mutates trip_legs / trip_line_items only — no rates.
 */
import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  KbEntity,
  KbEntityType,
  KbSelectionStatus,
  TripLeg,
  TripLineItem,
  TripLineItemCategory,
} from "../../schema";
import { insertTripLineItem } from "../trips/trip-line-items";

function categoryForEntityType(
  entityType: KbEntityType,
): TripLineItemCategory | null {
  switch (entityType) {
    case "hotel":
      return "accommodation";
    case "activity":
      return "activity";
    case "restaurant":
    case "vendor":
    case "destination":
    case "other":
      return null;
  }
}

/** Set compose gate on a leg after resolve. */
export async function updateTripLegKbSelectionStatus(input: {
  leg_id: string;
  kb_selection_status: KbSelectionStatus;
}): Promise<TripLeg | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_legs")
      .update({ kb_selection_status: input.kb_selection_status })
      .eq("id", input.leg_id)
      .select("*")
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripLeg | null;
}

/**
 * Draft KB candidates that resolve may replace on re-run:
 * unselected, no cost/sell yet. Keeps selected / pasted / priced rows.
 */
export async function listReplaceableKbDraftLineItems(input: {
  trip_id: string;
  leg_id: string;
}): Promise<TripLineItem[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_line_items")
      .select("*")
      .eq("trip_id", input.trip_id)
      .eq("leg_id", input.leg_id)
      .eq("selected", false)
      .is("sell_amount", null)
      .is("cost_internal", null)
      .not("kb_entity_id", "is", null),
  );

  if (error) {
    throw dbQueryError(error);
  }

  const rows = (data ?? []) as TripLineItem[];

  return rows.filter((row) => {
    if (row.status === "pending_review" || row.status === "confirmed") {
      return false;
    }
    if (row.source === "manual" && row.raw_input) {
      return false;
    }
    return true;
  });
}

/** Delete draft candidate rows by id (resolve re-run). */
export async function deleteTripLineItemsByIds(
  lineItemIds: string[],
): Promise<number> {
  if (lineItemIds.length === 0) return 0;

  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_line_items")
      .delete()
      .in("id", lineItemIds)
      .select("id"),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []).length;
}

/**
 * Replace unselected unpriced KB drafts for a leg.
 * Caller then inserts the new candidate set via insertKbDraftCandidatesForLeg.
 */
export async function replaceKbDraftCandidatesForLeg(input: {
  trip_id: string;
  leg_id: string;
}): Promise<{ deleted_ids: string[] }> {
  const drafts = await listReplaceableKbDraftLineItems(input);
  const deleted_ids = drafts.map((row) => row.id);
  await deleteTripLineItemsByIds(deleted_ids);
  return { deleted_ids };
}

export type InsertKbDraftCandidateInput = {
  trip_id: string;
  leg_id: string;
  entity: Pick<
    KbEntity,
    | "id"
    | "name"
    | "brand"
    | "entity_type"
    | "kb_tier"
    | "property_id"
    | "contract_status"
    | "advisor_take"
  >;
  created_by_id?: string | null;
};

/**
 * Write resolve candidates onto a leg — kb_entity_id + kb_tier, no prices.
 * Skips entity types that are not trip line categories (restaurant/vendor/place).
 */
export async function insertKbDraftCandidatesForLeg(
  candidates: InsertKbDraftCandidateInput[],
): Promise<TripLineItem[]> {
  const insertable = candidates.flatMap((candidate) => {
    const category = categoryForEntityType(candidate.entity.entity_type);
    if (!category) return [];
    return [{ candidate, category }];
  });

  return Promise.all(
    insertable.map(({ candidate, category }) =>
      insertTripLineItem({
        trip_id: candidate.trip_id,
        leg_id: candidate.leg_id,
        category,
        title: candidate.entity.name,
        subtitle: candidate.entity.brand,
        details: candidate.entity.advisor_take,
        property_id: candidate.entity.property_id,
        property_name: candidate.entity.name,
        kb_entity_id: candidate.entity.id,
        kb_tier: candidate.entity.kb_tier,
        kb_contract_status: candidate.entity.contract_status,
        status: "pending",
        selected: false,
        source: "offline_kb",
        created_by_id: candidate.created_by_id ?? null,
      }),
    ),
  );
}

/**
 * Resolve re-run for one leg: drop replaceable drafts, insert new set,
 * set kb_selection_status to resolved or empty.
 */
export async function applyKbResolveCandidatesForLeg(input: {
  trip_id: string;
  leg_id: string;
  entities: InsertKbDraftCandidateInput["entity"][];
  created_by_id?: string | null;
}): Promise<{
  deleted_ids: string[];
  line_items: TripLineItem[];
  kb_selection_status: KbSelectionStatus;
}> {
  const { deleted_ids } = await replaceKbDraftCandidatesForLeg({
    trip_id: input.trip_id,
    leg_id: input.leg_id,
  });

  const line_items = await insertKbDraftCandidatesForLeg(
    input.entities.map((entity) => ({
      trip_id: input.trip_id,
      leg_id: input.leg_id,
      entity,
      created_by_id: input.created_by_id,
    })),
  );

  const kb_selection_status: KbSelectionStatus =
    line_items.length > 0 ? "resolved" : "empty";

  await updateTripLegKbSelectionStatus({
    leg_id: input.leg_id,
    kb_selection_status,
  });

  return { deleted_ids, line_items, kb_selection_status };
}
