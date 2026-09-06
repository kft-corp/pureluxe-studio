"use client";

import { LuFileText } from "react-icons/lu";

import { ActionButton, ContentSection, EmptyState } from "@/components/ui";
import { sortDocumentsByUrgency } from "@/lib/clients";

import {
  DocumentListItem,
  type ProfileClient,
} from "./client-profile-shared";

export function ClientDocumentsPanel({
  client,
  canWrite,
  onUpload,
  onView,
  onVerify,
  onReject,
  onRemove,
  documentBusyId,
}: {
  client: ProfileClient;
  canWrite: boolean;
  onUpload: () => void;
  onView: (documentId: string) => void;
  onVerify: (documentId: string) => void;
  onReject: (documentId: string) => void;
  onRemove: (documentId: string) => void;
  documentBusyId: string | null;
}) {
  const docs = sortDocumentsByUrgency(client.documents);

  return (
    <ContentSection
      title="Travel documents"
      description="Passports, visas, and insurance — sorted by expiry urgency."
      count={docs.length}
      countLabel={docs.length === 1 ? "document" : "documents"}
      action={
        canWrite ? (
          <ActionButton onClick={onUpload}>Upload</ActionButton>
        ) : null
      }
    >
      {docs.length > 0 ? (
        <ul className="divide-y divide-border/80">
          {docs.map((doc) => (
            <DocumentListItem
              key={doc.id}
              doc={doc}
              canWrite={canWrite}
              busy={documentBusyId === doc.id}
              onView={() => onView(doc.id)}
              onVerify={() => onVerify(doc.id)}
              onReject={() => onReject(doc.id)}
              onRemove={() => onRemove(doc.id)}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={LuFileText}
          message="No travel documents on file."
        />
      )}
    </ContentSection>
  );
}
