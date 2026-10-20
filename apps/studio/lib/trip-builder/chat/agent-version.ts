import { hasDatabaseUrl, type AgentVersion } from "@pureluxe/db";

/** Everyone gets agent v2 when the list is exactly this. For local testing only. */
const EVERYONE = "*";

let cached: { raw: string; ids: ReadonlySet<string> } | null = null;

/** Team member ids from TRIP_AGENT_V2_MEMBER_IDS (comma or space separated). */
function pilotMemberIds(): ReadonlySet<string> {
  const raw = process.env.TRIP_AGENT_V2_MEMBER_IDS?.trim() ?? "";
  if (cached?.raw !== raw) {
    cached = {
      raw,
      ids: new Set(raw.split(/[\s,]+/).map((id) => id.trim().toLowerCase()).filter(Boolean)),
    };
  }
  return cached.ids;
}

let warnedNoDatabase = false;

/**
 * Which Trip Builder agent answers this advisor. v2 needs DATABASE_URL for its
 * saved progress; without it the pilot falls back to v1 so chat keeps working.
 */
export function tripAgentVersionFor(memberId: string): AgentVersion {
  const ids = pilotMemberIds();
  const enabled = ids.has(EVERYONE) || ids.has(memberId.toLowerCase());
  if (!enabled) return "v1";
  if (hasDatabaseUrl()) return "v2";
  if (!warnedNoDatabase) {
    warnedNoDatabase = true;
    console.warn("[agent] TRIP_AGENT_V2_MEMBER_IDS is set but DATABASE_URL is missing; using v1.");
  }
  return "v1";
}
