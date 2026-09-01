import {
  LuBriefcase,
  LuFingerprint,
  LuMail,
  LuPhone,
  LuUser,
} from "react-icons/lu";

import {
  ContentSection,
  DETAIL_EMPTY_VALUE,
  DetailField,
  PageStack,
  PageToolbar,
  RoleBadge,
  StatusBadge,
  UserAvatar,
} from "@/components/ui";
import { formatRoleLabel } from "@/lib/auth/format-role-label";
import type { AccountProfileData } from "@/lib/api/account";
import { cn } from "@/lib/utils/cn";

function displayValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed || DETAIL_EMPTY_VALUE;
}

function isEmptyValue(value: string | null | undefined): boolean {
  return !value?.trim();
}

export function AccountProfile({
  name,
  email,
  role,
  title,
  phone,
  memberId,
}: AccountProfileData) {
  const displayName = displayValue(name);
  const displayEmail = displayValue(email);
  const displayTitle = displayValue(title);
  const displayPhone = displayValue(phone);
  const displayMemberId = displayValue(memberId);
  const roleLabel = isEmptyValue(role) ? DETAIL_EMPTY_VALUE : formatRoleLabel(role);

  return (
    <PageStack>
      <PageToolbar>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <UserAvatar name={name} email={email} size="lg" />

          <div className="min-w-0 flex-1">
            <h2
              className={cn(
                "text-pretty text-xl font-semibold tracking-tight sm:text-2xl",
                isEmptyValue(name) ? "text-ink-subtle" : "text-ink",
              )}
            >
              {displayName}
            </h2>

            <p
              className={cn(
                "mt-1 text-sm",
                isEmptyValue(title) ? "text-ink-subtle" : "text-ink-muted",
              )}
            >
              {displayTitle}
            </p>

            <p
              className={cn(
                "mt-1 truncate text-sm",
                isEmptyValue(email) ? "text-ink-subtle" : "text-ink-muted",
              )}
            >
              {displayEmail}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!isEmptyValue(role) ? (
                <RoleBadge label={roleLabel} role={role} />
              ) : null}
              <StatusBadge status="active" />
            </div>
          </div>
        </div>
      </PageToolbar>

      <ContentSection
        title="Profile details"
        description="Your contact and team account details."
      >
        <dl className="divide-y divide-border/70 sm:grid sm:grid-cols-2 sm:divide-y-0">
          <DetailField
            icon={LuUser}
            label="Name"
            value={displayName}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField
            icon={LuMail}
            label="Email"
            value={displayEmail}
            className="sm:border-b sm:border-border/70"
          />
          <DetailField icon={LuBriefcase} label="Title" value={displayTitle} />
          <DetailField icon={LuPhone} label="Phone" value={displayPhone} />
        </dl>
      </ContentSection>

      <ContentSection title="Account">
        <dl>
          <DetailField
            icon={LuFingerprint}
            label="Member ID"
            value={displayMemberId}
            mono
          />
        </dl>
      </ContentSection>
    </PageStack>
  );
}
