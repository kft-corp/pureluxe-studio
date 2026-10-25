/**
 * Contract policies schema_version 2 (Stage 4 / R3).
 * Each rule is marked client or team so team-only text never reaches the client PDF.
 * Readers still accept legacy v1 free-text arrays until ops clean up and VALIDATE the DB check.
 */

export type PolicyAudience = "client" | "team";

export type PolicyRuleV2 = {
  text: string;
  audience: PolicyAudience;
  /** Optional structured fields (cancel days, charge %, season, clock times). */
  cancel_days?: number;
  charge_pct?: number;
  season?: string;
  check_in_time?: string;
  check_out_time?: string;
};

export type ContractPoliciesV2 = {
  schema_version: 2;
  stay?: PolicyRuleV2[];
  payment?: PolicyRuleV2[];
  cancellation?: PolicyRuleV2[];
  transfer?: PolicyRuleV2[];
  legal?: PolicyRuleV2[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asAudience(value: unknown): PolicyAudience | null {
  return value === "client" || value === "team" ? value : null;
}

function asRule(value: unknown): PolicyRuleV2 | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? { text, audience: "client" } : null;
  }
  if (!isRecord(value)) return null;
  const text = typeof value.text === "string" ? value.text.trim() : "";
  const audience = asAudience(value.audience) ?? "client";
  if (!text && value.cancel_days == null && value.charge_pct == null) return null;
  return {
    text:
      text ||
      (typeof value.cancel_days === "number"
        ? `Cancel within ${value.cancel_days} days${
            typeof value.charge_pct === "number" ? ` · ${value.charge_pct}%` : ""
          }`
        : ""),
    audience,
    ...(typeof value.cancel_days === "number" ? { cancel_days: value.cancel_days } : {}),
    ...(typeof value.charge_pct === "number" ? { charge_pct: value.charge_pct } : {}),
    ...(typeof value.season === "string" && value.season.trim()
      ? { season: value.season.trim() }
      : {}),
    ...(typeof value.check_in_time === "string" && value.check_in_time.trim()
      ? { check_in_time: value.check_in_time.trim() }
      : {}),
    ...(typeof value.check_out_time === "string" && value.check_out_time.trim()
      ? { check_out_time: value.check_out_time.trim() }
      : {}),
  };
}

function asRules(value: unknown): PolicyRuleV2[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const rule = asRule(row);
    return rule ? [rule] : [];
  });
}

/** True when policies already declare schema_version >= 2. */
export function isPoliciesV2(policies: unknown): boolean {
  if (!isRecord(policies)) return false;
  const version = policies.schema_version;
  return typeof version === "number" && version >= 2;
}

/**
 * Read policies as v2 rules. Legacy v1 (stay_rules / payment_rules / …) is mapped
 * with audience "client" so existing contracts keep working until clean-up.
 */
export function readContractPolicies(policies: unknown): ContractPoliciesV2 {
  if (!isRecord(policies)) {
    return { schema_version: 2 };
  }
  if (isPoliciesV2(policies)) {
    return {
      schema_version: 2,
      stay: asRules(policies.stay),
      payment: asRules(policies.payment),
      cancellation: asRules(policies.cancellation),
      transfer: asRules(policies.transfer),
      legal: asRules(policies.legal),
    };
  }

  // Legacy: free-text / loosely typed arrays + top-level check-in times.
  const stay = asRules(policies.stay_rules);
  const checkIn =
    typeof policies.check_in_time === "string" ? policies.check_in_time.trim() : "";
  const checkOut =
    typeof policies.check_out_time === "string" ? policies.check_out_time.trim() : "";
  if (checkIn || checkOut) {
    stay.unshift({
      text: [checkIn ? `Check-in ${checkIn}` : null, checkOut ? `Check-out ${checkOut}` : null]
        .filter(Boolean)
        .join(" · "),
      audience: "client",
      ...(checkIn ? { check_in_time: checkIn } : {}),
      ...(checkOut ? { check_out_time: checkOut } : {}),
    });
  }

  const payment = asRules(policies.payment_rules).filter(
    (rule) => !/\bcancel/i.test(rule.text) && rule.cancel_days == null,
  );
  const cancellation = asRules(policies.payment_rules).filter(
    (rule) => /\bcancel/i.test(rule.text) || rule.cancel_days != null,
  );
  const transfer = asRules(policies.transfer_policies);
  const legal = isRecord(policies.legal)
    ? Object.values(policies.legal).flatMap((row) => {
        const rule = asRule(typeof row === "string" ? row : null);
        return rule ? [rule] : [];
      })
    : [];

  return {
    schema_version: 2,
    stay,
    payment,
    cancellation,
    transfer,
    legal,
  };
}

/** Client-facing cancel lines from v2 (or legacy mapped) policies. */
export function cancellationLinesFromPoliciesV2(policies: unknown): string[] {
  const parsed = readContractPolicies(policies);
  const lines: string[] = [];
  for (const rule of parsed.cancellation ?? []) {
    if (rule.audience === "team") continue;
    const season = rule.season?.trim() ?? "";
    const cancel = rule.cancel_days;
    const charge = rule.charge_pct;
    if (cancel != null || charge != null) {
      const detail =
        cancel != null && charge != null
          ? `cancel within ${cancel} days and the charge is ${charge}%`
          : cancel != null
            ? `cancel within ${cancel} days`
            : `cancellation charge is ${charge}%`;
      lines.push(
        season
          ? `${season.charAt(0).toUpperCase()}${season.slice(1)}: ${detail}.`
          : `${detail.charAt(0).toUpperCase()}${detail.slice(1)}.`,
      );
      continue;
    }
    const text = rule.text.trim();
    if (text) lines.push(text.endsWith(".") ? text : `${text}.`);
  }
  return lines;
}

/**
 * Lift a legacy policies blob to schema_version 2 without inventing rules.
 * Ops review the result before saving; the DB constraint stays NOT VALID until then.
 */
export function upgradePoliciesToV2(policies: unknown): ContractPoliciesV2 {
  return readContractPolicies(policies);
}
