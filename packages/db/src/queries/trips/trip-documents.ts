import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  TripDocument,
  TripDocumentStatus,
  TripDocumentType,
} from "../../schema";

const DOCUMENT_COLUMNS = [
  "id",
  "trip_id",
  "type",
  "file_path",
  "status",
  "generated_at",
  "source_updated_at",
  "source_fingerprint",
  "narrative_json",
  "generated_by_id",
  "updated_at",
].join(", ");

/** Find the document row for a trip + type. */
export async function findTripDocument(
  tripId: string,
  type: TripDocumentType,
): Promise<TripDocument | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_documents")
      .select(DOCUMENT_COLUMNS)
      .eq("trip_id", tripId)
      .eq("type", type)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripDocument | null;
}

/** List all documents for a trip. */
export async function listTripDocuments(
  tripId: string,
): Promise<TripDocument[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_documents")
      .select(DOCUMENT_COLUMNS)
      .eq("trip_id", tripId)
      .order("type", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data as TripDocument[] | null) ?? [];
}

export type UpsertTripDocumentDraftInput = {
  trip_id: string;
  type: TripDocumentType;
  narrative_json?: Record<string, unknown> | null;
  status?: TripDocumentStatus;
};

/** Create or update a document draft (narrative / status). */
export async function upsertTripDocumentDraft(
  input: UpsertTripDocumentDraftInput,
): Promise<TripDocument> {
  const existing = await findTripDocument(input.trip_id, input.type);
  const supabase = getServiceClient();

  if (existing) {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.narrative_json !== undefined) {
      patch.narrative_json = input.narrative_json;
    }
    if (input.status) {
      patch.status = input.status;
    }

    const { data, error } = await runSupabaseQuery(() =>
      supabase
        .from("trip_documents")
        .update(patch)
        .eq("id", existing.id)
        .select(DOCUMENT_COLUMNS)
        .single(),
    );

    if (error) {
      throw dbQueryError(error);
    }

    return data as unknown as TripDocument;
  }

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_documents")
      .insert({
        trip_id: input.trip_id,
        type: input.type,
        file_path: null,
        status: input.status ?? "generating",
        generated_at: null,
        source_updated_at: null,
        narrative_json: input.narrative_json ?? null,
      })
      .select(DOCUMENT_COLUMNS)
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as unknown as TripDocument;
}

export type CompleteTripDocumentInput = {
  trip_id: string;
  type: TripDocumentType;
  file_path: string;
  source_fingerprint: string;
  generated_by_id: string;
};

/** Mark document ready after a successful PDF upload. */
export async function completeTripDocumentReady(
  input: CompleteTripDocumentInput,
): Promise<TripDocument> {
  const existing = await findTripDocument(input.trip_id, input.type);
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  if (existing) {
    const { data, error } = await runSupabaseQuery(() =>
      supabase
        .from("trip_documents")
        .update({
          file_path: input.file_path,
          status: "ready",
          generated_at: now,
          source_updated_at: now,
          source_fingerprint: input.source_fingerprint,
          generated_by_id: input.generated_by_id,
          updated_at: now,
        })
        .eq("id", existing.id)
        .select(DOCUMENT_COLUMNS)
        .single(),
    );

    if (error) {
      throw dbQueryError(error);
    }

    return data as unknown as TripDocument;
  }

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_documents")
      .insert({
        trip_id: input.trip_id,
        type: input.type,
        file_path: input.file_path,
        status: "ready",
        generated_at: now,
        source_updated_at: now,
        source_fingerprint: input.source_fingerprint,
        generated_by_id: input.generated_by_id,
        narrative_json: null,
      })
      .select(DOCUMENT_COLUMNS)
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as unknown as TripDocument;
}

/** Mark a document generating (or create the row). */
export async function markTripDocumentGenerating(
  tripId: string,
  type: TripDocumentType,
): Promise<TripDocument> {
  return upsertTripDocumentDraft({
    trip_id: tripId,
    type,
    status: "generating",
  });
}
