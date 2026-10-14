"use client";

import { useState } from "react";
import {
  CLIENT_DOCUMENT_MAX_BYTES,
  CLIENT_DOCUMENT_MIME_TYPES,
  CLIENT_DOCUMENT_TYPES,
  clientMessages,
  type CreateClientDocumentBody,
} from "@pureluxe/shared";

import { CountryCombobox } from "@/components/ui/country-combobox";
import { Modal, ModalButton, modalFieldClassName } from "@/components/ui/modal";
import {
  confirmClientDocumentUpload,
  createClientDocument,
  deleteClientDocument,
  uploadClientDocumentFile,
} from "@/lib/api/clients";
import type { ClientProfile } from "@/lib/clients";
import { formatDocumentType } from "@/lib/clients";
import {
  showApiError,
  showOptionalSuccessToast,
} from "@/lib/feedback/toast";
import { cn } from "@/lib/utils/cn";

type ClientDocumentDialogProps = {
  open: boolean;
  clientId: string;
  onClose: () => void;
  onSuccess: (profile: ClientProfile) => void;
};

function isAllowedMime(type: string): boolean {
  return (CLIENT_DOCUMENT_MIME_TYPES as readonly string[]).includes(type);
}

export function ClientDocumentDialog({
  open,
  clientId,
  onClose,
  onSuccess,
}: ClientDocumentDialogProps) {
  const [documentType, setDocumentType] =
    useState<(typeof CLIENT_DOCUMENT_TYPES)[number]>("passport");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issuingCountry, setIssuingCountry] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  function onFileChange(next: File | null) {
    setFileError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!isAllowedMime(next.type)) {
      setFile(null);
      setFileError(clientMessages.error.documentFileType);
      return;
    }
    if (next.size > CLIENT_DOCUMENT_MAX_BYTES) {
      setFile(null);
      setFileError(clientMessages.error.documentFileTooLarge);
      return;
    }
    setFile(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !file) return;
    setSaving(true);

    let createdDocumentId: string | null = null;

    try {
      const body: CreateClientDocumentBody = {
        document_type: documentType,
        document_number: documentNumber.trim() || null,
        issuing_country: issuingCountry.trim() || null,
        expiry_date: expiryDate.trim() || null,
        date_of_birth: dateOfBirth.trim() || null,
        file_name: file.name,
        mime_type: file.type as (typeof CLIENT_DOCUMENT_MIME_TYPES)[number],
        file_size_bytes: file.size,
      };

      const response = await createClientDocument(clientId, body);
      createdDocumentId = response.data.document.id;

      try {
        await uploadClientDocumentFile(response.data.upload.signedUrl, file);
      } catch (uploadError) {
        try {
          await deleteClientDocument(clientId, createdDocumentId);
        } catch {
          // Prefer showing the upload error; orphaned row can be purged later.
        }
        throw uploadError;
      }

      const confirmed = await confirmClientDocumentUpload(
        clientId,
        createdDocumentId,
      );
      showOptionalSuccessToast(confirmed.message ?? response.message);
      onSuccess(confirmed.data);
      onClose();
    } catch (error) {
      showApiError(error);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload document"
      description="Passports, visas, and insurance — starts as pending review."
      size="lg"
      footer={
        <>
          <ModalButton onClick={onClose} disabled={saving}>
            Cancel
          </ModalButton>
          <ModalButton
            type="submit"
            form="client-document-form"
            variant="primary"
            disabled={saving || !file || Boolean(fileError)}
          >
            {saving ? "Uploading…" : "Upload document"}
          </ModalButton>
        </>
      }
    >
      <form
        id="client-document-form"
        onSubmit={handleSubmit}
        className="space-y-4 px-5 py-4"
      >
        <label className="block">
          <span className="text-sm font-medium text-ink">Type</span>
          <select
            value={documentType}
            onChange={(event) =>
              setDocumentType(
                event.target.value as (typeof CLIENT_DOCUMENT_TYPES)[number],
              )
            }
            className={cn(modalFieldClassName, "mt-1.5")}
          >
            {CLIENT_DOCUMENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {formatDocumentType(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Document number</span>
          <input
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
            placeholder="Optional"
            maxLength={80}
            className={cn(modalFieldClassName, "mt-1.5")}
          />
        </label>

        <div className="block">
          <span className="text-sm font-medium text-ink">Issuing country</span>
          <div className="mt-1.5">
            <CountryCombobox
              value={issuingCountry}
              onChange={setIssuingCountry}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-ink">Expiry date</span>
            <input
              type="date"
              value={expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
              className={cn(modalFieldClassName, "mt-1.5")}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Date of birth</span>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              className={cn(modalFieldClassName, "mt-1.5")}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-ink">File</span>
          <input
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            className={cn(
              modalFieldClassName,
              "mt-1.5 cursor-pointer py-2 file:mr-3 file:rounded-md file:border-0 file:bg-brand-light file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-ink",
            )}
            required
          />
          {fileError ? (
            <p className="mt-1.5 wrap-break-word text-xs text-red-700">{fileError}</p>
          ) : (
            <p className="mt-1.5 wrap-break-word text-xs text-ink-muted">
              PDF or image · max 10 MB
              {file ? ` · ${file.name}` : ""}
            </p>
          )}
        </label>
      </form>
    </Modal>
  );
}
