import { getConfig, type SabreConfig } from "../config";

type CachedToken = {
  accessToken: string;
  /** Epoch ms when we should refresh (before Sabre expiry). */
  refreshAtMs: number;
};

let cached: CachedToken | null = null;

/** Skew so we refresh slightly before Sabre expires_in. */
const REFRESH_SKEW_MS = 60_000;

function toBase64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

/**
 * Sabre V2 Basic auth: Base64( Base64(epr_user) + ":" + Base64(epr_pass) ).
 * Matches Postman / docs §8.
 */
export function buildBasicAuthHeader(config: SabreConfig): string {
  return toBase64(`${toBase64(config.eprUser)}:${toBase64(config.eprPass)}`);
}

type TokenResponse = {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
};

/**
 * Cached Sabre access token. Refreshes before expiry.
 * Throws on auth failure — never invents a token.
 */
export async function getAccessToken(config?: SabreConfig): Promise<string> {
  const resolved = config ?? getConfig();
  if (!resolved) {
    throw new Error("Sabre is not configured");
  }

  const now = Date.now();
  if (cached && cached.refreshAtMs > now) {
    return cached.accessToken;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), resolved.timeoutMs);

  try {
    const response = await fetch(`${resolved.baseUrl}/v2/auth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${buildBasicAuthHeader(resolved)}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => ({}))) as TokenResponse;

    if (!response.ok || !body.access_token) {
      const detail =
        body.error_description || body.error || `HTTP ${response.status}`;
      cached = null;
      throw new Error(`Sabre auth failed: ${detail}`);
    }

    const expiresInSec = Number(body.expires_in);
    const ttlMs =
      Number.isFinite(expiresInSec) && expiresInSec > 0
        ? expiresInSec * 1000
        : 600_000;

    cached = {
      accessToken: body.access_token,
      refreshAtMs: now + Math.max(ttlMs - REFRESH_SKEW_MS, 30_000),
    };

    return cached.accessToken;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      cached = null;
      throw new Error("Sabre auth timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Test helper — clear cached token. */
export function clearAccessTokenCache(): void {
  cached = null;
}
