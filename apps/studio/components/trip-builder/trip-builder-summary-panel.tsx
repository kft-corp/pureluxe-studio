"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LuX } from "react-icons/lu";

import { studioButtonClass } from "@/components/ui";
import { getTripBuilderReadiness } from "@/lib/api";
import type { TripDetail, TripRateSnapshot, TripStaySnapshot } from "@/lib/trip-builder";
import { formatTripStatus } from "@/lib/trips/journey-format";
import { cn } from "@/lib/utils/cn";

import { OptionsQuotePanel } from "./options-quote-panel";
import {
  buildQuoteBreakup,
  nightsLabel,
  stayNightCount,
  tripNightCount,
} from "./quote-price";
import { formatStayDates, stayGapNotes, tripStays } from "./stages";

type SummaryTab = "summary" | "quote";

type TripBuilderSummaryPanelProps = {
  detail: TripDetail | null;
  activeLegId: string | null;
  open: boolean;
  canWrite: boolean;
  busy: boolean;
  onClose: () => void;
  onSelectStay: (legId: string) => void;
  onOpenOptions: () => void;
  onRegenerateOptions: () => void;
  onChooseSavedOption: (lineItemId: string) => void;
};

function moneyLabel(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount == null) return null;
  const code = currency?.trim() || "";
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return code ? `${code} ${formatted}` : formatted;
}

function datesWithNights(checkIn: string | null, checkOut: string | null): string | null {
  const dates = formatStayDates(checkIn, checkOut);
  const nights = stayNightCount(checkIn, checkOut);
  if (!dates) return null;
  if (nights == null) return dates;
  return `${dates} · ${nightsLabel(nights)}`;
}

function cityIsRepeated(stay: TripStaySnapshot, stays: TripStaySnapshot[]): boolean {
  const city = stay.city.trim().toLowerCase();
  if (!city) return false;
  return stays.filter((row) => row.city.trim().toLowerCase() === city).length > 1;
}

function stayHeading(stay: TripStaySnapshot, stays: TripStaySnapshot[]): string {
  const city = stay.city.trim() || "Stay";
  if (!cityIsRepeated(stay, stays)) return city;
  const dates = formatStayDates(stay.check_in, stay.check_out);
  return dates ? `${city} · ${dates}` : city;
}

function travellerLabel(person: TripDetail["travellers"][number]): string {
  if (person.role === "primary") return "Lead";
  if (person.party_role === "child") return "Child";
  if (person.family_role && person.family_role !== "member" && person.family_role !== "primary") {
    return person.family_role.charAt(0).toUpperCase() + person.family_role.slice(1);
  }
  return "Adult";
}

