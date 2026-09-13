"use client";

import Link from "next/link";
import { LuUser } from "react-icons/lu";

import { ContentSection, UserAvatar } from "@/components/ui";
import type { BookingTraveller } from "@pureluxe/db";
import {
  formatBookingDate,
  formatTravellerGender,
  formatTravellerRole,
} from "@/lib/bookings";
import { pageRoutes } from "@/lib/routes";

import { ListEmpty, ScrollRegion } from "./booking-detail-shared";

type BookingTravellersPanelProps = {
  travellers: BookingTraveller[];
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

  const passport = [
    traveller.passport_number?.trim()
      ? `Passport ${traveller.passport_number.trim()}`
      : null,
    traveller.passport_nationality?.trim() || null,
    traveller.passport_expiry
      ? `Expires ${formatBookingDate(traveller.passport_expiry)}`
      : null,
  ].filter(Boolean);

  const line = [...parts, ...passport].join(" · ");
  return line || "Passport details not recorded";
}

export function BookingTravellersPanel({
  travellers,
}: BookingTravellersPanelProps) {
  return (
    <ContentSection
      title="Travellers"
      description="Named guests on this reservation, including passport details for ticketing and hotels."
      count={travellers.length}
      className="min-w-0"
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
                      <p
                        className="mt-0.5 wrap-break-word text-xs leading-relaxed text-ink-muted"
                        title={meta}
                      >
                        {meta}
                      </p>
                      {traveller.client_id ? (
                        <Link
                          href={pageRoutes.client(traveller.client_id)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ink-muted underline-offset-2 transition hover:text-ink hover:underline"
                        >
                          <LuUser className="h-3 w-3 shrink-0" aria-hidden />
                          Open linked client
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollRegion>
      ) : (
        <ListEmpty message="No travellers have been added to this booking yet." />
      )}
    </ContentSection>
  );
}
