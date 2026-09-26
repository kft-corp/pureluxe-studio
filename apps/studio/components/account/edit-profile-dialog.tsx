"use client";

import { useState } from "react";
import { composeE164, parsePhoneParts } from "@pureluxe/shared";

import { PhoneInput } from "@/components/ui";
import { Modal, ModalButton, modalFieldClassName } from "@/components/ui/modal";
import {
  isProfileFormUnchanged,
} from "@/lib/account/profile-fields";
import type { AccountProfileData } from "@/lib/api/account";
import { updateAccountProfile } from "@/lib/api/account";
import { showApiError, showOptionalSuccessToast } from "@/lib/feedback/toast";

type EditProfileDialogProps = {
  open: boolean;
  profile: AccountProfileData;
  onClose: () => void;
  onSuccess: (profile: AccountProfileData) => void;
};

function ProfileField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function EditProfileForm({
  profile,
  onClose,
  onSuccess,
}: Omit<EditProfileDialogProps, "open">) {
  const [name, setName] = useState(profile.name);
  const [title, setTitle] = useState(profile.title ?? "");
  const [phone, setPhone] = useState(() => {
    const raw = profile.phone?.trim() ?? "";
    if (!raw) return "";
    const parts = parsePhoneParts(raw);
    return composeE164(parts.country, parts.national) ?? "";
  });
  const [loading, setLoading] = useState(false);

  const trimmedName = name.trim();
  const draft = { name: trimmedName, title, phone };
  const unchanged = isProfileFormUnchanged(profile, draft);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await updateAccountProfile({
        name: trimmedName,
        title,
        phone,
      });
      onSuccess(response.data);
      onClose();
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit profile"
      description="Update your name, designation, and phone number."
      footer={
        <>
          <ModalButton onClick={onClose} disabled={loading} className="w-full sm:w-auto">
            Cancel
          </ModalButton>
          <ModalButton
            type="submit"
            form="edit-profile-form"
            variant="primary"
            disabled={loading || !trimmedName || unchanged}
            className="w-full sm:w-auto"
          >
            {loading ? "Saving…" : "Save changes"}
          </ModalButton>
        </>
      }
    >
      <form
        id="edit-profile-form"
        onSubmit={handleSubmit}
        className="max-h-[min(60vh,24rem)] space-y-4 overflow-y-auto px-5 py-5"
      >
        <ProfileField label="Name" htmlFor="profile-name">
          <input
            id="profile-name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={modalFieldClassName}
          />
        </ProfileField>

        <ProfileField label="Designation" htmlFor="profile-designation">
          <input
            id="profile-designation"
            type="text"
            autoComplete="organization-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Optional"
            className={modalFieldClassName}
          />
        </ProfileField>

        <ProfileField label="Phone" htmlFor="profile-phone">
          <PhoneInput
            id="profile-phone"
            value={phone}
            onChange={setPhone}
            className="mt-1.5"
          />
        </ProfileField>
      </form>
    </Modal>
  );
}

export function EditProfileDialog({
  open,
  profile,
  onClose,
  onSuccess,
}: EditProfileDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <EditProfileForm
      key={[profile.memberId, profile.name, profile.title, profile.phone].join(":")}
      profile={profile}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
