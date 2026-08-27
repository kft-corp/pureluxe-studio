import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "../validation";

/** Server-only Supabase client — never use in the browser. */
export function createServiceClient(): SupabaseClient {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getSupabaseEnv();

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
