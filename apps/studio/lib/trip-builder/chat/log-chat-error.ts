import { AppError } from "@pureluxe/shared";

/** Safe summary of a thrown value for Netlify / server logs (no secrets). */
export function chatErrorFields(cause: unknown): {
  name: string | null;
  code: string | null;
  message: string;
  stack: string | null;
} {
  if (cause instanceof AppError) {
    return {
      name: cause.name,
      code: cause.code,
      message: cause.userMessage,
      stack: cause.stack ?? null,
    };
  }
  if (cause instanceof Error) {
    return {
      name: cause.name,
      code: null,
      message: cause.message,
      stack: cause.stack ?? null,
    };
  }
  return {
    name: null,
    code: null,
    message: String(cause),
    stack: null,
  };
}

/** Whether agent-critical env vars are present (values never logged). */
export function chatEnvPresence(): {
  hasDatabaseUrl: boolean;
  hasAnthropicKey: boolean;
  hasAnthropicModel: boolean;
  hasSupabaseUrl: boolean;
  hasSupabaseServiceRole: boolean;
} {
  return {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    hasAnthropicModel: Boolean(process.env.ANTHROPIC_MODEL?.trim()),
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL?.trim()),
    hasSupabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  };
}

/** Log a trip / home chat failure so Netlify function logs show the cause. */
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
