import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  PropertyContract,
  PropertyContractOffer,
  PropertyRateAddon,
} from "../../schema";

/** YYYY-MM-DD minus one calendar day (UTC date parts). */
function previousCalendarDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function coversStay(
  validFrom: string | null,
  validTo: string | null,
  checkIn: string,
  lastNight: string,
): boolean {
  const fromOk = validFrom == null || validFrom <= checkIn;
  const toOk = validTo == null || validTo >= lastNight;
  return fromOk && toOk;
}

export type ListContractRowsForStayInput = {
  property_id: string;
  check_in: string;
  check_out: string;
  contract_id?: string | null;
};

/** Active contracts for a property. */
export async function listActivePropertyContractsForProperty(
  propertyId: string,
): Promise<PropertyContract[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("property_contracts")
      .select("*")
      .eq("property_id", propertyId)
      .eq("active", true),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as PropertyContract[];
}

/** Active add-ons covering the stay dates (for Settings / quote extras later). */
export async function listActiveRateAddonsForStay(
  input: ListContractRowsForStayInput,
): Promise<PropertyRateAddon[]> {
  const supabase = getServiceClient();

  let query = supabase
    .from("property_rate_addons")
    .select("*")
    .eq("property_id", input.property_id)
    .eq("active", true);

  if (input.contract_id) {
    query = query.eq("contract_id", input.contract_id);
  }

  const { data, error } = await runSupabaseQuery(() => query);

  if (error) {
    throw dbQueryError(error);
  }

  const lastNight = previousCalendarDay(input.check_out);
  return ((data ?? []) as PropertyRateAddon[]).filter((row) =>
    coversStay(row.valid_from, row.valid_to, input.check_in, lastNight),
  );
}

/** Active offers covering the stay dates (for Settings / quote extras later). */
export async function listActiveContractOffersForStay(
  input: ListContractRowsForStayInput,
): Promise<PropertyContractOffer[]> {
  const supabase = getServiceClient();

  let query = supabase
    .from("property_contract_offers")
    .select("*")
    .eq("property_id", input.property_id)
    .eq("active", true);

  if (input.contract_id) {
    query = query.eq("contract_id", input.contract_id);
  }

  const { data, error } = await runSupabaseQuery(() => query);

  if (error) {
    throw dbQueryError(error);
  }

  const lastNight = previousCalendarDay(input.check_out);
  return ((data ?? []) as PropertyContractOffer[]).filter((row) =>
    coversStay(row.valid_from, row.valid_to, input.check_in, lastNight),
  );
}
