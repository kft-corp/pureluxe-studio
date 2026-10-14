import Link from "next/link";
import type { IconType } from "react-icons";
import {
  LuArrowLeft,
  LuBus,
  LuCircleDollarSign,
  LuCoins,
  LuFileText,
  LuHotel,
  LuLuggage,
  LuMinus,
  LuPercent,
  LuPlane,
} from "react-icons/lu";

import { ClientVipBadge } from "@/components/clients/client-vip-badge";
import { JourneyHeroActions, JourneyQuoteFileButtons } from "@/components/trips/journey-actions";
import { JourneyPhasePill } from "@/components/trips/journey-phase-pill";
import {
  ContentSection,
  DetailField,
  PageStack,
  PageToolbar,
  SnapshotCard,
  studioButtonClass,
} from "@/components/ui";
import type { JourneyPageModel, JourneyStop, JourneyStopKind } from "@/lib/trips";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

const STOP_ICONS: Record<JourneyStopKind, IconType> = {
  flight: LuPlane,
  stay: LuHotel,
  transfer: LuBus,
  gap: LuMinus,
};

const STOP_LABELS: Record<JourneyStopKind, string> = {
  flight: "Flight",
  stay: "Hotel",
  transfer: "Transfer",
  gap: "Between stays",
};

export function JourneyPage({
  journey,
  canWrite,
}: {
  journey: JourneyPageModel;
  canWrite: boolean;
}) {
  const meta = [
    journey.partyLabel,
    journey.ownerName ? `Owner ${journey.ownerName}` : "No owner",
  ];

  return (
    <PageStack className="min-w-0">
      <div>
        <Link
          href={pageRoutes.trips}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-ink"
        >
          <LuArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          All trips
        </Link>
      </div>

      <PageToolbar className="min-w-0 overflow-hidden bg-[linear-gradient(180deg,var(--surface-raised)_0%,var(--surface)_100%)]">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-ink shadow-sm sm:h-16 sm:w-16">
              <LuLuggage className="h-5 w-5 sm:h-7 sm:w-7" strokeWidth={1.5} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="max-w-full wrap-break-word font-serif text-xl font-medium tracking-tight text-ink sm:text-3xl">
                  {journey.title}
                </h2>
                <JourneyPhasePill journey={journey} />
                <ClientVipBadge tier={journey.tierSlug} />
              </div>
              <p className="mt-1 wrap-break-word text-sm text-ink-muted">
                {journey.routeLabel ?? "Places not set yet"}
              </p>
              <p className="mt-2 wrap-break-word text-sm text-ink-muted">
                {journey.clientId && journey.clientName ? (
                  <Link
                    href={pageRoutes.client(journey.clientId)}
                    className="font-medium text-ink underline-offset-2 transition hover:underline"
                  >
                    {journey.clientName}
                  </Link>
                ) : (
                  <span>{journey.clientName ?? "No client"}</span>
                )}
                {meta.map((item) => (
                  <span key={item}> · {item}</span>
                ))}
              </p>
            </div>
          </div>

          <JourneyHeroActions
            tripId={journey.id}
            status={journey.status}
            quoteReady={journey.quoteReady}
            quoteFile={journey.quoteFile}
            canWrite={canWrite}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SnapshotCard
            label="Travel dates"
            value={journey.datesLabel ?? "Not set"}
            hint={journey.nightsLabel ?? "Set the trip dates in Trip Builder"}
          />
          <SnapshotCard label="Stage" value={journey.stageLabel} hint={journey.travelLabel} />
          <SnapshotCard label="Next step" value={journey.nextStep} hint="What to do next" />
          <SnapshotCard label="Sell price" value={journey.sellLabel} hint={journey.priceHint} />
        </div>
      </PageToolbar>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.9fr)]">
        <ContentSection
          title="Itinerary"
          description="Flights, hotels, and transfers in the order the guest travels."
          className="min-w-0"
        >
          {journey.stops.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-muted sm:px-6">
              No flights, hotels, or transfers yet. Plan them in Trip Builder.
            </p>
          ) : (
            <ol>
              {journey.stops.map((stop, index) => (
                <JourneyStopRow
                  key={stop.id}
                  stop={stop}
                  last={index === journey.stops.length - 1}
                />
              ))}
            </ol>
          )}
        </ContentSection>

        <div className="grid min-w-0 gap-5">
          <SideList
            title="Travellers"
            description="People named on this trip."
            empty="No travellers yet."
            rows={journey.travellers.map((person) => ({
              id: person.id,
              primary: person.name,
              secondary: person.roleLabel,
            }))}
          />
          <DocumentsSection journey={journey} />
          <ContentSection title="Price" description="Team figures. Guests never see cost or margin.">
            <div className="divide-y divide-border/70">
              <DetailField icon={LuCircleDollarSign} label="Sell" value={journey.sellLabel} />
              <DetailField icon={LuCoins} label="Cost" value={journey.costLabel ?? "—"} />
              <DetailField icon={LuPercent} label="Margin" value={journey.marginLabel ?? "—"} />
            </div>
          </ContentSection>
        </div>
      </div>
    </PageStack>
  );
}

