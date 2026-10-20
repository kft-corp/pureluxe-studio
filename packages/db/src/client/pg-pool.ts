import { Pool } from "pg";

import { getDatabaseEnv } from "../validation";

/** Small per-instance pool: serverless functions start often and share the Supabase pooler. */
const POOL_MAX = 3;
const IDLE_TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 5_000;

let pool: Pool | null = null;

/**
 * Server-only Postgres pool on DATABASE_URL — created once, then reused.
 * For work the Supabase web client can't do (agent checkpoints).
 * Import from "@pureluxe/db/pg", never the package root: the root is reachable
 * from client components and `pg` can't be bundled for the browser.
 */
export function getPgPool(): Pool {
  if (pool) {
    return pool;
  }

  const { DATABASE_URL } = getDatabaseEnv();

  pool = new Pool({
    connectionString: DATABASE_URL,
    max: POOL_MAX,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    allowExitOnIdle: true,
  });

  // An idle client can drop (pooler restart). Without a listener Node exits the process.
  pool.on("error", (cause) => {
    console.error("[db] idle postgres client error:", cause.message);
  });

  return pool;
}
