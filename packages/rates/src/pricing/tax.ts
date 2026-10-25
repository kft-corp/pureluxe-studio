import { roundMoney } from "./dates";

/**
 * Service charge and tax on top of room + required charges (R10).
 * Maldives-style: tax on (room + service charge) when tax_on_service_charge.
 */
export function applyServiceChargeAndTax(input: {
  net: number;
  taxes_included: boolean;
  service_charge_pct: number | null;
  tax_pct: number | null;
  tax_on_service_charge: boolean;
}): {
  service_charge: number;
  tax: number;
  all_in: number;
} {
  const net = Math.max(0, input.net);
  if (input.taxes_included) {
    return { service_charge: 0, tax: 0, all_in: roundMoney(net) };
  }

  const scPct =
    input.service_charge_pct != null && Number.isFinite(Number(input.service_charge_pct))
      ? Number(input.service_charge_pct)
      : 0;
  const taxPct =
    input.tax_pct != null && Number.isFinite(Number(input.tax_pct))
      ? Number(input.tax_pct)
      : 0;

  const service_charge = roundMoney(net * (scPct / 100));
  const taxBase = input.tax_on_service_charge ? net + service_charge : net;
  const tax = roundMoney(taxBase * (taxPct / 100));
  return {
    service_charge,
    tax,
    all_in: roundMoney(net + service_charge + tax),
  };
}
