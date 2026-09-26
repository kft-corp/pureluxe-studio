export type MarginResult = {
  cost: number;
  sell: number;
  margin: number;
  /** Null when sell is 0. */
  margin_pct: number | null;
};

/**
 * Team-only margin: sell − cost.
 * Never expose this on guest rates.
 */
export function computeMargin(cost: number, sell: number): MarginResult {
  const margin = sell - cost;
  const margin_pct =
    sell === 0 ? null : Number(((margin / sell) * 100).toFixed(2));

  return { cost, sell, margin, margin_pct };
}
