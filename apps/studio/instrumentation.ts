/**
 * Runs once when the Next.js server process starts (local + Vercel).
 * Look for `[studio] project start` in Vercel function / runtime logs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  console.info("[studio] project start", {
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    hasAnthropicModel: Boolean(process.env.ANTHROPIC_MODEL?.trim()),
    hasAnthropicFallback: Boolean(process.env.ANTHROPIC_FALLBACK_MODEL?.trim()),
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL?.trim()),
    hasSessionSecret: Boolean(process.env.STUDIO_SESSION_SECRET?.trim()),
    hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
    hasGoogleRedirectUri: Boolean(process.env.GOOGLE_REDIRECT_URI?.trim()),
  });
}
