import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "../validation";

/** Reused for the lifetime of this server process (singleton). */
let serviceClient: SupabaseClient | null = null;

/** Server-only Supabase client — created once, then reused. Never use in the browser. */
export function getServiceClient(): SupabaseClient {
  if (serviceClient) {
    return serviceClient;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getSupabaseEnv();

  serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serviceClient;
}

/** Alias for getServiceClient — prefer getServiceClient in new code. */
export const createServiceClient = getServiceClient;
