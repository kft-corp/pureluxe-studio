"use client";

import Link from "next/link";

import { ContentSection, UserAvatar } from "@/components/ui";
import {
  formatAuditAction,
  formatBookingDate,
  titleCaseWords,
} from "@/lib/clients";
import { pageRoutes } from "@/lib/routes";

import {
  ListEmpty,
  type ProfileClient,
} from "./client-profile-shared";

export function ClientActivityPanel({ client }: { client: ProfileClient }) {
  return (
    <div className="space-y-5">
      {client.merge_candidates.length > 0 ? (
        <ContentSection
          title="Possible duplicates"
          description="Similar records — review before adding another client."
          count={client.merge_candidates.length}
        >
          <ul className="divide-y divide-border/80">
            {client.merge_candidates.map((candidate) => (
              <li key={candidate.client_id}>
                <Link
                  href={pageRoutes.client(candidate.client_id)}
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-brand-light/60 sm:px-6"
                >
                  <UserAvatar
                    name={candidate.display_name ?? "Client"}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {candidate.display_name ?? "Unnamed client"}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {Math.round(candidate.similarity * 100)}% match
                      {candidate.match_reason
                        ? ` · ${titleCaseWords(candidate.match_reason)}`
                        : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </ContentSection>
      ) : null}

      <ContentSection
        title="Recent activity"
        description="Latest updates made to this profile."
        count={client.recent_audit.length}
      >
        {client.recent_audit.length > 0 ? (
          <ul className="divide-y divide-border/80">
            {client.recent_audit.map((entry) => (
              <li key={entry.id} className="px-5 py-3.5 sm:px-6">
                <p className="text-sm font-semibold text-ink">
                  {formatAuditAction(entry.action, entry.field_name)}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {formatBookingDate(entry.created_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <ListEmpty message="No recent activity yet." />
        )}
      </ContentSection>
    </div>
  );
}
