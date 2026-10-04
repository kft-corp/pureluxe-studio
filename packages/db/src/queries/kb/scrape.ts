/**
 * Scrape scheduler audit (Settings Run + internal cron).
 * Jobs must never overwrite advisor_take or promote to kb_verified.
 */
import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  KbScrapeJob,
  KbScrapeRun,
  KbScrapeRunStatus,
} from "../../schema";

export async function listKbScrapeJobs(input?: {
  active_only?: boolean;
}): Promise<KbScrapeJob[]> {
  const supabase = getServiceClient();

  let query = supabase
    .from("kb_scrape_jobs")
    .select("*")
    .order("created_at", { ascending: true });

  if (input?.active_only) {
    query = query.eq("active", true);
  }

  const { data, error } = await runSupabaseQuery(() => query);

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbScrapeJob[];
}

export async function findKbScrapeJobById(
  jobId: string,
): Promise<KbScrapeJob | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase.from("kb_scrape_jobs").select("*").eq("id", jobId).maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbScrapeJob | null;
}

export async function findKbScrapeJobBySourceId(
  sourceId: string,
): Promise<KbScrapeJob | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_scrape_jobs")
      .select("*")
      .eq("source_id", sourceId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbScrapeJob | null;
}

export type UpsertKbScrapeJobInput = {
  source_id: string;
  cron_expression?: string | null;
  active?: boolean;
};

export async function upsertKbScrapeJob(
  input: UpsertKbScrapeJobInput,
): Promise<KbScrapeJob> {
  const existing = await findKbScrapeJobBySourceId(input.source_id);
  const supabase = getServiceClient();

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (input.cron_expression !== undefined) {
      patch.cron_expression = input.cron_expression;
    }
    if (input.active !== undefined) {
      patch.active = input.active;
    }

    if (Object.keys(patch).length === 0) {
      return existing;
    }

    const { data, error } = await runSupabaseQuery(() =>
      supabase
        .from("kb_scrape_jobs")
        .update(patch)
        .eq("id", existing.id)
        .select("*")
        .single(),
    );

    if (error) {
      throw dbQueryError(error);
    }

    return data as KbScrapeJob;
  }

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_scrape_jobs")
      .insert({
        source_id: input.source_id,
        cron_expression: input.cron_expression ?? null,
        active: input.active ?? true,
      })
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbScrapeJob;
}

export async function updateKbScrapeJobAfterRun(input: {
  job_id: string;
  last_status: string;
  last_run_at?: string;
}): Promise<KbScrapeJob | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_scrape_jobs")
      .update({
        last_status: input.last_status,
        last_run_at: input.last_run_at ?? new Date().toISOString(),
      })
      .eq("id", input.job_id)
      .select("*")
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbScrapeJob | null;
}

export type InsertKbScrapeRunInput = {
  job_id: string;
  status?: KbScrapeRunStatus;
  pages_fetched?: number;
  entities_saved?: number;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
};

export async function insertKbScrapeRun(
  input: InsertKbScrapeRunInput,
): Promise<KbScrapeRun> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_scrape_runs")
      .insert({
        job_id: input.job_id,
        started_at: new Date().toISOString(),
        status: input.status ?? "ok",
        pages_fetched: input.pages_fetched ?? 0,
        entities_saved: input.entities_saved ?? 0,
        error_message: input.error_message ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbScrapeRun;
}

export async function finishKbScrapeRun(input: {
  run_id: string;
  status: KbScrapeRunStatus;
  pages_fetched?: number;
  entities_saved?: number;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<KbScrapeRun | null> {
  const supabase = getServiceClient();

  const patch: Record<string, unknown> = {
    status: input.status,
    finished_at: new Date().toISOString(),
  };

  if (input.pages_fetched !== undefined) {
    patch.pages_fetched = input.pages_fetched;
  }
  if (input.entities_saved !== undefined) {
    patch.entities_saved = input.entities_saved;
  }
  if (input.error_message !== undefined) {
    patch.error_message = input.error_message;
  }
  if (input.metadata !== undefined) {
    patch.metadata = input.metadata;
  }

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_scrape_runs")
      .update(patch)
      .eq("id", input.run_id)
      .select("*")
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbScrapeRun | null;
}

export async function listKbScrapeRunsForJob(input: {
  job_id: string;
  limit?: number;
}): Promise<KbScrapeRun[]> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_scrape_runs")
      .select("*")
      .eq("job_id", input.job_id)
      .order("started_at", { ascending: false })
      .limit(limit),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbScrapeRun[];
}
