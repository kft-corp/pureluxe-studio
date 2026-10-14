import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { NegotiatedRateCode } from "../../schema";

/** Active negotiated / consortia GDS codes for adapters. */
export async function listActiveNegotiatedRateCodes(): Promise<
  NegotiatedRateCode[]
> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("negotiated_rate_codes")
      .select("*")
      .eq("active", true)
      .order("label", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as NegotiatedRateCode[];
}
