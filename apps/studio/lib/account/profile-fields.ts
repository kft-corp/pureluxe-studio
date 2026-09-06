import { DETAIL_EMPTY_VALUE } from "@/components/ui";

/** Display text for a nullable profile field. */
export function profileFieldText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed || DETAIL_EMPTY_VALUE;
}

/** Whether a nullable profile field has no value. */
export function isProfileFieldEmpty(value: string | null | undefined): boolean {
  return !value?.trim();
}

/** Trim optional form input; empty string becomes null. */
export function normalizeOptionalProfileField(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

/** True when editable profile fields match the saved profile. */
export function isProfileFormUnchanged(
  saved: { name: string; title: string | null; phone: string | null },
  draft: { name: string; title: string; phone: string },
): boolean {
  return (
    draft.name.trim() === saved.name.trim() &&
    normalizeOptionalProfileField(draft.title) ===
      normalizeOptionalProfileField(saved.title ?? "") &&
    normalizeOptionalProfileField(draft.phone) ===
      normalizeOptionalProfileField(saved.phone ?? "")
  );
}
