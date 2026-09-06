"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  LuBriefcase,
  LuFingerprint,
  LuMail,
  LuPencil,
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
  studioButtonClass,
} from "@/components/ui";
import {
  isProfileFieldEmpty,
  profileFieldText,
} from "@/lib/account/profile-fields";
import type { AccountProfileData } from "@/lib/api/account";
import { formatRoleLabel } from "@/lib/auth/format-role-label";
import { cn } from "@/lib/utils/cn";

import { EditProfileDialog } from "./edit-profile-dialog";

type AccountProfileProps = AccountProfileData;

export function AccountProfile(props: AccountProfileProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(props);
  const [editOpen, setEditOpen] = useState(false);

  const { name, email, role, title, phone, memberId } = profile;
  const roleLabel = isProfileFieldEmpty(role) ? DETAIL_EMPTY_VALUE : formatRoleLabel(role);

  function handleProfileUpdated(nextProfile: AccountProfileData) {
    setProfile(nextProfile);
    router.refresh();
  }

  return (
    <>
      <PageStack>
        <PageToolbar>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <UserAvatar name={name} email={email} size="lg" />

              <div className="min-w-0 flex-1">
                <h2
                  className={cn(
                    "text-pretty text-xl font-semibold tracking-tight sm:text-2xl",
                    isProfileFieldEmpty(name) ? "text-ink-subtle" : "text-ink",
                  )}
                >
                  {profileFieldText(name)}
                </h2>

                <p
                  className={cn(
                    "mt-1 text-sm",
                    isProfileFieldEmpty(title) ? "text-ink-subtle" : "text-ink-muted",
                  )}
                >
                  {profileFieldText(title)}
                </p>

                <p
                  className={cn(
                    "mt-1 truncate text-sm",
                    isProfileFieldEmpty(email) ? "text-ink-subtle" : "text-ink-muted",
                  )}
                >
                  {profileFieldText(email)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!isProfileFieldEmpty(role) ? (
                    <RoleBadge label={roleLabel} role={role} />
                  ) : null}
                  <StatusBadge status="active" />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className={studioButtonClass(
                "secondary",
                "md",
                "w-full shrink-0 sm:w-auto sm:self-start",
              )}
            >
              <LuPencil className="h-4 w-4" aria-hidden />
              Edit profile
            </button>
          </div>
        </PageToolbar>

        <ContentSection
          title="Profile details"
          description="Your contact details. Name, designation, and phone can be updated."
        >
          <dl className="divide-y divide-border/70 sm:grid sm:grid-cols-2 sm:divide-y-0">
            <DetailField
              icon={LuUser}
              label="Name"
              value={profileFieldText(name)}
              className="sm:border-b sm:border-border/70"
            />
            <DetailField
              icon={LuMail}
              label="Email"
              value={profileFieldText(email)}
              className="sm:border-b sm:border-border/70"
            />
            <DetailField
              icon={LuBriefcase}
              label="Designation"
              value={profileFieldText(title)}
            />
            <DetailField icon={LuPhone} label="Phone" value={profileFieldText(phone)} />
          </dl>
        </ContentSection>

        <ContentSection title="Account">
          <dl>
            <DetailField
              icon={LuFingerprint}
              label="Member ID"
              value={profileFieldText(memberId)}
              mono
            />
          </dl>
        </ContentSection>
      </PageStack>

      <EditProfileDialog
        open={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onSuccess={handleProfileUpdated}
      />
    </>
  );
}
