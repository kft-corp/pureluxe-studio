"use client";

import { useState } from "react";
import {
  CLIENT_PREFERENCE_CATEGORIES,
  type CreateClientPreferenceBody,
} from "@pureluxe/shared";

import { Modal, ModalButton, modalFieldClassName } from "@/components/ui/modal";
import {
  createClientPreference,
  updateClientPreference,
} from "@/lib/api/clients";
import type { ClientProfile } from "@/lib/clients";
import { formatPreferenceCategory } from "@/lib/clients";
import {
  showApiError,
  showOptionalSuccessToast,
} from "@/lib/feedback/toast";
import { cn } from "@/lib/utils/cn";

type PreferenceRow = ClientProfile["client"]["preferences"][number];

type ClientPreferenceDialogProps = {
  open: boolean;
  clientId: string;
  preference?: PreferenceRow | null;
  onClose: () => void;
  onSuccess: (profile: ClientProfile) => void;
};

export function ClientPreferenceDialog({
  open,
  clientId,
  preference,
  onClose,
  onSuccess,
}: ClientPreferenceDialogProps) {
  const isEdit = Boolean(preference);
  const initialCategory =
    preference &&
    (CLIENT_PREFERENCE_CATEGORIES as readonly string[]).includes(
      preference.category,
    )
      ? preference.category
      : "other";
  const [category, setCategory] = useState(initialCategory);
  const [sentiment, setSentiment] = useState<
    "prefer" | "avoid" | "require"
  >(preference?.sentiment ?? "prefer");
  const [label, setLabel] = useState(preference?.label ?? "");
  const [notes, setNotes] = useState(preference?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);

    try {
      const body: CreateClientPreferenceBody = {
        category: category as (typeof CLIENT_PREFERENCE_CATEGORIES)[number],
        sentiment,
        label: label.trim(),
        notes: notes.trim() || null,
      };

      const response = preference
        ? await updateClientPreference(clientId, preference.id, body)
        : await createClientPreference(clientId, body);

      showOptionalSuccessToast(response.message);
      onSuccess(response.data);
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
      title={isEdit ? "Edit preference" : "Add preference"}
      description="What they like, avoid, or require when planning stays."
      footer={
        <>
          <ModalButton onClick={onClose} disabled={saving}>
            Cancel
          </ModalButton>
          <ModalButton
            type="submit"
            form="client-preference-form"
            variant="primary"
            disabled={saving || !label.trim()}
          >
            {saving ? "Saving…" : isEdit ? "Save" : "Add preference"}
          </ModalButton>
        </>
      }
    >
      <form
        id="client-preference-form"
        onSubmit={handleSubmit}
        className="space-y-4 px-5 py-4"
      >
        <label className="block">
          <span className="text-sm font-medium text-ink">Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={cn(modalFieldClassName, "mt-1.5")}
          >
            {CLIENT_PREFERENCE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {formatPreferenceCategory(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Sentiment</span>
          <select
            value={sentiment}
            onChange={(event) =>
              setSentiment(event.target.value as typeof sentiment)
            }
            className={cn(modalFieldClassName, "mt-1.5")}
          >
            <option value="prefer">Prefers</option>
            <option value="avoid">Avoids</option>
            <option value="require">Required</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Preference</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Corner suite on a high floor"
            maxLength={200}
            required
            className={cn(modalFieldClassName, "mt-1.5")}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Optional context for Trip Builder"
            className={cn(modalFieldClassName, "mt-1.5 resize-y")}
          />
        </label>
      </form>
    </Modal>
  );
}
