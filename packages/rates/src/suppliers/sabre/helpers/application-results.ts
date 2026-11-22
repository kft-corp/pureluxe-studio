import { asArray, asRecord, asString } from "./json";

export type SabreApplicationResult = {
  status: string | null;
  severity: "warning" | "error" | "unknown";
  code: string | null;
  message: string | null;
};

function firstMessage(
  block: Record<string, unknown> | null,
): { code: string | null; message: string | null } {
  if (!block) return { code: null, message: null };

  const systems = asArray(block.SystemSpecificResults);
  for (const systemRow of systems) {
    const system = asRecord(systemRow);
    if (!system) continue;
    const messages = asArray(system.Message);
    for (const msgRow of messages) {
      const msg = asRecord(msgRow);
      if (msg) {
        return {
          code: asString(msg.code) ?? asString(msg.Code),
          message: asString(msg.value) ?? asString(msg.Value) ?? asString(msg),
        };
      }
      if (typeof msgRow === "string" && msgRow.trim()) {
        return { code: null, message: msgRow.trim() };
      }
    }
  }

  return {
    code: asString(block.code) ?? asString(block.Code),
    message: asString(block.ShortText) ?? asString(block.message),
  };
}

/**
 * Read Sabre GetHotelAvail ApplicationResults (Warning / Error).
 * Returns null when the block is missing.
 */
export function readApplicationResults(
  response: unknown,
): SabreApplicationResult | null {
  const root = asRecord(response);
  const rs = asRecord(root?.GetHotelAvailRS) ?? root;
  if (!rs) return null;

  const app = asRecord(rs.ApplicationResults);
  if (!app) return null;

  const status = asString(app.status) ?? asString(app.Status);
  const error = asRecord(asArray(app.Error)[0] ?? app.Error);
  const warning = asRecord(asArray(app.Warning)[0] ?? app.Warning);

  if (error) {
    const { code, message } = firstMessage(error);
    return { status, severity: "error", code, message };
  }

  if (warning) {
    const { code, message } = firstMessage(warning);
    return { status, severity: "warning", code, message };
  }

  if (!status) return null;
  return { status, severity: "unknown", code: null, message: null };
}

/**
 * True when Sabre clearly signals no sellable inventory for the stay
 * (e.g. WARN.0001) — skip a wasted Details call.
 */
export function isNoInventoryResult(
  app: SabreApplicationResult | null | undefined,
): boolean {
  if (!app) return false;

  const code = (app.code ?? "").toUpperCase();
  if (code.includes("WARN.0001") || code === "WARN0001") {
    return true;
  }

  const message = (app.message ?? "").toLowerCase();
  return (
    /no availability|not available|no rates|no hotel availability|unable to (find|process).*avail/i.test(
      message,
    ) || /inventory.*(not|un)available/i.test(message)
  );
}
