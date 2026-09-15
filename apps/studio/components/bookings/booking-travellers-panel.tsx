"use client";

import Link from "next/link";
import { LuPencil, LuTrash2 } from "react-icons/lu";

import {
  ActionButton,
  ContentSection,
  UserAvatar,
  studioButtonClass,
} from "@/components/ui";
import type { BookingTraveller } from "@pureluxe/db";
import {
  formatBookingDate,
  formatTravellerGender,
  formatTravellerRole,
} from "@/lib/bookings";
import { formatNationality } from "@/lib/clients";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

import { ListEmpty, ScrollRegion } from "./booking-detail-shared";

type BookingTravellersPanelProps = {
  travellers: BookingTraveller[];
  canWrite: boolean;
  busy?: boolean;
  onAdd: () => void;
  onEdit: (travellerId: string) => void;
  onDelete: (travellerId: string) => void;
};

function travellerMeta(traveller: BookingTraveller): string {
  const parts = [
    formatTravellerRole(traveller.role),
    formatTravellerGender(traveller.gender) !== "—"
      ? formatTravellerGender(traveller.gender)
      : null,
    traveller.date_of_birth
      ? `Born ${formatBookingDate(traveller.date_of_birth)}`
      : null,
  ].filter(Boolean);

  const nationality = traveller.passport_nationality?.trim()
    ? formatNationality(traveller.passport_nationality)
    : null;

  const passport = [
    traveller.passport_number?.trim()
      ? `Passport ${traveller.passport_number.trim()}`
      : null,
    nationality && nationality !== "—" ? nationality : null,
    traveller.passport_expiry
      ? `Expires ${formatBookingDate(traveller.passport_expiry)}`
      : null,
  ].filter(Boolean);

  const line = [...parts, ...passport].join(" · ");
  return line || "Passport details not recorded";
}

export function BookingTravellersPanel({
  travellers,
  canWrite,
  busy = false,
  onAdd,
  onEdit,
  onDelete,
}: BookingTravellersPanelProps) {
  return (
    <ContentSection
      title="Travellers"
      description="Named guests on this reservation, including passport details for ticketing and hotels."
      count={travellers.length}
      className="min-w-0"
      action={
        canWrite ? (
          <ActionButton onClick={onAdd} disabled={busy}>
            Add traveller
          </ActionButton>
        ) : null
      }
    >
      {travellers.length > 0 ? (
        <ScrollRegion enabled={travellers.length > 6}>
          <ul className="divide-y divide-border/80">
            {travellers.map((traveller) => {
              const name = [traveller.title?.trim(), traveller.full_name]
                .filter(Boolean)
                .join(" ");
              const meta = travellerMeta(traveller);

              return (
                <li key={traveller.id}>
                  <div className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                    <UserAvatar name={name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className="max-w-full wrap-break-word text-sm font-semibold text-ink"
                          title={name}
                        >
                          {name}
                        </p>
                        <span className="shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-ink">
                          {formatTravellerRole(traveller.role)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                        {meta}
                      </p>
                      {traveller.client_id ? (
                        <Link
                          href={pageRoutes.client(traveller.client_id)}
                          className="mt-1 inline-block text-xs font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                        >
                          Open linked client
                        </Link>
                      ) : null}
                    </div>
                    {canWrite ? (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`Edit ${name}`}
                          onClick={() => onEdit(traveller.id)}
                          className={cn(
                            studioButtonClass("ghost", "sm"),
                            "px-2",
                          )}
                        >
                          <LuPencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`Remove ${name}`}
                          onClick={() => onDelete(traveller.id)}
                          className={cn(
                            studioButtonClass("ghost", "sm"),
                            "px-2 text-red-700",
                          )}
                        >
                          <LuTrash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollRegion>
      ) : (
        <ListEmpty
          message={
            canWrite
              ? "No travellers yet. Add guests here, or they'll arrive when Trip Builder books this stay."
              : "No travellers recorded on this reservation."
          }
        />
      )}
    </ContentSection>
  );
}
