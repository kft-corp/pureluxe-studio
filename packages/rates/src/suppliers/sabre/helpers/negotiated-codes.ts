import type { NegotiatedRateCode } from "@pureluxe/db";

/**
 * Active Sabre negotiated / consortia rate-plan codes for RatePlanCandidates.
 * Never invents codes — only trims DB rows.
 */
export function sabreRatePlanCodesFromRows(
  rows: NegotiatedRateCode[] | null | undefined,
): string[] {
  if (!rows || rows.length === 0) return [];

  const seen = new Set<string>();
  const codes: string[] = [];

  for (const row of rows) {
    const supplier = (row.supplier_key ?? "").trim().toLowerCase();
    if (supplier && supplier !== "sabre") continue;

    const code = (row.code ?? "").trim();
    if (!code) continue;

    const key = code.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    codes.push(code);
  }

  return codes;
}

/** True when a returned rate_plan_code matches a requested negotiated code. */
export function ratePlanMatchesRequested(
  ratePlanCode: string | null | undefined,
  requested: string[],
): boolean {
  if (!ratePlanCode?.trim() || requested.length === 0) return false;
  const needle = ratePlanCode.trim().toUpperCase();
  return requested.some((code) => code.trim().toUpperCase() === needle);
}
