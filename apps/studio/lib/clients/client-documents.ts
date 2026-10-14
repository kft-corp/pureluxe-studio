import { randomUUID } from "node:crypto";

import {
  buildClientDocumentPath,
  createClientDocumentDownloadUrl,
  createClientDocumentUploadUrl,
  deleteClientDocument as dbDeleteClientDocument,
  findClientDocumentById,
  insertClientAuditLogs,
  insertClientDocument,
  removeClientDocumentFile,
  updateClientDocument as dbUpdateClientDocument,
  type ClientDocument,
  type SignedUpload,
} from "@pureluxe/db";
import {
  AppError,
  clientMessages,
  type CreateClientDocumentInput,
  type UpdateClientDocumentInput,
} from "@pureluxe/shared";

import { refreshClientCompleteness } from "./refresh-client-completeness";
import { requireActiveClient } from "./require-active-client";

async function requireClientDocument(clientId: string, documentId: string) {
  const document = await findClientDocumentById(documentId);
  if (!document || document.client_id !== clientId) {
    throw new AppError({
      userMessage: clientMessages.error.documentNotFound,
      code: "clients.document_not_found",
      status: 404,
    });
  }
  return document;
}

export type CreateClientDocumentResult = {
  document: ClientDocument;
  upload: SignedUpload;
};

/**
 * Register a document row in `pending_upload` and return a signed upload URL.
 * Completeness / audit for "document added" run after `confirmClientDocumentUpload`.
 */
export async function createClientDocument(
  clientId: string,
  input: CreateClientDocumentInput,
  actor: { memberId: string },
): Promise<CreateClientDocumentResult> {
  await requireActiveClient(clientId);

  const documentId = randomUUID();
  const filePath = buildClientDocumentPath(
    clientId,
    documentId,
    input.file_name,
  );

  let upload: SignedUpload;
  try {
    upload = await createClientDocumentUploadUrl(filePath);
  } catch (cause) {
    throw new AppError({
      userMessage: clientMessages.error.documentUploadFailed,
      code: "clients.document_upload_failed",
      status: 503,
      cause,
    });
  }

  const document = await insertClientDocument(clientId, {
    id: documentId,
    document_type: input.document_type,
    document_number: input.document_number ?? null,
    issuing_country: input.issuing_country ?? null,
    expiry_date: input.expiry_date ?? null,
    date_of_birth: input.date_of_birth ?? null,
    file_path: upload.path,
    file_name: input.file_name,
    mime_type: input.mime_type,
    file_size_bytes: input.file_size_bytes,
    status: "pending_upload",
    uploaded_by_id: actor.memberId,
  });

  return { document, upload };
}

/** Mark a successful file upload as ready for advisor review. */
export async function confirmClientDocumentUpload(
  clientId: string,
  documentId: string,
  actor: { memberId: string },
): Promise<ClientDocument> {
  await requireActiveClient(clientId);
  const existing = await requireClientDocument(clientId, documentId);

  if (existing.status !== "pending_upload") {
    return existing;
  }

  const document = await dbUpdateClientDocument(documentId, {
    status: "pending_review",
  });

  await insertClientAuditLogs([
    {
      client_id: clientId,
      action: "updated",
      field_name: "document",
      new_value: document.document_type,
      team_member_id: actor.memberId,
      metadata: {
        source: "studio",
        document_id: document.id,
        document_type: document.document_type,
        upload_confirmed: true,
      },
    },
  ]);

  await refreshClientCompleteness(clientId, actor);

  return document;
}

/** Update metadata or verify / reject a document. */
export async function updateClientDocument(
  clientId: string,
  documentId: string,
  input: UpdateClientDocumentInput,
  actor: { memberId: string },
): Promise<ClientDocument> {
  await requireActiveClient(clientId);
  const existing = await requireClientDocument(clientId, documentId);

  const verifying =
    input.status === "verified" && existing.status !== "verified";
  const rejecting =
    input.status === "rejected" && existing.status !== "rejected";
  const clearingVerification =
    input.status === "pending_review" ||
    input.status === "rejected" ||
    input.status === "expired";

  const document = await dbUpdateClientDocument(documentId, {
    document_type: input.document_type,
    document_number: input.document_number,
    issuing_country: input.issuing_country,
    expiry_date: input.expiry_date,
    date_of_birth: input.date_of_birth,
    status: input.status,
    ...(verifying
      ? {
          verified_at: new Date().toISOString(),
          verified_by_id: actor.memberId,
        }
      : clearingVerification
        ? {
            verified_at: null,
            verified_by_id: null,
          }
        : {}),
  });

  await insertClientAuditLogs([
    {
      client_id: clientId,
      action: verifying ? "document_verified" : "updated",
      field_name: "document",
      old_value: existing.status,
      new_value: document.status,
      team_member_id: actor.memberId,
      metadata: {
        source: "studio",
        document_id: document.id,
        document_type: document.document_type,
        ...(verifying ? { verified: true } : {}),
        ...(rejecting ? { rejected: true } : {}),
      },
    },
  ]);

  await refreshClientCompleteness(clientId, actor);

  return document;
}

/** Signed URL to view or download the stored file. */
export async function getClientDocumentFileUrl(
  clientId: string,
  documentId: string,
): Promise<{ url: string; fileName: string | null; mimeType: string | null }> {
  await requireActiveClient(clientId);
  const document = await requireClientDocument(clientId, documentId);

  if (
    document.status === "pending_upload" ||
    !document.file_path?.trim()
  ) {
    throw new AppError({
      userMessage: clientMessages.error.documentNoFile,
      code: "clients.document_no_file",
      status: 404,
    });
  }

  try {
    const url = await createClientDocumentDownloadUrl(document.file_path);
    return {
      url,
      fileName: document.file_name,
      mimeType: document.mime_type,
    };
  } catch (cause) {
    throw new AppError({
      userMessage: clientMessages.error.documentDownloadFailed,
      code: "clients.document_download_failed",
      status: 503,
      cause,
    });
  }
}

/** Delete document row and best-effort remove the storage object. */
export async function deleteClientDocument(
  clientId: string,
  documentId: string,
  actor: { memberId: string },
): Promise<void> {
  await requireActiveClient(clientId);
  const existing = await requireClientDocument(clientId, documentId);

  await dbDeleteClientDocument(documentId);

  if (existing.file_path?.trim()) {
    try {
      await removeClientDocumentFile(existing.file_path);
    } catch {
      // Row is gone; orphaned storage can be cleaned later.
    }
  }

  if (existing.status !== "pending_upload") {
    await insertClientAuditLogs([
      {
        client_id: clientId,
        action: "updated",
        field_name: "document",
        old_value: existing.document_type,
        new_value: null,
        team_member_id: actor.memberId,
        metadata: {
          source: "studio",
          document_id: existing.id,
          removed: true,
        },
      },
    ]);
    await refreshClientCompleteness(clientId, actor);
  }
}