function partyLabel(stay: TripStaySnapshot): string | null {
  const parts: string[] = [];
  if (stay.adults != null) {
    parts.push(stay.adults === 1 ? "1 adult" : `${stay.adults} adults`);
  }
  if (stay.children != null && stay.children > 0) {
    parts.push(stay.children === 1 ? "1 child" : `${stay.children} children`);
  }
  if (stay.rooms != null) {
    parts.push(stay.rooms === 1 ? "1 room" : `${stay.rooms} rooms`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function selectedRate(detail: TripDetail, legId: string): TripRateSnapshot | null {
  return (
    detail.rates.candidates.find((row) => row.selected && row.leg_id === legId) ?? null
  );
}

/** Changes when travellers, dates, or hotels change, so the checks reload. */
function readinessKey(detail: TripDetail): string {
  return [
    detail.trip.id,
    detail.trip.updated_at,
    detail.trip.starts_on,
    detail.trip.ends_on,
    ...detail.travellers.map((person) => `${person.client_id}:${person.party_role}`),
    ...detail.stays.map((stay) => `${stay.leg_id}:${stay.check_in}:${stay.check_out}:${stay.property_id}`),
  ].join("|");
}

/** Before-booking checks for the open trip. Null until loaded. */
function useReadiness(detail: TripDetail | null, open: boolean): string[] | null {
  const [loaded, setLoaded] = useState<{ key: string; items: string[] } | null>(null);
  const tripId = detail?.trip.id ?? null;
  const key = detail ? readinessKey(detail) : null;

  useEffect(() => {
    if (!open || !tripId || !key) return;
    let live = true;
    getTripBuilderReadiness(tripId)
      .then((response) => {
        if (live) setLoaded({ key, items: response.data.readiness });
      })
      .catch(() => {
        if (live) setLoaded({ key, items: [] });
      });
    return () => {
      live = false;
    };
  }, [open, tripId, key]);

  return loaded?.key === key ? loaded.items : null;
}

/**
 * Optional sidebar, laid out like the trip-builder mock:
 * Summary holds the trip and one card per stay. Quote holds rates and the PDF.
 */
export function TripBuilderSummaryPanel({
  detail,
  activeLegId,
  open,
  canWrite,
  busy,
  onClose,
  onSelectStay,
  onOpenOptions,
  onRegenerateOptions,
  onChooseSavedOption,
}: TripBuilderSummaryPanelProps) {
  const [tab, setTab] = useState<SummaryTab>("summary");
  const readiness = useReadiness(detail, open);
  if (!open) return null;

  const stays = detail ? tripStays(detail) : [];
  const gaps = stayGapNotes(stays);
  const nights = tripNightCount(stays);
  const savedOptions = detail
    ? detail.rates.candidates.filter((row) => !row.selected).length
    : 0;

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-20 bg-[#141414]/20 lg:hidden"
        aria-label="Close summary"
        onClick={onClose}
      />
      <aside className="absolute inset-0 z-30 flex w-full flex-col border-l border-[#e8e6e1] bg-[#f9f8f6] pb-[env(safe-area-inset-bottom)] shadow-xl lg:static lg:inset-auto lg:z-0 lg:w-[24rem] lg:shrink-0 lg:pb-0 lg:shadow-none">
        <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-1.5">
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-[#ebe8e2] px-1.5 py-0.5 text-[10px] font-semibold text-[#141414]">
              {detail ? formatTripStatus(detail.trip.status) : "Optional"}
            </span>
            <h2 className="mt-1.5 text-sm leading-5 font-semibold break-words text-[#141414]">
              {detail?.client?.display_name?.trim() || "No client yet"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-[#6b6b6b] hover:bg-white lg:h-7 lg:w-7"
            aria-label="Close summary"
          >
            <LuX className="h-5 w-5 lg:h-3.5 lg:w-3.5" aria-hidden />
          </button>
        </div>

        {detail ? (
          <div role="tablist" aria-label="Summary sections" className="flex gap-0.5 border-b border-[#e8e6e1] px-1.5">
            {(
              [
                ["summary", "Summary"],
                ["quote", "Quote"],
              ] as const
            ).map(([id, label]) => {
              const on = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(id)}
                  className={cn(
                    "min-h-11 border-b-2 px-3 text-[13px] lg:min-h-0 lg:px-1.5 lg:py-2 lg:text-[12px]",
                    on
                      ? "border-[#0b0b0c] font-semibold text-[#141414]"
                      : "border-transparent text-[#6b6b6b] hover:text-[#141414]",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5">
          {!detail ? (
            <p className="text-[12px] leading-relaxed text-[#6b6b6b]">
              Open a trip to see the client, dates, and each stay. The quote can still be finished in chat.
            </p>
          ) : tab === "summary" ? (
            <div role="tabpanel">
              <Block title="Trip">
                <div className="rounded-[10px] border border-[#e8e6e1] bg-white px-3 py-1.5">
                  <Kv
                    label="Dates"
                    value={formatStayDates(detail.trip.starts_on, detail.trip.ends_on)}
                  />
                  <Kv label="Nights" value={nights == null ? null : nightsLabel(nights)} />
                  <Kv label="Pricing" value={detail.pricing_locked ? "Locked" : "Editable"} />
                </div>
              </Block>

              <Block title="Travellers">
                {detail.travellers.length === 0 ? (
                  <p className="text-[12px] text-[#6b6b6b]">No travellers yet.</p>
                ) : (
                  <div className="rounded-[10px] border border-[#e8e6e1] bg-white px-3 py-1.5">
                    {detail.travellers.map((person) => (
                      <Kv
                        key={person.client_id}
                        label={travellerLabel(person)}
                        value={person.display_name}
                      />
                    ))}
                  </div>
                )}
              </Block>

              {readiness && detail.travellers.length > 0 ? (
                <Block title="Before booking">
                  {readiness.length === 0 ? (
                    <p className="text-[12px] text-[#6b6b6b]">Nothing flagged.</p>
                  ) : (
                    <ul className="space-y-1 rounded-[10px] bg-[#f7f1e6] px-2.5 py-2 text-[11px] leading-relaxed text-[#5c4a32]">
                      {readiness.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </Block>
              ) : null}

              <Block title="Stays">
                {gaps.length > 0 ? (
                  <p className="mb-1.5 rounded-[10px] bg-[#f7f1e6] px-2.5 py-2 text-[11px] leading-relaxed text-[#5c4a32]">
                    {gaps.join(" · ")}
                  </p>
                ) : null}
                {stays.length === 0 ? (
                  <p className="text-[12px] text-[#6b6b6b]">No stays yet.</p>
                ) : (
                  <div className="space-y-2">
                    {stays.map((stay) => (
                      <StayCard
                        key={stay.leg_id}
                        stay={stay}
                        stays={stays}
                        rate={selectedRate(detail, stay.leg_id)}
                        active={stay.leg_id === activeLegId}
                        onSelect={() => onSelectStay(stay.leg_id)}
                      />
                    ))}
                  </div>
                )}
              </Block>

              {savedOptions > 0 ? (
                <p className="mt-2 text-[12px] leading-relaxed text-[#6b6b6b]">
                  {savedOptions === 1
                    ? "1 room is saved for the options quote."
                    : `${savedOptions} rooms are saved for the options quote.`}{" "}
                  They stay here until the client chooses one.
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => setTab("quote")}
                className={cn(studioButtonClass("primary", "sm"), "mt-1.5 h-11 w-full sm:h-8")}
              >
                View quote
              </button>
            </div>
          ) : (
            <div role="tabpanel">
              <OptionsQuotePanel
                detail={detail}
                stays={stays}
                canWrite={canWrite}
                canChoose={canWrite}
                busy={busy}
                onOpen={onOpenOptions}
                onRegenerate={onRegenerateOptions}
                onChoose={onChooseSavedOption}
              />
              <Block title="Rates">
                {stays.length === 0 ? (
                  <p className="text-[12px] text-[#6b6b6b]">
                    No rates yet. Save a stay, then search or paste a quote.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {stays.map((stay) => {
                      const rate = selectedRate(detail, stay.leg_id);
                      const current = stay.leg_id === activeLegId;
                      const place = cityIsRepeated(stay, stays)
                        ? stayHeading(stay, stays)
                        : stay.city;
                      return (
                        <button
                          key={stay.leg_id}
                          type="button"
                          onClick={() => onSelectStay(stay.leg_id)}
                          aria-pressed={current}
                          className={cn(
                            "w-full rounded-[10px] bg-white px-2.5 py-2 text-left text-[12px]",
                            rate ? "border-2 border-[#1a4d3e]" : "border border-[#e8e6e1]",
                          )}
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0 font-semibold break-words text-[#141414]">
                              {stay.property_name?.trim() || stay.city || "Stay"}
                            </span>
                            {current ? (
                              <span className="shrink-0 rounded-full bg-[#e8f2ee] px-1.5 py-0.5 text-[10px] leading-4 font-semibold tracking-wide text-[#1a4d3e] uppercase">
                                Current
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-[#6b6b6b]">{place}</span>
                          <span className="mt-0.5 block text-[11px] leading-5 break-words whitespace-normal text-[#6b6b6b]">
                            {rate
                              ? rate.subtitle?.trim() || rate.title
                              : "No rate selected"}
                          </span>
                          {rate ? (
                            <span className="mt-1 grid grid-cols-[3.25rem_1fr] gap-2 text-[11px]">
                              <span className="text-[#6b6b6b]">Net</span>
                              <span className="font-semibold text-[#141414]">
                                {moneyLabel(rate.cost_internal, rate.currency) || "Not set"}
                              </span>
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Block>

              <Block title="Price">
                <PriceBreakup detail={detail} stays={stays} />
              </Block>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-3">
      <h3 className="mb-1 text-[10px] font-medium tracking-[0.05em] text-[#6b6b6b] uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Kv({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] items-baseline gap-2 py-1 text-[13px] leading-5">
      <span className="font-normal text-[#6b6b6b]">{label}</span>
      <span className="font-medium break-words text-[#141414]">{value?.trim() || "Not set"}</span>
    </div>
  );
}

function PriceBreakup({
  detail,
  stays,
}: {
  detail: TripDetail;
  stays: TripStaySnapshot[];
}) {
  const price = buildQuoteBreakup({
    stays,
    rates: detail.rates.candidates,
    sellTotal: detail.quote.sell_total,
    sellCurrency: detail.quote.sell_currency,
  });
  const rows = [
    ["Hotel net", price.hotelNet],
    ["Tax", price.tax],
    ["Margin", price.margin && price.marginPercent ? `${price.margin} (${price.marginPercent})` : price.margin],
    ["Client price", price.clientPrice],
  ] as const;

  return (
    <div className="rounded-[10px] border border-[#e8e6e1] bg-white px-3 py-1.5">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className={cn(
            "grid grid-cols-[6.25rem_1fr] items-baseline gap-2 py-1 text-[13px] leading-5",
            label === "Client price" && "mt-0.5 border-t border-[#e8e6e1] pt-1.5",
          )}
        >
          <span className="font-normal text-[#6b6b6b]">{label}</span>
          <span
            className={cn(
              "font-medium break-words text-[#141414]",
              label === "Client price" && "font-semibold",
            )}
          >
            {value?.trim() || "Not set"}
          </span>
        </div>
      ))}
      {price.pricedLabel ? (
        <p className="py-1 text-[11px] leading-relaxed text-[#6b6b6b]">{price.pricedLabel}</p>
      ) : null}
      {price.note ? (
        <p className="pb-1 text-[11px] leading-relaxed text-[#6b6b6b]">{price.note}</p>
      ) : null}
    </div>
  );
}

function StayCard({
  stay,
  stays,
  rate,
  active,
  onSelect,
}: {
  stay: TripStaySnapshot;
  stays: TripStaySnapshot[];
  rate: TripRateSnapshot | null;
  active: boolean;
  onSelect: () => void;
}) {
  const dates = datesWithNights(stay.check_in, stay.check_out);
  const party = partyLabel(stay);
  const hotel = stay.property_name?.trim();
  const city = stayHeading(stay, stays);
  const rateName = rate ? rate.subtitle?.trim() || rate.title : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "w-full rounded-[10px] bg-white px-3 py-2.5 text-left",
        active ? "border-2 border-[#1a4d3e]" : "border border-[#e8e6e1]",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-[13px] leading-5 font-semibold break-words text-[#141414]">
          {city}
        </span>
        {active ? (
          <span className="shrink-0 rounded-full bg-[#e8f2ee] px-1.5 py-0.5 text-[10px] leading-4 font-semibold tracking-wide text-[#1a4d3e] uppercase">
            Current
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 block space-y-0.5">
        <CardLine label="Hotel" value={hotel} />
        <CardLine label="Dates" value={dates} wrap />
        <CardLine label="Guests" value={party} />
        <CardLine label="Rate" value={rateName} wrap />
      </span>
    </button>
  );
}

function CardLine({
  label,
  value,
  wrap = false,
}: {
  label: string;
  value: string | null | undefined;
  wrap?: boolean;
}) {
  return (
    <span className="grid grid-cols-[3.25rem_1fr] items-start gap-2">
      <span className="text-[11px] leading-5 font-normal text-[#6b6b6b]">{label}</span>
      <span
        className={cn(
          "text-[12px] leading-5 font-medium text-[#141414]",
          wrap ? "whitespace-normal break-words" : "truncate",
        )}
      >
        {value?.trim() || "Not set"}
      </span>
    </span>
  );
}