function JourneyStopRow({ stop, last }: { stop: JourneyStop; last: boolean }) {
  const Icon = STOP_ICONS[stop.kind];
  const quiet = stop.kind === "gap";

  return (
    <li className="relative flex gap-4 px-5 py-4 sm:px-6">
      {last ? null : (
        <span
          className="absolute top-9 bottom-0 left-10 w-px -translate-x-1/2 bg-border sm:left-11"
          aria-hidden
        />
      )}
      <span
        className={cn(
          "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          quiet
            ? "border-border bg-surface text-ink-muted"
            : stop.complete
              ? "border-ink bg-ink text-surface"
              : "border-dashed border-border bg-surface text-ink-muted",
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pt-0.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
            {STOP_LABELS[stop.kind]}
          </p>
          <p className={cn("mt-1 wrap-break-word text-sm font-semibold leading-snug", quiet ? "text-ink-muted" : "text-ink")}>
            {stop.title}
          </p>
          {stop.detail ? (
            <p className="mt-0.5 wrap-break-word text-sm text-ink-muted">{stop.detail}</p>
          ) : null}
        </div>
        {stop.status || stop.bookingId ? (
          <div className="flex shrink-0 flex-col items-end gap-2">
            {stop.status ? <StopStatus status={stop.status} /> : null}
            {stop.bookingId ? (
              <Link
                href={pageRoutes.booking(stop.bookingId)}
                className={studioButtonClass("secondary", "sm")}
              >
                Booking
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function StopStatus({ status }: { status: NonNullable<JourneyStop["status"]> }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        status === "Confirmed" && "bg-emerald-50 text-emerald-800 ring-emerald-600/10",
        status === "Pending" && "bg-amber-50 text-amber-800 ring-amber-600/10",
        status !== "Confirmed" && status !== "Pending" && "bg-stone-100 text-stone-600 ring-stone-500/10",
      )}
    >
      {status}
    </span>
  );
}

function DocumentsSection({ journey }: { journey: JourneyPageModel }) {
  return (
    <ContentSection
      title="Documents"
      description="The quote PDF the client receives, generated in Trip Builder."
    >
      {journey.documents.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-muted sm:px-6">
          No quote yet. Generate it in Trip Builder.
        </p>
      ) : (
        <ul className="divide-y divide-border/70">
          {journey.documents.map((document) => (
            <li key={document.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-ink-muted">
                <LuFileText className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{document.label}</p>
                {document.stale && journey.status === "building" ? (
                  <p className="text-xs text-amber-800">Out of date · regenerate in Trip Builder</p>
                ) : (
                  <p className="text-xs text-ink-muted">
                    {journey.status === "building" || journey.status === "cancelled"
                      ? document.statusLabel
                      : "The copy the client has"}
                  </p>
                )}
              </div>
              {journey.quoteFile ? <JourneyQuoteFileButtons tripId={journey.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </ContentSection>
  );
}

function SideList({
  title,
  description,
  empty,
  rows,
}: {
  title: string;
  description: string;
  empty: string;
  rows: Array<{ id: string; primary: string; secondary: string }>;
}) {
  return (
    <ContentSection title={title} description={description} count={rows.length || undefined}>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-muted sm:px-6">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/70">
          {rows.map((row) => (
            <li key={row.id} className="flex items-baseline justify-between gap-3 px-5 py-3.5 sm:px-6">
              <span className="truncate text-sm font-medium text-ink">{row.primary}</span>
              <span className="shrink-0 text-xs text-ink-muted">{row.secondary}</span>
            </li>
          ))}
        </ul>
      )}
    </ContentSection>
  );
}
