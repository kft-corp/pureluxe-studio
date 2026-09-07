"use client";

import {
  LuBriefcase,
  LuCalendar,
  LuFileText,
  LuGlobe,
  LuLanguages,
  LuMail,
  LuMapPin,
  LuMessageCircle,
  LuPhone,
  LuStar,
  LuUser,
} from "react-icons/lu";

import {
  ContentSection,
  DETAIL_EMPTY_VALUE,
  DetailField,
} from "@/components/ui";
import {
  displayOrDash,
  formatAddressLines,
  formatDietaryLine,
  formatImportantDate,
  formatLanguage,
  formatNationality,
  formatPhone,
  formatPreferredContact,
  formatTimezone,
  isDocumentExpiringSoon,
  sortDocumentsByUrgency,
} from "@/lib/clients";
import { cn } from "@/lib/utils/cn";
import { phoneDigitsForHref } from "@pureluxe/shared";

import type { ClientEditSection } from "./client-edit-section-dialog";
import type { ClientProfileTab } from "./client-profile-tabs";
import {
  JumpCard,
  ListEmpty,
  type ProfileClient,
  SectionEditButton,
} from "./client-profile-shared";

type PanelProps = {
  client: ProfileClient;
  canWrite: boolean;
  onOpenTab: (tab: ClientProfileTab) => void;
  onEditSection: (section: ClientEditSection) => void;
};

