/** Display name for a team member, falling back to the email local part. */
export function getMemberDisplayName(
  name: string | null | undefined,
  email: string,
): string {
  const trimmed = name?.trim();
  if (trimmed) {
    return trimmed;
  }

  const localPart = email.split("@")[0]?.trim();
  return localPart || email;
}
