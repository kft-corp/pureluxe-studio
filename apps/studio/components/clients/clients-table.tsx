"use client";

import Link from "next/link";
import { LuChevronRight, LuUsers } from "react-icons/lu";
import { phoneDigitsForHref } from "@pureluxe/shared";

import { PageLoader } from "@/components/feedback";
import {
  EmptyState,
  StatusBadge,
  UserAvatar,
  studioButtonClass,
} from "@/components/ui";
import {
  MobileCard,
  ResponsiveTable,
  TableCell,
  TableRow,
} from "@/components/ui/responsive-table";
import type { ClientDirectoryItem } from "@/lib/api/clients";
import { formatBookingDate, formatPhone } from "@/lib/clients";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

import { ClientVipBadge } from "./client-vip-badge";

type ClientsTableProps = {
  clients: ClientDirectoryItem[];
  loading: boolean;
  hasActiveFilters?: boolean;
  searchQuery?: string;
};

function ClientBadges({ client }: { client: ClientDirectoryItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {client.review_status === "pending" ? (
        <StatusBadge status="pending" />
      ) : null}
      <ClientVipBadge tier={client.tier.slug} />
    </div>
  );
}

/** Stacked contact — email first, phone second; clickable when possible. */
function ContactCell({
  email,
  phone,
}: {
  email: string | null | undefined;
  phone: string | null | undefined;
}) {
  const emailValue = email?.trim() || "";
  const phoneValue = phone?.trim() || "";
  const phoneLabel = phoneValue ? formatPhone(phoneValue) : "";
  const phoneHref = phoneDigitsForHref(phoneValue);

  if (!emailValue && !phoneValue) {
    return (
      <span className="text-sm text-ink-muted">No email or phone</span>
    );
  }

  return (
    <div className="min-w-0 max-w-full">
      {emailValue ? (
        <a
          href={`mailto:${emailValue}`}
          onClick={(event) => event.stopPropagation()}
          className="block truncate text-sm text-ink underline-offset-2 hover:underline"
          title={emailValue}
        >
          {emailValue}
        </a>
      ) : null}
      {phoneValue ? (
        phoneHref ? (
          <a
            href={`tel:+${phoneHref}`}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "block truncate text-sm underline-offset-2 hover:underline",
              emailValue ? "mt-0.5 text-ink-muted" : "text-ink",
            )}
            title={phoneLabel}
          >
            {phoneLabel}
          </a>
        ) : (
          <p
            className={
              emailValue
                ? "mt-0.5 truncate text-sm text-ink-muted"
                : "truncate text-sm text-ink"
            }
            title={phoneLabel}
          >
            {phoneLabel}
          </p>
        )
      ) : null}
    </div>
  );
}

function lastBookingLabel(value: string | null | undefined): string {
  if (!value?.trim()) return "None yet";
  return formatBookingDate(value);
}

function emptyMessage(
  hasActiveFilters: boolean,
  searchQuery: string,
): string {
  const q = searchQuery.trim();
  if (q) {
    return `No clients match “${q}”. Try another search or clear filters.`;
  }
  if (hasActiveFilters) {
    return "No one matches these filters. Clear them or try a different search.";
  }
  return "No clients yet. Add your first guest with New client.";
}

export function ClientsTable({
  clients,
  loading,
  hasActiveFilters = false,
  searchQuery = "",
}: ClientsTableProps) {
  if (loading && clients.length === 0) {
    return <PageLoader className="min-h-[min(40vh,18rem)]" size="sm" />;
  }

  if (!loading && clients.length === 0) {
    return (
      <EmptyState
        icon={LuUsers}
        message={emptyMessage(hasActiveFilters, searchQuery)}
      />
    );
  }

  const mobileCards = clients.map((client) => (
    <MobileCard key={client.id} className="relative">
      <Link
        href={pageRoutes.client(client.id)}
        className="absolute inset-0 z-0 rounded-none"
        aria-label={`Open ${client.display_name}`}
      />
      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <UserAvatar
            name={client.display_name}
            email={client.email ?? undefined}
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="truncate font-medium text-ink">{client.display_name}</p>
              <ClientBadges client={client} />
            </div>
            <div className="pointer-events-auto mt-1.5">
              <ContactCell email={client.email} phone={client.phone} />
            </div>
            <p className="mt-1.5 text-xs text-ink-muted">
              Last booking: {lastBookingLabel(client.stats.last_booking_date)}
            </p>
          </div>
        </div>
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted"
          aria-hidden
        >
          <LuChevronRight className="h-4 w-4" />
        </span>
      </div>
    </MobileCard>
  ));

  return (
    <div
      className={cn(
        "transition-opacity",
        loading && clients.length > 0 && "pointer-events-none opacity-60",
      )}
      aria-busy={loading}
    >
      <ResponsiveTable
        minWidthClassName="min-w-[40rem]"
        columns={["Client", "Contact", "Last booking", ""]}
        mobile={mobileCards}
      >
        {clients.map((client) => (
          <TableRow key={client.id}>
            <TableCell>
              <Link
                href={pageRoutes.client(client.id)}
                className="flex min-w-0 max-w-[20rem] items-center gap-3"
              >
                <UserAvatar
                  name={client.display_name}
                  email={client.email ?? undefined}
                />
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p
                      className="truncate font-medium text-ink"
                      title={client.display_name}
                    >
                      {client.display_name}
                    </p>
                    <ClientBadges client={client} />
                  </div>
                  {client.family_name ? (
                    <p
                      className="mt-0.5 truncate text-sm text-ink-muted"
                      title={client.family_name}
                    >
                      Family: {client.family_name}
                    </p>
                  ) : null}
                </div>
              </Link>
            </TableCell>
            <TableCell>
              <ContactCell email={client.email} phone={client.phone} />
            </TableCell>
            <TableCell
              className={
                client.stats.last_booking_date
                  ? "whitespace-nowrap text-sm text-ink"
                  : "whitespace-nowrap text-sm text-ink-muted"
              }
            >
              {lastBookingLabel(client.stats.last_booking_date)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right">
              <Link
                href={pageRoutes.client(client.id)}
                className={studioButtonClass("secondary", "sm")}
                aria-label={`Open ${client.display_name}`}
              >
                Open
                <LuChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </ResponsiveTable>
    </div>
  );
}
