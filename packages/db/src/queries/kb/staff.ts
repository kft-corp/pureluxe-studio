/**
 * Studio-only staff knowledge (internal notes + anonymous feedback).
 * Never SELECT these in client/PDF builders — @pureluxe/kb strips for view=client.
 */
import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { KbCustomerFeedback, KbInternalNote } from "../../schema";

/** Staff working notes for one entity (newest first). */
export async function listKbInternalNotesForEntity(
  entityId: string,
): Promise<KbInternalNote[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_internal_notes")
      .select("*")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbInternalNote[];
}

export type InsertKbInternalNoteInput = {
  entity_id: string;
  body: string;
  author_id?: string | null;
};

export async function insertKbInternalNote(
  input: InsertKbInternalNoteInput,
): Promise<KbInternalNote> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_internal_notes")
      .insert({
        entity_id: input.entity_id,
        body: input.body.trim(),
        author_id: input.author_id ?? null,
      })
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbInternalNote;
}

/** Anonymous post-trip feedback (newest first). */
export async function listKbCustomerFeedbackForEntity(
  entityId: string,
): Promise<KbCustomerFeedback[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_customer_feedback")
      .select("*")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbCustomerFeedback[];
}

export type InsertKbCustomerFeedbackInput = {
  entity_id: string;
  trip_id?: string | null;
  rating?: number | null;
  comments?: string | null;
  category_tags?: string[];
};

export async function insertKbCustomerFeedback(
  input: InsertKbCustomerFeedbackInput,
): Promise<KbCustomerFeedback> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_customer_feedback")
      .insert({
        entity_id: input.entity_id,
        trip_id: input.trip_id ?? null,
        rating: input.rating ?? null,
        comments: input.comments ?? null,
        category_tags: input.category_tags ?? [],
        advisor_reviewed: false,
        used_in_advisor_take: false,
      })
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbCustomerFeedback;
}

/**
 * Mark feedback as used when writing advisor_take (human only).
 * Does not copy comments into advisor_take — caller must PATCH entity separately.
 */
export async function markKbFeedbackUsedInAdvisorTake(
  feedbackId: string,
): Promise<KbCustomerFeedback | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_customer_feedback")
      .update({
        used_in_advisor_take: true,
        advisor_reviewed: true,
      })
      .eq("id", feedbackId)
      .select("*")
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbCustomerFeedback | null;
}
