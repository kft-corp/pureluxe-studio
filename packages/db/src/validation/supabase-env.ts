import { z } from "zod";

import { dbConfigError } from "../errors";

/** Supabase connection env vars (server only). */
export const supabaseEnvSchema = z.object({
  SUPABASE_URL: z
    .string()
    .min(1)
    .url({ message: "SUPABASE_URL must be a valid URL" }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, { message: "SUPABASE_SERVICE_ROLE_KEY is required" }),
});

export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;

/** Validated env — cached after first read in this server process. */
let cachedEnv: SupabaseEnv | null = null;

/** Read and validate Supabase env from process.env. */
export function getSupabaseEnv(): SupabaseEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = supabaseEnvSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!result.success) {
    throw dbConfigError(result.error);
  }

  cachedEnv = result.data;
  return cachedEnv;
}
