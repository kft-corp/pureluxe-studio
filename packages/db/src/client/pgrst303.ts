import type { PostgrestError } from "@supabase/supabase-js";

const PGRST303 = "PGRST303";
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

/** PostgREST clock-drift error — common with opaque sb_secret_ keys. */
export function isPgrst303Error(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown };
  return (
    record.code === PGRST303 ||
    (typeof record.message === "string" &&
      record.message.includes("JWT issued at future"))
  );
}

type SupabaseResult<T> = {
  data: T;
  error: PostgrestError | null;
};

/** Retry transient PGRST303 failures from Supabase gateway clock skew. */
export async function runSupabaseQuery<T>(
  execute: () => PromiseLike<SupabaseResult<T>>,
): Promise<SupabaseResult<T>> {
  let result = await execute();

  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
    if (!result.error || !isPgrst303Error(result.error)) {
      return result;
    }

    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[db] PGRST303 on attempt ${attempt}/${MAX_ATTEMPTS} — retrying…`,
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, RETRY_DELAY_MS * attempt),
    );
    result = await execute();
  }

  return result;
}
