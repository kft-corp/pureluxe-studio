import { z } from "zod";

import { dbConfigError } from "../errors";

/** Direct Postgres connection (server only). Supabase pooler in transaction mode on Vercel. */
export const databaseEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .trim()
    .min(1, { message: "DATABASE_URL is required" })
    .regex(/^postgres(?:ql)?:\/\//, {
      message: "DATABASE_URL must be a postgres:// connection string",
    }),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

let cachedEnv: DatabaseEnv | null = null;

/** True when a direct Postgres connection is configured. */
export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** Read and validate DATABASE_URL from process.env. Cached for the process. */
export function getDatabaseEnv(): DatabaseEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = databaseEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
  });

  if (!result.success) {
    throw dbConfigError(result.error);
  }

  cachedEnv = result.data;
  return cachedEnv;
}
