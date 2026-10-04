import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  KbContractStatus,
  KbTier,
  TripLineItem,
  TripLineItemCategory,
  TripLineItemSource,
  TripLineItemStatus,
  TripLineItemUnit,
} from "../../schema";

export type InsertTripLineItemInput = {
  trip_id: string;
  leg_id?: string | null;
  category: TripLineItemCategory;
  title: string;
  subtitle?: string | null;
  details?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  kb_entity_id?: string | null;
  kb_tier?: KbTier | null;
  kb_contract_status?: KbContractStatus | null;
  unit?: TripLineItemUnit | null;
  quantity?: number | null;
  unit_count?: number;
  rate_per_unit?: number | null;
  tax_percentage?: number | null;
  currency?: string | null;
  sell_amount?: number | null;
  cost_internal?: number | null;
  rate_source_code?: string | null;
  inclusions?: unknown[];
  cancellation_policy?: string | null;
  payment_policy?: string | null;
  breakdown?: Record<string, unknown> | null;
  status?: TripLineItemStatus;
  selected?: boolean;
  guest_leaning?: boolean;
  source?: TripLineItemSource;
  raw_input?: string | null;
  extracted_json?: Record<string, unknown> | null;
  created_by_id?: string | null;
};

/** Insert a trip line item; returns the created row. */
export async function insertTripLineItem(
  input: InsertTripLineItemInput,
): Promise<TripLineItem> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_line_items")
      .insert({
        trip_id: input.trip_id,
        leg_id: input.leg_id ?? null,
        category: input.category,
        title: input.title,
        subtitle: input.subtitle ?? null,
        details: input.details ?? null,
        property_id: input.property_id ?? null,
        property_name: input.property_name ?? null,
        kb_entity_id: input.kb_entity_id ?? null,
        kb_tier: input.kb_tier ?? null,
        kb_contract_status: input.kb_contract_status ?? null,
        unit: input.unit ?? null,
        quantity: input.quantity ?? null,
        unit_count: input.unit_count ?? 1,
        rate_per_unit: input.rate_per_unit ?? null,
        tax_percentage: input.tax_percentage ?? null,
        currency: input.currency ?? null,
        sell_amount: input.sell_amount ?? null,
        cost_internal: input.cost_internal ?? null,
        rate_source_code: input.rate_source_code ?? null,
        inclusions: input.inclusions ?? [],
        cancellation_policy: input.cancellation_policy ?? null,
        payment_policy: input.payment_policy ?? null,
        breakdown: input.breakdown ?? null,
        status: input.status ?? "pending",
        selected: input.selected ?? false,
        guest_leaning: input.guest_leaning ?? false,
        source: input.source ?? "manual",
        raw_input: input.raw_input ?? null,
        extracted_json: input.extracted_json ?? null,
        created_by_id: input.created_by_id ?? null,
      })
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripLineItem;
}

/** Look up a line item by id. */
export async function findTripLineItemById(
  lineItemId: string,
): Promise<TripLineItem | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_line_items")
      .select("*")
      .eq("id", lineItemId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripLineItem | null;
}

/** Update line-item status only when current status matches (atomic gate). */
export async function updateTripLineItemStatus(
  lineItemId: string,
  status: TripLineItemStatus,
  options?: { fromStatus?: TripLineItemStatus },
): Promise<TripLineItem | null> {
  const supabase = getServiceClient();

  let query = supabase
    .from("trip_line_items")
    .update({ status })
    .eq("id", lineItemId);

  if (options?.fromStatus) {
    query = query.eq("status", options.fromStatus);
  }

  const { data, error } = await runSupabaseQuery(() =>
    query.select("*").maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripLineItem | null;
}
