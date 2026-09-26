import { getServiceClient } from "../client";
import { dbQueryError } from "../errors";

/** Private Supabase Storage bucket for client travel documents. */
export const CLIENT_DOCUMENTS_BUCKET = "client-documents";

/** Build a stable storage path for a client document file. */
export function buildClientDocumentPath(
  clientId: string,
  documentId: string,
  fileName: string,
): string {
  const safeName = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
  return `clients/${clientId}/${documentId}/${safeName || "document"}`;
}

export type SignedUpload = {
  path: string;
  signedUrl: string;
  token: string;
};

/** Create a short-lived signed upload URL for a new document file. */
export async function createClientDocumentUploadUrl(
  path: string,
): Promise<SignedUpload> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.storage
    .from(CLIENT_DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data?.signedUrl || !data.token) {
    throw dbQueryError(
      error ?? { message: "Failed to create signed upload URL" },
    );
  }

  return {
    path: data.path ?? path,
    signedUrl: data.signedUrl,
    token: data.token,
  };
}

/** Create a short-lived signed URL to view or download a document file. */
export async function createClientDocumentDownloadUrl(
  path: string,
  expiresInSeconds = 120,
): Promise<string> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.storage
    .from(CLIENT_DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw dbQueryError(
      error ?? { message: "Failed to create signed download URL" },
    );
  }

  return data.signedUrl;
}

/** Remove a document file from storage (best-effort). */
export async function removeClientDocumentFile(
  path: string,
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.storage
    .from(CLIENT_DOCUMENTS_BUCKET)
    .remove([path]);

  if (error) {
    throw dbQueryError(error);
  }
}
