import { getConfig, type SabreConfig } from "../config";
import { clearAccessTokenCache, getAccessToken } from "./auth";

export class SabreHttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "SabreHttpError";
    this.status = status;
    this.body = body;
  }
}

export type RequestJsonOptions = {
  method?: "GET" | "POST";
  path: string;
  body?: unknown;
  config?: SabreConfig;
};

/**
 * Authenticated Sabre JSON request (Bearer token).
 * Retries once on 401 after clearing the token cache.
 */
export async function requestJson<T = unknown>(
  options: RequestJsonOptions,
): Promise<T> {
  const config = options.config ?? getConfig();
  if (!config) {
    throw new Error("Sabre is not configured");
  }

  return requestJsonWithConfig<T>(config, options, true);
}

async function requestJsonWithConfig<T>(
  config: SabreConfig,
  options: RequestJsonOptions,
  retryOnUnauthorized: boolean,
): Promise<T> {
  const token = await getAccessToken(config);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}${options.path}`, {
      method: options.method ?? "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = text;
      }
    }

    if (response.status === 401 && retryOnUnauthorized) {
      clearAccessTokenCache();
      return requestJsonWithConfig<T>(config, options, false);
    }

    if (!response.ok) {
      const message =
        typeof parsed === "object" &&
        parsed !== null &&
        "message" in parsed &&
        typeof (parsed as { message: unknown }).message === "string"
          ? (parsed as { message: string }).message
          : `Sabre HTTP ${response.status}`;
      throw new SabreHttpError(message, response.status, parsed);
    }

    return parsed as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Sabre request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
