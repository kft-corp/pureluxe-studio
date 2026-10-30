"use client";

import { studioButtonClass } from "@/components/ui";
import type { TripDetail, TripRateSnapshot, TripStaySnapshot } from "@/lib/trip-builder";
import { isQuoteAccepted, isQuoteWithClient } from "@/lib/trips/trip-status";
import { cn } from "@/lib/utils/cn";

import { legPillLabel } from "./stages";

type OptionsQuotePanelProps = {
  detail: TripDetail;
  stays: TripStaySnapshot[];
  canWrite: boolean;
  canChoose: boolean;
  busy: boolean;
  onOpen: () => void;
  onRegenerate: () => void;
  onChoose: (lineItemId: string) => void;
};

type HotelGroup = {
  key: string;
  name: string;
  rooms: TripRateSnapshot[];
};

type StayGroup = {
  key: string;
  label: string;
  hotels: HotelGroup[];
};

function moneyLabel(amount: number | null, currency: string | null): string {
  if (amount == null) return "To be confirmed";
  const code = currency?.trim() || "";
  return code ? `${code} ${amount}` : String(amount);
}

function hotelNameFor(
  row: TripRateSnapshot,
  stays: TripStaySnapshot[],
): string {
  const stay = stays.find((item) => item.leg_id === row.leg_id);
  return row.property_name?.trim() || stay?.property_name?.trim() || stay?.city || "Hotel";
}

function hotelKeyFor(row: TripRateSnapshot, stays: TripStaySnapshot[]): string {
  if (row.property_id?.trim()) return `id:${row.property_id.trim()}`;
  return `name:${hotelNameFor(row, stays).toLowerCase()}`;
}

/** Keep rooms under one hotel box so several options at the same property stay together. */
function groupByHotel(
  rows: TripRateSnapshot[],
  stays: TripStaySnapshot[],
): HotelGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, HotelGroup>();
  for (const row of rows) {
    const key = hotelKeyFor(row, stays);
    const existing = byKey.get(key);
    if (existing) {
      existing.rooms.push(row);
      continue;
    }
    const name = hotelNameFor(row, stays);
    order.push(key);
    byKey.set(key, { key, name, rooms: [row] });
  }
  return order.map((key) => byKey.get(key)!);
}

/** Stay first (Maldives / India), then hotels under each — so multi-stay quotes stay clear. */
function groupByStay(
  rows: TripRateSnapshot[],
  stays: TripStaySnapshot[],
): StayGroup[] {
  const byLeg = new Map<string, TripRateSnapshot[]>();
  const unmatched: TripRateSnapshot[] = [];
  for (const row of rows) {
    const legId = row.leg_id?.trim();
    if (!legId) {
      unmatched.push(row);
      continue;
    }
    const list = byLeg.get(legId) ?? [];
    list.push(row);
    byLeg.set(legId, list);
  }

  const groups: StayGroup[] = [];
  for (const stay of stays) {
    const list = byLeg.get(stay.leg_id);
    if (!list?.length) continue;
    byLeg.delete(stay.leg_id);
    groups.push({
      key: stay.leg_id,
      label: legPillLabel(stay),
      hotels: groupByHotel(list, stays),
    });
  }

  for (const [legId, list] of byLeg) {
    if (!list.length) continue;
    const city = list[0]?.property_name?.trim() || "Stay";
    groups.push({
      key: legId,
      label: city,
      hotels: groupByHotel(list, stays),
    });
  }

  if (unmatched.length > 0) {
    groups.push({
      key: "unmatched",
      label: "Other options",
      hotels: groupByHotel(unmatched, stays),
    });
  }

  return groups;
}

