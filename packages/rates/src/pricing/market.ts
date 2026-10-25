/**
 * R11: an India-only (or other market-restricted) contract is never shown to a
 * client from another market. Empty market_codes = all markets. Unknown client
 * market (no codes) leaves restricted contracts visible so the advisor can still
 * search before the lead is set.
 */
export function contractAllowedForMarket(
  marketCodes: string[] | null | undefined,
  clientMarketCodes: string[] | null | undefined,
): boolean {
  const allowed = (marketCodes ?? [])
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  if (allowed.length === 0) return true;

  const client = (clientMarketCodes ?? [])
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  if (client.length === 0) return true;

  return client.some((code) => allowed.includes(code));
}