export function ClientOverviewPanel({
  client,
  canWrite,
  onOpenTab,
  onEditSection,
}: PanelProps) {
  const health = client.health_profile;
  const address = formatAddressLines(client);
  const prefs = client.preferences;
  const docs = sortDocumentsByUrgency(client.documents);
  const expiringCount = docs.filter((doc) =>
    isDocumentExpiringSoon(doc.expiry_date),
  ).length;

  const healthSummary = health
    ? [
        formatDietaryLine(health.dietary_restrictions) !== "—"
          ? formatDietaryLine(health.dietary_restrictions)
          : null,
        health.emergency_contact_name
          ? `Emergency: ${health.emergency_contact_name}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Health details on file"
    : "No health details yet";

  const prefsSummary =
    prefs.length === 0
      ? "No preferences yet"
      : prefs
          .slice(0, 2)
          .map((pref) => pref.label)
          .join(" · ") + (prefs.length > 2 ? ` · +${prefs.length - 2} more` : "");

  const docsSummary =
    docs.length === 0
      ? "No documents yet"
      : expiringCount > 0
        ? `${docs.length} on file · ${expiringCount} need attention`
        : `${docs.length} on file`;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <JumpCard
          title="Preferences"
          summary={prefsSummary}
          onClick={() => onOpenTab("preferences")}
        />
        <JumpCard
          title="Travel documents"
          summary={docsSummary}
          onClick={() => onOpenTab("documents")}
        />
        <JumpCard
          title="Health & accessibility"
          summary={healthSummary}
          onClick={() => onOpenTab("health")}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <ContentSection
            title="Name & identity"
            description="How we address this guest in Studio and on travel documents."
            action={
              <SectionEditButton
                canWrite={canWrite}
                onClick={() => onEditSection("identity")}
              />
            }
          >
            <div className="grid sm:grid-cols-2">
              <DetailField
                icon={LuUser}
                label="Preferred name"
                value={displayOrDash(client.display_name)}
                className="sm:border-b sm:border-border/70"
              />
              <DetailField
                icon={LuUser}
                label="Title"
                value={displayOrDash(client.title)}
                className="sm:border-b sm:border-border/70"
              />
              <DetailField
                icon={LuUser}
                label="First name"
                value={displayOrDash(client.first_name)}
                className="sm:border-b sm:border-border/70"
              />
              <DetailField
                icon={LuUser}
                label="Last name"
                value={displayOrDash(client.last_name)}
                className="sm:border-b sm:border-border/70"
              />
              <DetailField
                icon={LuFileText}
                label="Legal name"
                value={displayOrDash(client.legal_name)}
                className="sm:border-b sm:border-border/70"
              />
              <DetailField
                icon={LuBriefcase}
                label="Company"
                value={displayOrDash(client.company)}
                className="sm:border-b sm:border-border/70"
              />
            </div>
          </ContentSection>

          <ContentSection
            title="Contact"
            description="Best ways to reach them before and during a trip."
            action={
              <SectionEditButton
                canWrite={canWrite}
                onClick={() => onEditSection("contact")}
              />
            }
          >
            <div className="grid sm:grid-cols-2">
              <DetailField
                icon={LuMail}
                label="Email"
                value={displayOrDash(client.email)}
                href={client.email?.trim() ? `mailto:${client.email.trim()}` : null}
                badge={
                  client.preferred_contact_method === "email"
                    ? "Preferred"
                    : undefined
                }
                className="sm:border-b sm:border-border/70"
              />
              <DetailField
                icon={LuPhone}
                label="Phone"
                value={formatPhone(client.phone)}
                href={
                  phoneDigitsForHref(client.phone)
                    ? `tel:+${phoneDigitsForHref(client.phone)}`
                    : null
                }
                badge={
                  client.preferred_contact_method === "phone"
                    ? "Preferred"
                    : undefined
                }
                className="sm:border-b sm:border-border/70"
              />
              <DetailField
                icon={LuMessageCircle}
                label="WhatsApp"
                value={formatPhone(client.whatsapp)}
                href={
                  phoneDigitsForHref(client.whatsapp)
                    ? `https://wa.me/${phoneDigitsForHref(client.whatsapp)}`
                    : null
                }
                badge={
                  client.preferred_contact_method === "whatsapp"
                    ? "Preferred"
                    : undefined
                }
                className="sm:border-b sm:border-border/70"
              />
              <DetailField
                icon={LuStar}
                label="Best way to reach them"
                value={formatPreferredContact(client.preferred_contact_method)}
                className="sm:border-b sm:border-border/70"
              />
              <DetailField
                icon={LuLanguages}
                label="Language"
                value={formatLanguage(client.preferred_language)}
              />
              <DetailField
                icon={LuGlobe}
                label="Timezone"
                value={formatTimezone(client.timezone)}
              />
            </div>
          </ContentSection>

          <ContentSection
            title="Location & address"
            description="Where they live and their mailing address on file."
            action={
              <SectionEditButton
                canWrite={canWrite}
                onClick={() => onEditSection("location")}
              />
            }
          >
            <div className="grid sm:grid-cols-2">
              <DetailField
                icon={LuMapPin}
                label="City of residence"
                value={displayOrDash(client.city_of_residence)}
                className="sm:border-b sm:border-border/70"
              />
              <DetailField
                icon={LuGlobe}
                label="Nationality"
                value={formatNationality(client.nationality)}
                className="sm:border-b sm:border-border/70"
              />
            </div>
            <div className="border-t border-border/70 px-5 py-4 sm:px-6">
              <p className="text-xs font-medium text-ink-muted">
                Mailing address
              </p>
              <p
                className={cn(
                  "mt-1 whitespace-pre-line text-sm font-medium leading-relaxed",
                  address === DETAIL_EMPTY_VALUE
                    ? "text-ink-subtle"
                    : "text-ink",
                )}
              >
                {address}
              </p>
            </div>
          </ContentSection>

        </div>

        <div className="space-y-5">
          <ContentSection
            title="Important dates"
            description="Birthdays, anniversaries, and dates worth remembering."
            action={
              <SectionEditButton
                canWrite={canWrite}
                onClick={() => onEditSection("dates")}
              />
            }
          >
            {(client.important_dates?.length ?? 0) > 0 ? (
              <ul className="divide-y divide-border/80">
                {client.important_dates.map((item, index) => (
                  <li
                    key={`${item.label}-${item.date}-${index}`}
                    className="flex items-start gap-3 px-5 py-3.5 sm:px-6"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-ink-muted">
                      <LuCalendar className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="wrap-break-word text-sm font-semibold text-ink">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {formatImportantDate(item)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <ListEmpty message="No important dates on file." />
            )}
          </ContentSection>
        </div>
      </div>
    </div>
  );
}
