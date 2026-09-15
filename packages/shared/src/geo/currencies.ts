export type CurrencyOption = {
  /** ISO 4217 alpha code (e.g. USD, INR). */
  code: string;
  /** English display name. */
  name: string;
};

/**
 * Travel-useful ISO 4217 currencies for Studio commercial fields.
 * Curated (not every world code) so the picker stays fast and relevant.
 */
const CURRENCIES: readonly CurrencyOption[] = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "INR", name: "Indian Rupee" },
  { code: "AED", name: "UAE Dirham" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "THB", name: "Thai Baht" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "MVR", name: "Maldivian Rufiyaa" },
  { code: "MUR", name: "Mauritian Rupee" },
  { code: "SCR", name: "Seychellois Rupee" },
  { code: "ZAR", name: "South African Rand" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "OMR", name: "Omani Rial" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "KRW", name: "South Korean Won" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "LKR", name: "Sri Lankan Rupee" },
  { code: "NPR", name: "Nepalese Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "TZS", name: "Tanzanian Shilling" },
  { code: "UGX", name: "Ugandan Shilling" },
  { code: "RWF", name: "Rwandan Franc" },
  { code: "NAD", name: "Namibian Dollar" },
  { code: "BWP", name: "Botswana Pula" },
  { code: "FJD", name: "Fijian Dollar" },
  { code: "XPF", name: "CFP Franc" },
] as const;

const CURRENCY_BY_CODE = new Map(
  CURRENCIES.map((option) => [option.code, option]),
);

/** Currencies for commercial pickers (code A–Z). */
export function listCurrencyOptions(): CurrencyOption[] {
  return [...CURRENCIES].sort((a, b) => a.code.localeCompare(b.code, "en"));
}

/** True when value is a known Studio currency code. */
export function isValidCurrencyCode(
  code: string | null | undefined,
): boolean {
  if (!code) return false;
  return CURRENCY_BY_CODE.has(code.trim().toUpperCase());
}

/** English name for a currency code, or null if unknown. */
export function getCurrencyName(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  return CURRENCY_BY_CODE.get(code.trim().toUpperCase())?.name ?? null;
}

/** Uppercase ISO code, or null when empty. */
export function normalizeCurrencyCode(
  code: string | null | undefined,
): string | null {
  if (code == null) return null;
  const normalized = code.trim().toUpperCase();
  return normalized || null;
}
