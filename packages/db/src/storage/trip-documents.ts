import { getServiceClient } from "../client";
import { dbQueryError } from "../errors";
import type { TripDocumentType } from "../schema";

/** Private Supabase Storage bucket for generated proposal PDFs. */
export const TRIP_DOCUMENTS_BUCKET = "trip-documents";

/** Stable storage path for a trip proposal PDF. */
export function buildTripDocumentPath(
  tripId: string,
  type: TripDocumentType,
): string {
  return `trips/${tripId}/${type}.pdf`;
}

/** Upload PDF bytes to the trip-documents bucket. */
export async function uploadTripDocumentPdf(
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.storage
    .from(TRIP_DOCUMENTS_BUCKET)
    .upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    throw dbQueryError(error);
  }
}

/** Short-lived signed URL to view or download a generated PDF. */
export async function createTripDocumentDownloadUrl(
  path: string,
  expiresInSeconds = 120,
  downloadName?: string,
): Promise<string> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.storage
    .from(TRIP_DOCUMENTS_BUCKET)
    .createSignedUrl(
      path,
      expiresInSeconds,
      downloadName ? { download: downloadName } : undefined,
    );

  if (error || !data?.signedUrl) {
    throw dbQueryError(
      error ?? { message: "Failed to create signed download URL" },
    );
  }

  return data.signedUrl;
}
