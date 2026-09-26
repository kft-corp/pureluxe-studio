"use client";

import { useState } from "react";
import { LuChevronRight, LuFileText, LuLock } from "react-icons/lu";

import { ActionButton, DETAIL_EMPTY_VALUE } from "@/components/ui";
import type { ClientProfile } from "@/lib/clients";
import {
  formatBookingDate,
  formatDocumentStatus,
  formatDocumentType,
  formatNationality,
  formatPreferenceCategory,
  formatSentiment,
  isDocumentExpiringSoon,
} from "@/lib/clients";
import { cn } from "@/lib/utils/cn";

export const NOTE_PREVIEW_CHARS = 280;

export type ProfileClient = ClientProfile["client"];

export function SectionEditButton({
  canWrite,
  onClick,
}: {
  canWrite: boolean;
  onClick: () => void;
}) {
  if (!canWrite) return null;
  return <ActionButton onClick={onClick}>Edit</ActionButton>;
}

export function ListEmpty({ message }: { message: string }) {
  return (
    <p className="px-5 py-6 text-sm text-ink-muted sm:px-6">{message}</p>
  );
}

export function NoteBlock({
  title,
  body,
  locked,
  collapsible,
}: {
  title: string;
  body: string | null | undefined;
  locked?: boolean;
  collapsible?: boolean;
}) {
  const text = body?.trim() ?? "";
  const needsCollapse =
    collapsible && text.length > NOTE_PREVIEW_CHARS;
  const [expanded, setExpanded] = useState(false);
  const shown =
    needsCollapse && !expanded
      ? `${text.slice(0, NOTE_PREVIEW_CHARS).trimEnd()}…`
      : text || DETAIL_EMPTY_VALUE;

  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="flex items-center gap-2">
        {locked ? (
          <LuLock className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
        ) : null}
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          {title}
        </p>
      </div>
      <p
        className={cn(
          "mt-2 wrap-break-word whitespace-pre-wrap text-sm leading-relaxed",
          text ? "text-ink" : "text-ink-subtle",
        )}
      >
        {shown}
      </p>
      {needsCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-xs font-semibold text-ink-muted transition hover:text-ink"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}

export function PreferenceListItem({
  pref,
  canWrite,
  onEdit,
  onConfirm,
  onRemove,
  busy,
}: {
  pref: ProfileClient["preferences"][number];
  canWrite: boolean;
  onEdit: () => void;
  onConfirm: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <li className="px-5 py-3.5 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="wrap-break-word text-sm font-semibold text-ink">
              {pref.label}
            </p>
            <span className="rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-ink">
              {formatSentiment(pref.sentiment)}
            </span>
            {!pref.is_confirmed ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                Needs confirmation
              </span>
            ) : null}
          </div>
          <p className="mt-1 wrap-break-word text-xs text-ink-muted">
            {formatPreferenceCategory(pref.category)}
            {pref.notes?.trim() ? ` · ${pref.notes}` : ""}
          </p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-1 sm:shrink-0 sm:justify-end">
            {!pref.is_confirmed ? (
              <ActionButton onClick={onConfirm} disabled={busy}>
                Confirm
              </ActionButton>
            ) : null}
            <ActionButton onClick={onEdit} disabled={busy}>
              Edit
            </ActionButton>
            <ActionButton onClick={onRemove} disabled={busy}>
              Remove
            </ActionButton>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function DocumentListItem({
  doc,
  canWrite,
  busy,
  onView,
  onVerify,
  onReject,
  onRemove,
}: {
  doc: ProfileClient["documents"][number];
  canWrite: boolean;
  busy: boolean;
  onView: () => void;
  onVerify: () => void;
  onReject: () => void;
  onRemove: () => void;
}) {
  const soon = isDocumentExpiringSoon(doc.expiry_date);
  const expired =
    doc.status === "expired" || isDocumentExpiringSoon(doc.expiry_date, 0);
  const pending = doc.status === "pending_review";
  const hasFile = Boolean(doc.file_path?.trim());
  const showActions =
    hasFile || (canWrite && pending) || canWrite;

  return (
    <li className="px-5 py-3.5 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-ink-muted">
            <LuFileText className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink">
                {formatDocumentType(doc.document_type)}
              </p>
              {expired ? (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                  Expired
                </span>
              ) : soon ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  Expiring soon
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 wrap-break-word text-xs text-ink-muted">
              {[
                doc.document_number,
                doc.issuing_country?.trim()
                  ? formatNationality(doc.issuing_country)
                  : null,
                doc.expiry_date
                  ? `Expires ${formatBookingDate(doc.expiry_date)}`
                  : null,
                formatDocumentStatus(doc.status),
                doc.file_name?.trim() || null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        {showActions ? (
          <div className="flex flex-wrap items-center gap-1 pl-12 sm:pl-0 sm:shrink-0 sm:justify-end">
            {hasFile ? (
              <ActionButton onClick={onView} disabled={busy}>
                View
              </ActionButton>
            ) : null}
            {canWrite && pending ? (
              <>
                <ActionButton onClick={onVerify} disabled={busy}>
                  Verify
                </ActionButton>
                <ActionButton onClick={onReject} disabled={busy}>
                  Reject
                </ActionButton>
              </>
            ) : null}
            {canWrite ? (
              <ActionButton variant="danger" onClick={onRemove} disabled={busy}>
                Remove
              </ActionButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function JumpCard({
  title,
  summary,
  onClick,
}: {
  title: string;
  summary: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface-raised px-4 py-3.5 text-left shadow-sm transition hover:bg-brand-light/50"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 wrap-break-word text-xs text-ink-muted sm:truncate">
          {summary}
        </p>
      </div>
      <LuChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
    </button>
  );
}
