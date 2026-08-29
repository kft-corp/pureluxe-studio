import { z } from "zod";

import { authConfigError } from "../errors";

/** Studio Google OAuth + session env vars (server only). */
export const studioAuthEnvSchema = z.object({
  STUDIO_SESSION_SECRET: z
    .string()
    .min(32, { message: "STUDIO_SESSION_SECRET must be at least 32 characters" }),
  GOOGLE_CLIENT_ID: z.string().min(1, { message: "GOOGLE_CLIENT_ID is required" }),
  GOOGLE_CLIENT_SECRET: z
    .string()
    .min(1, { message: "GOOGLE_CLIENT_SECRET is required" }),
  GOOGLE_REDIRECT_URI: z
    .string()
    .url({ message: "GOOGLE_REDIRECT_URI must be a valid URL" }),
});

export type StudioAuthEnv = z.infer<typeof studioAuthEnvSchema>;

/** Validated env — cached after first read in this server process. */
let cachedEnv: StudioAuthEnv | null = null;

/** Read and validate Studio auth env from process.env. */
export function getStudioAuthEnv(): StudioAuthEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = studioAuthEnvSchema.safeParse({
    STUDIO_SESSION_SECRET: process.env.STUDIO_SESSION_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  });

  if (!result.success) {
    throw authConfigError(result.error);
  }

  cachedEnv = result.data;
  return cachedEnv;
}