export function OptionsQuotePanel({
  detail,
  stays,
  canWrite,
  canChoose,
  busy,
  onOpen,
  onRegenerate,
  onChoose,
}: OptionsQuotePanelProps) {
  const candidates = detail.rates.candidates;
  const options = candidates.filter(
    (row) =>
      !row.selected ||
      candidates.some((other) => !other.selected && other.leg_id === row.leg_id),
  );
  const stayGroups = groupByStay(options, stays);
  const showStayHeaders = stays.length > 1 || stayGroups.length > 1;
  const hasRoom = candidates.length > 0;
  const status = detail.options_quote.document?.status;
  const hasFile = Boolean(detail.options_quote.document?.has_file);
  const ready = status === "ready" && hasFile;
  const stale = status === "stale";
  const accepted = isQuoteAccepted(detail.trip.status);
  const withClient = isQuoteWithClient(detail.trip.status);
  const tripDone =
    detail.trip.status === "confirmed" || detail.trip.status === "completed";
  // Confirmed trips no longer shop options — Bookings hold the stays.
  if (tripDone) return null;
  if (options.length === 0 && !hasFile && !hasRoom) return null;
  // Happy path: Client accepted → then Client chose this.
  const canPickRoom = canChoose && accepted;

  return (
    <section className="mb-3">
      <h3 className="mb-1 text-[10px] font-medium tracking-[0.05em] text-ink-muted uppercase">
        Options for the client
      </h3>
      <p className="mb-2 text-[12px] leading-relaxed text-ink-muted">
        {accepted
          ? options.length > 0
            ? "Client said yes. Tap This is their room on the room they picked. Its sell from the quote becomes the trip sell."
            : "Client said yes. The quote opens as sent. To change it, reopen the quote on the trip page."
          : withClient
            ? "Quote is with the client. When they agree, mark Client said yes on the trip page, then tap This is their room. Changing the quote moves the trip back to Building."
            : options.length > 0
            ? "Send the quote and mark Client said yes on the trip page before recording the room choice."
            : "Open or regenerate the options quote to check the rooms saved on this trip."}
      </p>
      <div className="space-y-3">
        {stayGroups.map((group) => (
          <div key={group.key} className="space-y-2">
            {showStayHeaders ? (
              <p className="text-[11px] font-semibold tracking-[0.02em] text-ink">
                {group.label}
              </p>
            ) : null}
            {group.hotels.map((hotel) => (
              <HotelGroupCard
                key={`${group.key}:${hotel.key}`}
                hotel={hotel}
                canWrite={canPickRoom}
                pricingLocked={detail.pricing_locked}
                busy={busy}
                onChoose={onChoose}
              />
            ))}
          </div>
        ))}
      </div>
      {detail.options_quote.notes?.trim() ? (
        <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
          Note: {detail.options_quote.notes.trim()}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-between rounded-[10px] border border-border bg-surface-raised px-2.5 py-2.5">
        <strong className="text-[12px] text-ink">Options quote PDF</strong>
        <span className={cn("text-[11px] font-semibold", ready ? "text-success-ink" : stale ? "text-warning-ink" : "text-ink-muted")}>
          {ready ? "Ready" : stale ? "Out of date" : "Not generated"}
        </span>
      </div>
      <button
        type="button"
        disabled={busy || (!hasFile && !hasRoom)}
        onClick={onOpen}
        className={cn(studioButtonClass("secondary", "sm"), "mt-1.5 h-11 w-full lg:h-8")}
      >
        Open options quote
      </button>
      {canWrite && hasRoom && !accepted ? (
        <button
          type="button"
          disabled={busy}
          onClick={onRegenerate}
          className={cn(studioButtonClass("primary", "sm"), "mt-1.5 h-11 w-full lg:h-8")}
        >
          Regenerate options quote
        </button>
      ) : null}
    </section>
  );
}

function HotelGroupCard({
  hotel,
  canWrite,
  pricingLocked,
  busy,
  onChoose,
}: {
  hotel: HotelGroup;
  canWrite: boolean;
  pricingLocked: boolean;
  busy: boolean;
  onChoose: (lineItemId: string) => void;
}) {
  const roomLabel =
    hotel.rooms.length === 1 ? "1 room" : `${hotel.rooms.length} rooms`;

  return (
    <div className="rounded-[10px] border border-border bg-surface-raised px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-ink">{hotel.name}</p>
        </div>
        <span className="shrink-0 text-[11px] text-ink-muted">{roomLabel}</span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        {hotel.rooms.map((row) => (
          <OptionRoomRow
            key={row.id}
            row={row}
            canWrite={canWrite && (!pricingLocked || row.sell_amount != null)}
            busy={busy}
            onChoose={onChoose}
          />
        ))}
      </div>
    </div>
  );
}

function OptionRoomRow({
  row,
  canWrite,
  busy,
  onChoose,
}: {
  row: TripRateSnapshot;
  canWrite: boolean;
  busy: boolean;
  onChoose: (lineItemId: string) => void;
}) {
  const room = row.subtitle?.trim() || row.title;
  const team = moneyLabel(row.cost_internal, row.currency);
  return (
    <div className="rounded-[8px] border border-border bg-surface px-2.5 py-2">
      <p className="text-[12px] font-medium text-ink">{room}</p>
      <p className="mt-1 text-[12px] text-ink">Cost {team}</p>
      <p className="text-[12px] text-ink">
        Sell {moneyLabel(row.sell_amount, row.currency) ?? "Set markup"}
      </p>
      {row.selected ? (
        <p className="mt-1 text-[11px] font-semibold text-success-ink">Client&apos;s current choice</p>
      ) : canWrite ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onChoose(row.id)}
          className={cn(studioButtonClass("secondary", "sm"), "mt-1.5 h-11 w-full lg:h-8 lg:w-auto")}
        >
          This is their room
        </button>
      ) : null}
    </div>
  );
}
