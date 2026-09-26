import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  Property,
  PropertyContractedRate,
  PropertySupplierCode,
} from "../../schema";

/** Active curated hotel by id. */
export async function findActivePropertyById(
  propertyId: string,
): Promise<Property | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .eq("active", true)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as Property | null;
}

/** Active supplier codes for one property (Sabre, Hotelbeds, …). */
export async function listActiveSupplierCodesForProperty(
  propertyId: string,
): Promise<PropertySupplierCode[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("property_supplier_codes")
      .select("*")
      .eq("property_id", propertyId)
      .eq("active", true)
      .order("supplier_key", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as PropertySupplierCode[];
}

export type FindContractedRateInput = {
  property_id: string;
  check_in: string;
  check_out: string;
};

/** YYYY-MM-DD minus one calendar day (UTC date parts). */
function previousCalendarDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Layer 1: active contracted rate whose date band covers the stay.
 * Stay nights are [check_in, check_out) — same as peak windows.
 * If several match, prefer the narrowest band (latest valid_from).
 */
export async function findActiveContractedRateForStay(
  input: FindContractedRateInput,
): Promise<PropertyContractedRate | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("property_contracted_rates")
      .select("*")
      .eq("property_id", input.property_id)
      .eq("active", true),
  );

  if (error) {
    throw dbQueryError(error);
  }

  const rows = (data ?? []) as PropertyContractedRate[];
  const lastNight = previousCalendarDay(input.check_out);

  const covering = rows.filter((row) => {
    const fromOk = row.valid_from == null || row.valid_from <= input.check_in;
    const toOk = row.valid_to == null || row.valid_to >= lastNight;
    return fromOk && toOk;
  });

  if (covering.length === 0) return null;

  covering.sort((a, b) => {
    const aFrom = a.valid_from ?? "";
    const bFrom = b.valid_from ?? "";
    return bFrom.localeCompare(aFrom);
  });

  return covering[0] ?? null;
}

/** Property plus active supplier codes (one round-trip pair for the resolver). */
export type PropertyWithSupplierCodes = {
  property: Property;
  supplier_codes: PropertySupplierCode[];
};

export async function findActivePropertyWithSupplierCodes(
  propertyId: string,
): Promise<PropertyWithSupplierCodes | null> {
  const property = await findActivePropertyById(propertyId);
  if (!property) return null;

  const supplier_codes = await listActiveSupplierCodesForProperty(propertyId);
  return { property, supplier_codes };
}
