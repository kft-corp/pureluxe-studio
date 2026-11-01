"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuChevronRight, LuUsers } from "react-icons/lu";
import { phoneDigitsForHref } from "@pureluxe/shared";

import { SkeletonRegion, TableSkeleton } from "@/components/feedback";
import { EmptyState, StatusBadge, UserAvatar } from "@/components/ui";
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

const COLUMNS = ["Traveller", "Contact", "Last trip", "Profile", ""];
const MIN_WIDTH = "min-w-[44rem]";

export function ClientsTableSkeleton() {
  return <TableSkeleton columns={COLUMNS} minWidthClassName={MIN_WIDTH} />;
}

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
      <span className="text-[14px] text-ink-muted">No email or phone</span>
    );
  }

  return (
    <div className="min-w-0 max-w-full">
      {emailValue ? (
        <a
          href={`mailto:${emailValue}`}
          onClick={(event) => event.stopPropagation()}
          className="block truncate text-[14px] text-ink underline-offset-2 hover:underline"
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
              "block truncate text-[14px] underline-offset-2 hover:underline",
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
                ? "mt-0.5 truncate text-[14px] text-ink-muted"
                : "truncate text-[14px] text-ink"
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

function lastTripLabel(value: string | null | undefined): string {
  if (!value?.trim()) return "No trips yet";
  return formatBookingDate(value);
}

/** Travel cue under the name — last trip / stays / family. */
function travellerCue(client: ClientDirectoryItem): string {
  const lastTrip = client.stats.last_booking_date
    ? `Last trip · ${formatBookingDate(client.stats.last_booking_date)}`
    : null;
  const stays =
    client.stats.booking_count > 0
      ? `${client.stats.booking_count} stay${client.stats.booking_count === 1 ? "" : "s"}`
      : null;
  const family = client.family_name ? `Travels with · ${client.family_name}` : null;

  if (lastTrip || stays) {
    return [lastTrip, stays, family].filter(Boolean).join(" · ");
  }
  if (family) return family;
  return "Ready for a first trip";
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
  return "No travellers yet. Add your first guest with New client.";
}

function ClientDirectoryRow({ client }: { client: ClientDirectoryItem }) {
  const router = useRouter();

  return (
    <TableRow
      onClick={() => {
        router.push(pageRoutes.client(client.id));
      }}
    >
      <TableCell>
        <div className="flex min-w-0 max-w-[20rem] items-center gap-3">
          <UserAvatar
            name={client.display_name}
            email={client.email ?? undefined}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p
                className="truncate text-[15px] font-semibold text-ink"
                title={client.display_name}
              >
                {client.display_name}
              </p>
              <ClientBadges client={client} />
            </div>
            <p
              className="mt-0.5 truncate text-[14px] text-ink-muted"
              title={travellerCue(client)}
            >
              {travellerCue(client)}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <ContactCell email={client.email} phone={client.phone} />
      </TableCell>
      <TableCell
        className={
          client.stats.last_booking_date
            ? "whitespace-nowrap text-[15px] text-ink"
            : "whitespace-nowrap text-[15px] text-ink-muted"
        }
      >
        {lastTripLabel(client.stats.last_booking_date)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-[15px] text-ink">
        {client.profile_completeness}%
      </TableCell>
      <TableCell className="whitespace-nowrap text-right">
        <Link
          href={pageRoutes.client(client.id)}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex text-ink-muted"
          aria-label={`Open ${client.display_name}`}
        >
          <LuChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </TableCell>
    </TableRow>
  );
}

export function ClientsTable({
  clients,
  loading,
  hasActiveFilters = false,
  searchQuery = "",
}: ClientsTableProps) {
  if (loading && clients.length === 0) {
    return (
      <SkeletonRegion label="Loading clients">
        <ClientsTableSkeleton />
      </SkeletonRegion>
    );
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
              <p className="truncate text-[15px] font-semibold text-ink">
                {client.display_name}
              </p>
              <ClientBadges client={client} />
            </div>
            <p className="mt-1 truncate text-[14px] text-ink-muted">
              {travellerCue(client)}
            </p>
            <div className="pointer-events-auto mt-1.5">
              <ContactCell email={client.email} phone={client.phone} />
            </div>
            <p className="mt-1.5 text-[13px] text-ink-muted">
              Profile {client.profile_completeness}%
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
        minWidthClassName={MIN_WIDTH}
        columns={COLUMNS}
        mobile={mobileCards}
      >
        {clients.map((client) => (
          <ClientDirectoryRow key={client.id} client={client} />
        ))}
      </ResponsiveTable>
    </div>
  );
}
