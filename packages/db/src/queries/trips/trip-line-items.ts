import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  KbContractStatus,
  KbTier,
  TripLineItem,
  TripLineItemAvailabilityStatus,
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
  availability_status?: TripLineItemAvailabilityStatus | null;
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
        availability_status: input.availability_status ?? null,
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

/** Marker written on the Phase 1 named-hotel stay shell (before rates). */
export const STAY_SHELL_MARKER = { stay_shell: true } as const;

/** True when the row is the Phase 1 named-hotel placeholder (not a priced rate). */
export function isStayShellLineItem(row: TripLineItem): boolean {
  const extracted = row.extracted_json;
  return Boolean(
    extracted &&
      typeof extracted === "object" &&
      (extracted as { stay_shell?: unknown }).stay_shell === true,
  );
}

/** Selected accommodation for a leg, if any. */
export async function findSelectedAccommodationLineItem(
  tripId: string,
  legId: string,
): Promise<TripLineItem | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_line_items")
      .select("*")
      .eq("trip_id", tripId)
      .eq("leg_id", legId)
      .eq("category", "accommodation")
      .eq("selected", true)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripLineItem | null;
}

/** Priced accommodation candidates on a trip (excludes stay-shell placeholders). */
export async function listPricedAccommodationLineItems(
  tripId: string,
  legId?: string | null,
): Promise<TripLineItem[]> {
  const supabase = getServiceClient();

  let query = supabase
    .from("trip_line_items")
    .select("*")
    .eq("trip_id", tripId)
    .eq("category", "accommodation")
    .not("cost_internal", "is", null)
    .order("created_at", { ascending: false });

  if (legId) {
    query = query.eq("leg_id", legId);
  }

  const { data, error } = await runSupabaseQuery(() => query);

  if (error) {
    throw dbQueryError(error);
  }

  const rows = (data ?? []) as TripLineItem[];
  return rows.filter((row) => !isStayShellLineItem(row));
}

/**
 * Drop rooms that were only on the options quote.
 * The chosen row is already selected. The stay shell has no cost, so it stays.
 */
export async function deleteUnselectedStayOptions(
  tripId: string,
  legId: string,
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_line_items")
      .delete()
      .eq("trip_id", tripId)
      .eq("leg_id", legId)
      .eq("category", "accommodation")
      .eq("selected", false)
      .not("cost_internal", "is", null),
  );
  if (error) throw dbQueryError(error);
}

/** Client-facing edits on a room saved for the options quote. */
export async function updateStayOption(
  lineItemId: string,
  patch: {
    sell_amount?: number | null;
    cancellation_policy?: string | null;
    inclusions?: string[];
  },
): Promise<TripLineItem | null> {
  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_line_items")
      .update(patch)
      .eq("id", lineItemId)
      .eq("category", "accommodation")
      .eq("selected", false)
      .select("*")
      .maybeSingle(),
  );
  if (error) throw dbQueryError(error);
  return data as TripLineItem | null;
}

/** Remove every line item on one stay (shell, rates, and the rest). */
export async function deleteLineItemsForLeg(
  tripId: string,
  legId: string,
): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase.from("trip_line_items").delete().eq("trip_id", tripId).eq("leg_id", legId),
  );

  if (error) {
    throw dbQueryError(error);
  }
}

/** Write adult and child counts onto the stay shell. Rooms stay as saved. */
export async function patchStayShellParty(
  tripId: string,
  legId: string,
  party: { adults: number; children: number },
): Promise<void> {
  const existing = await findStayShellLineItem(tripId, legId);
  if (!existing) return;
  const extracted = {
    ...(existing.extracted_json ?? {}),
    adults: party.adults,
    children: party.children,
  };
  const supabase = getServiceClient();
  const { error } = await runSupabaseQuery(() =>
    supabase.from("trip_line_items").update({ extracted_json: extracted }).eq("id", existing.id),
  );
  if (error) throw dbQueryError(error);
}

/** Clear selected flag on accommodation items for a leg. */
export async function clearSelectedAccommodationForLeg(
  tripId: string,
  legId: string,
): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_line_items")
      .update({ selected: false })
      .eq("trip_id", tripId)
      .eq("leg_id", legId)
      .eq("category", "accommodation")
      .eq("selected", true),
  );

  if (error) {
    throw dbQueryError(error);
  }
}

const AVAILABILITY = new Set<TripLineItemAvailabilityStatus>([
  "unknown",
  "available",
  "unavailable",
  "on_request",
]);

