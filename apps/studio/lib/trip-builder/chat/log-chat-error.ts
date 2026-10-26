import { AppError } from "@pureluxe/shared";

/** One layer of a thrown value for server logs (no secrets). */
export type ChatErrorLayer = {
  name: string | null;
  code: string | null;
  message: string;
  status: number | null;
  stack: string | null;
};

function statusOf(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  if ("status" in value && typeof (value as { status: unknown }).status === "number") {
    return (value as { status: number }).status;
  }
  if (
    "statusCode" in value &&
    typeof (value as { statusCode: unknown }).statusCode === "number"
  ) {
    return (value as { statusCode: number }).statusCode;
  }
  return null;
}

function layerOf(cause: unknown): ChatErrorLayer {
  if (cause instanceof AppError) {
    return {
      name: cause.name,
      code: cause.code,
      message: cause.userMessage,
      status: cause.status,
      stack: cause.stack ?? null,
    };
  }
  if (cause instanceof Error) {
    return {
      name: cause.name,
      code: null,
      message: cause.message,
      status: statusOf(cause),
      stack: cause.stack ?? null,
    };
  }
  return {
    name: null,
    code: null,
    message: String(cause),
    status: statusOf(cause),
    stack: null,
  };
}

/** Safe summary of a thrown value, including nested `cause` (Anthropic / LangChain). */
export function chatErrorFields(cause: unknown): ChatErrorLayer & {
  cause: ChatErrorLayer | null;
} {
  const top = layerOf(cause);
  const nested =
    cause instanceof Error && cause.cause !== undefined ? layerOf(cause.cause) : null;
  return { ...top, cause: nested };
}

/** Whether agent-critical env vars are present (values never logged). */
export function chatEnvPresence(): {
  hasDatabaseUrl: boolean;
  hasAnthropicKey: boolean;
  hasAnthropicModel: boolean;
  hasAnthropicFallback: boolean;
  hasSupabaseUrl: boolean;
  hasSupabaseServiceRole: boolean;
} {
  return {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    hasAnthropicModel: Boolean(process.env.ANTHROPIC_MODEL?.trim()),
    hasAnthropicFallback: Boolean(process.env.ANTHROPIC_FALLBACK_MODEL?.trim()),
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL?.trim()),
    hasSupabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  };
}

/** Log a trip / home chat failure so Vercel / Netlify function logs show the cause. */
export function logChatFailure(
  scope: string,
  details: Record<string, unknown> & { cause?: unknown },
): void {
  const { cause, ...rest } = details;
  console.error(`[trip-chat] ${scope}`, {
    ...rest,
    env: chatEnvPresence(),
    ...(cause !== undefined ? { error: chatErrorFields(cause) } : {}),
  });
}
