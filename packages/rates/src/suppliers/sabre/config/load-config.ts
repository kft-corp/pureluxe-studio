/**
 * Sabre CERT/PROD env for Rate Layer (Stage 1).
 * Missing/partial env → not configured (adapter stays stub).
 */

export type SabreConfig = {
  baseUrl: string;
  eprUser: string;
  eprPass: string;
  pcc: string;
  codeContext: string;
  timeoutMs: number;
};

const DEFAULT_CODE_CONTEXT = "GLOBAL";
const DEFAULT_TIMEOUT_MS = 30_000;

function trimEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

function envFlagEnabled(raw: string, defaultWhenUnset: boolean): boolean {
  if (!raw) return defaultWhenUnset;
  const v = raw.toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return defaultWhenUnset;
}

/** True when all required Sabre secrets are present. */
export function isConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Open-GDS discover behind hotel_find (Stage 5).
 * Requires Sabre configured. Default ON; set SABRE_OPEN_GDS_BROWSE=0 to disable.
 */
export function isOpenGdsBrowseEnabled(): boolean {
  if (!isConfigured()) return false;
  return envFlagEnabled(trimEnv(process.env.SABRE_OPEN_GDS_BROWSE), true);
}

/** Min SabreRating for open-GDS discover (default 4). */
export function openGdsMinSabreRating(): string {
  const raw = trimEnv(process.env.SABRE_OPEN_GDS_MIN_RATING);
  if (!raw) return "4";
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < 0 || n > 5) return "4";
  return String(n);
}

/**
 * Read Sabre config from process.env.
 * Returns null when incomplete — callers must not invent credentials.
 */
export function getConfig(): SabreConfig | null {
  const baseUrl = trimEnv(process.env.SABRE_BASE_URL).replace(/\/+$/, "");
  const eprUser = trimEnv(process.env.SABRE_EPR_USER);
  const eprPass = trimEnv(process.env.SABRE_EPR_PASS);
  const pcc = trimEnv(process.env.SABRE_PCC);

  if (!baseUrl || !eprUser || !eprPass || !pcc) {
    return null;
  }

  const codeContext =
    trimEnv(process.env.SABRE_CODE_CONTEXT) || DEFAULT_CODE_CONTEXT;
  const timeoutRaw = trimEnv(process.env.SABRE_TIMEOUT_MS);
  const timeoutMs = timeoutRaw
    ? Number.parseInt(timeoutRaw, 10)
    : DEFAULT_TIMEOUT_MS;

  return {
    baseUrl,
    eprUser,
    eprPass,
    pcc,
    codeContext,
    timeoutMs:
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? timeoutMs
        : DEFAULT_TIMEOUT_MS,
  };
}