/** Copy rate facts onto the row when a search or paste stored them. */
export async function fillTripLineItemRateFacts(
  lineItemId: string,
  facts: {
    availability_status?: TripLineItemAvailabilityStatus | null;
    tax_percentage?: number | null;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (
    facts.availability_status &&
    AVAILABILITY.has(facts.availability_status)
  ) {
    patch.availability_status = facts.availability_status;
  }
  if (
    facts.tax_percentage != null &&
    Number.isFinite(facts.tax_percentage) &&
    facts.tax_percentage >= 0
  ) {
    patch.tax_percentage = facts.tax_percentage;
  }
  if (Object.keys(patch).length === 0) return;

  const supabase = getServiceClient();
  const { error } = await runSupabaseQuery(() =>
    supabase.from("trip_line_items").update(patch).eq("id", lineItemId),
  );

  if (error) throw dbQueryError(error);
}

/** Mark one accommodation line item selected (caller clears peers first). */
export async function setTripLineItemSelected(
  lineItemId: string,
  selected: boolean,
): Promise<TripLineItem | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_line_items")
      .update({ selected })
      .eq("id", lineItemId)
      .select("*")
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripLineItem | null;
}

/** Phase 1 stay shell for a leg (named hotel before rates), or null. */
export async function findStayShellLineItem(
  tripId: string,
  legId: string,
): Promise<TripLineItem | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_line_items")
      .select("*")
      .eq("trip_id", tripId)
      .eq("leg_id", legId)
      .eq("category", "accommodation")
      .eq("source", "manual")
      .eq("selected", false)
      .is("cost_internal", null)
      .is("sell_amount", null)
      .order("created_at", { ascending: false })
      .limit(20),
  );

  if (error) {
    throw dbQueryError(error);
  }

  const rows = (data ?? []) as TripLineItem[];
  return rows.find(isStayShellLineItem) ?? null;
}

export type UpsertStayShellInput = {
  trip_id: string;
  leg_id: string;
  property_id?: string | null;
  property_name: string;
  created_by_id?: string | null;
  adults?: number;
  children?: number;
  rooms?: number;
};

/**
 * Upsert the named-hotel stay shell on a leg.
 * Does not touch selected / priced rate options.
 */
export async function upsertStayShellLineItem(
  input: UpsertStayShellInput,
): Promise<TripLineItem> {
  const existing = await findStayShellLineItem(input.trip_id, input.leg_id);
  const supabase = getServiceClient();
  const title = input.property_name;
  const extracted = {
    ...STAY_SHELL_MARKER,
    adults: input.adults ?? null,
    children: input.children ?? null,
    rooms: input.rooms ?? null,
  };

  if (existing) {
    const { data, error } = await runSupabaseQuery(() =>
      supabase
        .from("trip_line_items")
        .update({
          title,
          property_id: input.property_id ?? null,
          property_name: input.property_name,
          extracted_json: extracted,
        })
        .eq("id", existing.id)
        .select("*")
        .single(),
    );

    if (error) {
      throw dbQueryError(error);
    }

    return data as TripLineItem;
  }

  return insertTripLineItem({
    trip_id: input.trip_id,
    leg_id: input.leg_id,
    category: "accommodation",
    title,
    property_id: input.property_id ?? null,
    property_name: input.property_name,
    status: "pending",
    selected: false,
    source: "manual",
    extracted_json: extracted,
    created_by_id: input.created_by_id ?? null,
  });
}

/** Point the stay shell at the hotel the client chose, without changing the party. */
export async function pointStayShellAtHotel(input: {
  trip_id: string;
  leg_id: string;
  property_id: string | null;
  property_name: string;
}): Promise<void> {
  const existing = await findStayShellLineItem(input.trip_id, input.leg_id);
  if (!existing) return;
  const supabase = getServiceClient();
  const { error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_line_items")
      .update({
        title: input.property_name,
        property_id: input.property_id,
        property_name: input.property_name,
      })
      .eq("id", existing.id),
  );
  if (error) throw dbQueryError(error);
}

/** Point the stay shell at a known property without touching party counts. */
export async function linkStayShellProperty(input: {
  trip_id: string;
  leg_id: string;
  property_id: string;
  property_name: string;
}): Promise<TripLineItem | null> {
  const existing = await findStayShellLineItem(input.trip_id, input.leg_id);
  if (!existing) return null;

  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_line_items")
      .update({
        title: input.property_name,
        property_id: input.property_id,
        property_name: input.property_name,
      })
      .eq("id", existing.id)
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripLineItem;
}
