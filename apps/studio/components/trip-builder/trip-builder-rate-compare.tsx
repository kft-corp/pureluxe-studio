"use client";

import type { RateCompareCard, RateCompareHotel, RateCompareRoom } from "@pureluxe/ai/chat-stream";

import { clientPriceAtMarkup, formatRoomMoney, roundMoney } from "@/lib/rates/price-math";
import { cn } from "@/lib/utils/cn";

/** Kept for callers that still type the old Add callback; the rates table no longer shows Add. */
export type RateCompareAddOption = {
  hotel: string;
  room: string;
  markupPercent: number;
  rateRef: string;
};

function ratesAgeLabel(searchedAt: string | null | undefined): string | null {
  if (!searchedAt) return null;
  const ageMs = Date.now() - new Date(searchedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return null;
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return "Earlier";
}

function statusLabel(status: RateCompareHotel["status"]): string {
  switch (status) {
    case "no_rates":
      return "No rates";
    case "not_in_pureluxe":
      return "Not in PureLuxe";
    case "several_matches":
      return "Several matches";
    case "offline":
      return "Offline";
    case "timeout":
      return "Timed out";
    default:
      return status.replaceAll("_", " ");
  }
}

function mealPlanLabel(board: string | null | undefined): string {
  const raw = board?.trim();
  if (!raw) return "—";
  const key = raw.toLowerCase().replace(/\s+/g, " ");
  if (key === "hb" || key === "half board") return "Half board";
  if (key === "fb" || key === "full board") return "Full board";
  if (key === "bb" || key === "bed & breakfast" || key === "bed and breakfast") return "Breakfast";
  if (key === "ai" || key === "all inclusive" || key === "all-inclusive") return "All inclusive";
  if (key === "ro" || key === "room only") return "Room only";
  return raw;
}

function roomPrices(room: RateCompareRoom, nights: number | null) {
  const markup = room.markup_percent || room.markup_buttons?.[0] || 30;
  const teamTotal = Number.isFinite(room.team_cost) ? room.team_cost : 0;
  const nightCount = nights != null && nights > 0 ? nights : 1;
  const clientTotal =
    typeof room.client_total === "number" && Number.isFinite(room.client_total)
      ? room.client_total
      : clientPriceAtMarkup(teamTotal, markup);
  const clientPerNight =
    typeof room.client_per_night === "number" && Number.isFinite(room.client_per_night)
      ? room.client_per_night
      : roundMoney(clientTotal / nightCount);
  const teamPerNight =
    typeof room.team_per_night === "number" && Number.isFinite(room.team_per_night)
      ? room.team_per_night
      : roundMoney(teamTotal / nightCount);
  return { teamTotal, clientTotal, clientPerNight, teamPerNight };
}

/**
 * Single rates table under an agent reply (one or many hotels).
 * No Add buttons — advisor adds via chat. No card chrome.
 */
export function TripBuilderRateCompare({
  compare,
}: {
  compare: RateCompareCard;
  /** Ignored — kept so existing call sites keep typing. */
  disabled?: boolean;
  onAddOption?: (option: RateCompareAddOption) => void;
}) {
  const party = [
    `${compare.adults} adult${compare.adults === 1 ? "" : "s"}`,
    compare.children > 0
      ? `${compare.children} child${compare.children === 1 ? "" : "ren"}`
      : null,
    `${compare.rooms} room${compare.rooms === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const nights =
    compare.nights != null && compare.nights > 0
      ? `${compare.nights} night${compare.nights === 1 ? "" : "s"}`
      : null;
  const age = ratesAgeLabel(compare.searched_at);
  const hotels = compare.hotels ?? [];

  return (
    <div className="mt-3 space-y-4 text-sm text-ink">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs text-ink-muted">
        <span>
          {compare.destination}
          {nights ? ` · ${nights}` : ""} · {compare.check_in} → {compare.check_out} · {party}
        </span>
        {age ? <span className="text-ink-subtle">{age}</span> : null}
      </div>

      {compare.preference ? (
        <p className="text-xs text-ink-muted">Preference: {compare.preference}</p>
      ) : null}

      {compare.suggest_to_client ? (
        <p className="text-xs text-ink">
          <span className="font-medium">Suggest to client: </span>
          {compare.suggest_to_client}
        </p>
      ) : null}

      <div className="space-y-5">
        {hotels.map((hotel) => (
          <HotelRates key={hotel.hotel} hotel={hotel} nights={compare.nights ?? null} />
        ))}
      </div>
    </div>
  );
}

function HotelRates({
  hotel,
  nights,
}: {
  hotel: RateCompareHotel;
  nights: number | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h4 className="font-medium text-ink">
          {hotel.hotel}
          {hotel.recommended ? (
            <span className="ml-1.5 text-[11px] font-normal text-accent-ink">Best fit</span>
          ) : null}
        </h4>
        {hotel.status === "ok" && hotel.source ? (
          <span className="text-xs text-ink-subtle">{hotel.source}</span>
        ) : null}
      </div>

      {hotel.status !== "ok" ? (
        <div className="space-y-1 text-xs text-ink-muted">
          <p>{statusLabel(hotel.status)}</p>
          {hotel.note ? <p>{hotel.note}</p> : null}
          {(hotel.alternatives ?? []).length > 0 ? (
            <p className="text-ink-subtle">Try: {(hotel.alternatives ?? []).join(", ")}</p>
          ) : null}
        </div>
      ) : null}

      {(hotel.rooms ?? []).length > 0 ? (
        <>
          <div className="w-full max-w-full overflow-x-auto rounded-md ring-1 ring-border">
            <table className="w-full min-w-[26rem] table-fixed border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-divider bg-surface-subtle text-ink-subtle">
                  <th className="w-[32%] px-2.5 py-1.5 font-medium">Room</th>
                  <th className="w-[16%] px-2.5 py-1.5 font-medium">Meal plan</th>
                  <th className="w-[20%] px-2.5 py-1.5 font-medium tabular-nums">Per night</th>
                  <th className="w-[20%] px-2.5 py-1.5 font-medium tabular-nums">Stay total</th>
                  <th className="w-[12%] px-2.5 py-1.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {(hotel.rooms ?? []).map((room) => (
                  <RoomTableRow key={room.rate_ref} room={room} nights={nights} />
                ))}
              </tbody>
            </table>
          </div>
          <HotelNotes hotel={hotel} />
        </>
      ) : null}
    </div>
  );
}

function RoomTableRow({
  room,
  nights,
}: {
  room: RateCompareRoom;
  nights: number | null;
}) {
  const { teamTotal, clientTotal, clientPerNight, teamPerNight } = roomPrices(room, nights);

  return (
    <tr
      className={cn(
        "border-b border-divider/60 align-top",
        room.recommended ? "bg-accent-soft/40" : null,
      )}
    >
      <td className="break-words px-2.5 py-2 text-ink">
        {room.room_name || "—"}
        {room.recommended ? (
          <span className="ml-1 text-[10px] font-medium text-accent-ink">Pick</span>
        ) : null}
      </td>
      <td className="break-words px-2.5 py-2 text-ink-muted">{mealPlanLabel(room.board)}</td>
      <td className="px-2.5 py-2 tabular-nums text-ink">
        {formatRoomMoney(clientPerNight, room.currency)}
        <span className="mt-0.5 block text-[10px] text-ink-subtle">
          team {formatRoomMoney(teamPerNight, room.currency)}
        </span>
      </td>
      <td className="px-2.5 py-2 tabular-nums text-ink">
        {formatRoomMoney(clientTotal, room.currency)}
        <span className="mt-0.5 block text-[10px] text-ink-subtle">
          team {formatRoomMoney(teamTotal, room.currency)}
        </span>
      </td>
      <td className="break-words px-2.5 py-2 text-ink-muted">{room.source ?? "—"}</td>
    </tr>
  );
}

function HotelNotes({ hotel }: { hotel: RateCompareHotel }) {
  const notes = hotel.notes ?? { cancellation: null, markup: null, inclusions: [] };
  const cancellation = notes.cancellation ?? null;
  const markup = notes.markup ?? null;
  const inclusions = notes.inclusions ?? [];
  const suggest = hotel.suggest_to_client ?? null;
  if (!cancellation && !markup && inclusions.length === 0 && !suggest) return null;

  return (
    <dl className="space-y-1 text-xs text-ink-muted">
      {suggest ? (
        <div>
          <dt className="inline font-medium text-ink">Suggest to client: </dt>
          <dd className="inline">{suggest}</dd>
        </div>
      ) : null}
      {cancellation ? (
        <div>
          <dt className="inline font-medium text-ink">Cancellation: </dt>
          <dd className="inline">{cancellation}</dd>
        </div>
      ) : null}
      {markup ? (
        <div>
          <dt className="inline font-medium text-ink">Commission rate: </dt>
          <dd className="inline">{markup}</dd>
        </div>
      ) : null}
      {inclusions.length > 0 ? (
        <div>
          <dt className="inline font-medium text-ink">Included: </dt>
          <dd className="inline">{inclusions.join(", ")}</dd>
        </div>
      ) : null}
    </dl>
  );
}
