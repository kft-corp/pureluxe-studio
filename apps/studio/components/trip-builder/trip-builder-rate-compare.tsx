"use client";

import { useState } from "react";

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

/** First rooms shown per hotel; advisor expands for the rest. */
const INITIAL_ROOMS_VISIBLE = 3;

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
      return "Not available";
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

/** Hotel table uses package columns when most rooms are packages (COMO / JOALI style). */
function hotelUsesPackageColumns(rooms: RateCompareRoom[]): boolean {
  if (rooms.length === 0) return false;
  const packageCount = rooms.filter((room) => room.rate_basis === "package").length;
  return packageCount >= Math.ceil(rooms.length / 2);
}

function isPackageRoom(room: RateCompareRoom): boolean {
  return room.rate_basis === "package";
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

/** Cheapest client stay total for the hotel header / summary strip. */
function hotelFromClient(hotel: RateCompareHotel): {
  amount: number;
  currency: string;
} | null {
  if (hotel.status !== "ok" || hotel.rooms.length === 0) return null;
  let best: { amount: number; currency: string } | null = null;
  for (const room of hotel.rooms) {
    const { clientTotal } = roomPrices(room, null);
    if (!best || clientTotal < best.amount) {
      best = { amount: clientTotal, currency: room.currency };
    }
  }
  return best;
}

/** Hide Source column when every visible room shares the same source (usual for contracted). */
function roomsShareOneSource(rooms: RateCompareRoom[]): boolean {
  if (rooms.length === 0) return true;
  const first = rooms[0]?.source?.trim() ?? "";
  return rooms.every((room) => (room.source?.trim() ?? "") === first);
}

function MoneyCell({
  client,
  team,
  currency,
  showTeam,
}: {
  client: number;
  team: number;
  currency: string;
  showTeam: boolean;
}) {
  return (
    <>
      {formatRoomMoney(client, currency)}
      {showTeam ? (
        <span className="mt-0.5 block text-[12px] text-ink-subtle">
          team {formatRoomMoney(team, currency)}
        </span>
      ) : null}
    </>
  );
}

function RoomNameCell({ room }: { room: RateCompareRoom }) {
  return (
    <>
      {room.room_name || "—"}
      {room.recommended ? (
        <span className="ml-1 text-[12px] font-medium text-accent-ink">Pick</span>
      ) : null}
      {room.package_label ? (
        <span className="mt-0.5 block text-[12px] text-ink-subtle">{room.package_label}</span>
      ) : null}
    </>
  );
}

/**
 * Single rates table under an agent reply (one or many hotels).
 * Nightly hotels: Per night + Stay total.
 * Package hotels: Package total + Extra night (industry / DMC style).
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
  const [showTeam, setShowTeam] = useState(true);
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
  const fromLines = hotels
    .map((hotel) => {
      const from = hotelFromClient(hotel);
      if (!from) return null;
      return `${hotel.hotel} from ${formatRoomMoney(from.amount, from.currency)}`;
    })
    .filter(Boolean);

  return (
    <div className="mt-3 space-y-4 text-[13.5px] leading-snug text-ink">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-[13.5px] text-ink-muted">
        <span className="min-w-0 break-words">
          {compare.destination}
          {nights ? ` · ${nights}` : ""} · {compare.check_in} → {compare.check_out} · {party}
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
          {age ? <span className="text-ink-subtle">{age}</span> : null}
          <button
            type="button"
            className="text-[12.5px] text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            onClick={() => setShowTeam((prev) => !prev)}
            aria-pressed={showTeam}
          >
            {showTeam ? "Hide team cost" : "Show team cost"}
          </button>
        </span>
      </div>

      {compare.preference ? (
        <p className="text-[13.5px] text-ink-muted">Preference: {compare.preference}</p>
      ) : null}

      {fromLines.length > 1 ? (
        <p className="text-[13.5px] text-ink">{fromLines.join(" · ")}</p>
      ) : null}

      <div className="space-y-5">
        {hotels.map((hotel) => (
          <HotelRates
            key={hotel.hotel}
            hotel={hotel}
            nights={compare.nights ?? null}
            showTeam={showTeam}
          />
        ))}
      </div>
    </div>
  );
}

function HotelRates({
  hotel,
  nights,
  showTeam,
}: {
  hotel: RateCompareHotel;
  nights: number | null;
  showTeam: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const rooms = hotel.rooms ?? [];
  const packageMode = hotelUsesPackageColumns(rooms);
  const hideSourceColumn = roomsShareOneSource(rooms);
  const sharedSource = hideSourceColumn ? (rooms[0]?.source?.trim() || hotel.source) : null;
  const visibleRooms =
    expanded || rooms.length <= INITIAL_ROOMS_VISIBLE
      ? rooms
      : rooms.slice(0, INITIAL_ROOMS_VISIBLE);
  const hiddenCount = rooms.length - visibleRooms.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h4 className="text-[15px] font-medium text-ink">
          {hotel.hotel}
          {hotel.recommended ? (
            <span className="ml-1.5 text-[12px] font-normal text-accent-ink">Best fit</span>
          ) : null}
        </h4>
        {hotel.status === "ok" && sharedSource ? (
          <span className="text-[12px] text-ink-subtle">{sharedSource}</span>
        ) : null}
        {hotel.status === "ok" && packageMode ? (
          <span className="text-[12px] text-ink-subtle">Package rates</span>
        ) : null}
      </div>

      {hotel.status !== "ok" ? (
        <div className="space-y-1 text-[13.5px] text-ink-muted">
          <p>{statusLabel(hotel.status)}</p>
          {hotel.note ? <p>{hotel.note}</p> : null}
          {(hotel.alternatives ?? []).length > 0 ? (
            <p className="text-ink-subtle">Try: {(hotel.alternatives ?? []).join(", ")}</p>
          ) : null}
        </div>
      ) : null}

      {rooms.length > 0 ? (
        <>
          <div className="space-y-2 md:hidden">
            {visibleRooms.map((room) => (
              <RoomMobileCard
                key={room.rate_ref}
                room={room}
                nights={nights}
                packageMode={packageMode}
                showTeam={showTeam}
                showSource={!hideSourceColumn}
              />
            ))}
          </div>
          <div className="hidden w-full max-w-full overflow-x-auto rounded-lg ring-1 ring-border md:block">
            <table className="w-full min-w-[26rem] table-fixed border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-divider bg-surface-subtle text-ink-muted">
                  <th
                    className={cn(
                      "px-3 py-2 text-[12px] font-semibold",
                      hideSourceColumn ? "w-[36%]" : "w-[32%]",
                    )}
                  >
                    Room
                  </th>
                  <th className="w-[16%] px-3 py-2 text-[12px] font-semibold">Meal plan</th>
                  {packageMode ? (
                    <>
                      <th className="w-[20%] px-3 py-2 text-[12px] font-semibold tabular-nums">
                        Package total
                      </th>
                      <th className="w-[20%] px-3 py-2 text-[12px] font-semibold tabular-nums">
                        Extra night
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="w-[20%] px-3 py-2 text-[12px] font-semibold tabular-nums">
                        Per night
                      </th>
                      <th className="w-[20%] px-3 py-2 text-[12px] font-semibold tabular-nums">
                        Stay total
                      </th>
                    </>
                  )}
                  {!hideSourceColumn ? (
                    <th className="w-[12%] px-3 py-2 text-[12px] font-semibold">Source</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {visibleRooms.map((room) => (
                  <RoomTableRow
                    key={room.rate_ref}
                    room={room}
                    nights={nights}
                    packageMode={packageMode}
                    showTeam={showTeam}
                    showSource={!hideSourceColumn}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {hiddenCount > 0 ? (
            <button
              type="button"
              className="text-[12.5px] text-ink-muted underline-offset-2 hover:text-ink hover:underline"
              onClick={() => setExpanded(true)}
            >
              Show all rooms ({rooms.length})
            </button>
          ) : null}
          {expanded && rooms.length > INITIAL_ROOMS_VISIBLE ? (
            <button
              type="button"
              className="text-[12.5px] text-ink-muted underline-offset-2 hover:text-ink hover:underline"
              onClick={() => setExpanded(false)}
            >
              Show fewer rooms
            </button>
          ) : null}
          <HotelNotes hotel={hotel} packageMode={packageMode} />
        </>
      ) : null}
    </div>
  );
}

function RoomTableRow({
  room,
  nights,
  packageMode,
  showTeam,
  showSource,
}: {
  room: RateCompareRoom;
  nights: number | null;
  packageMode: boolean;
  showTeam: boolean;
  showSource: boolean;
}) {
  const { teamTotal, clientTotal, clientPerNight, teamPerNight } = roomPrices(room, nights);
  const showAsPackage = packageMode || isPackageRoom(room);
  const extraClient = room.extra_night_client;
  const extraTeam = room.extra_night_team;

  return (
    <tr
      className={cn(
        "border-b border-divider/60 align-top",
        room.recommended ? "bg-accent-soft/40" : null,
      )}
    >
      <td className="break-words px-3 py-2 text-ink">
        <RoomNameCell room={room} />
      </td>
      <td className="break-words px-3 py-2 text-ink-muted">{mealPlanLabel(room.board)}</td>
      {showAsPackage ? (
        <>
          <td className="px-3 py-2 tabular-nums text-ink">
            <MoneyCell
              client={clientTotal}
              team={teamTotal}
              currency={room.currency}
              showTeam={showTeam}
            />
          </td>
          <td className="px-3 py-2 tabular-nums text-ink">
            {extraClient != null && extraTeam != null ? (
              <MoneyCell
                client={extraClient}
                team={extraTeam}
                currency={room.currency}
                showTeam={showTeam}
              />
            ) : (
              <span className="text-ink-subtle">—</span>
            )}
          </td>
        </>
      ) : (
        <>
          <td className="px-3 py-2 tabular-nums text-ink">
            <MoneyCell
              client={clientPerNight}
              team={teamPerNight}
              currency={room.currency}
              showTeam={showTeam}
            />
          </td>
          <td className="px-3 py-2 tabular-nums text-ink">
            <MoneyCell
              client={clientTotal}
              team={teamTotal}
              currency={room.currency}
              showTeam={showTeam}
            />
          </td>
        </>
      )}
      {showSource ? (
        <td className="break-words px-3 py-2 text-ink-muted">{room.source ?? "—"}</td>
      ) : null}
    </tr>
  );
}

/** Phone / narrow chat: same facts as the table, stacked so nothing needs sideways scroll. */
function RoomMobileCard({
  room,
  nights,
  packageMode,
  showTeam,
  showSource,
}: {
  room: RateCompareRoom;
  nights: number | null;
  packageMode: boolean;
  showTeam: boolean;
  showSource: boolean;
}) {
  const { teamTotal, clientTotal, clientPerNight, teamPerNight } = roomPrices(room, nights);
  const showAsPackage = packageMode || isPackageRoom(room);
  const extraClient = room.extra_night_client;
  const extraTeam = room.extra_night_team;

  return (
    <article
      className={cn(
        "rounded-lg px-3 py-2.5 ring-1 ring-border",
        room.recommended ? "bg-accent-soft/40 ring-accent-line" : "bg-surface-raised",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <h5 className="min-w-0 text-[14px] font-medium break-words text-ink">
          {room.room_name || "—"}
          {room.recommended ? (
            <span className="ml-1.5 text-[12px] font-medium text-accent-ink">Pick</span>
          ) : null}
        </h5>
        {showSource ? (
          <span className="shrink-0 text-[12px] text-ink-subtle">{room.source ?? "—"}</span>
        ) : null}
      </div>
      <p className="mt-0.5 text-[12.5px] text-ink-muted">
        {mealPlanLabel(room.board)}
        {room.package_label ? ` · ${room.package_label}` : ""}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
        {showAsPackage ? (
          <>
            <div>
              <dt className="text-[11px] font-medium text-ink-muted">Package total</dt>
              <dd className="tabular-nums text-ink">
                <MoneyCell
                  client={clientTotal}
                  team={teamTotal}
                  currency={room.currency}
                  showTeam={showTeam}
                />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-ink-muted">Extra night</dt>
              <dd className="tabular-nums text-ink">
                {extraClient != null && extraTeam != null ? (
                  <MoneyCell
                    client={extraClient}
                    team={extraTeam}
                    currency={room.currency}
                    showTeam={showTeam}
                  />
                ) : (
                  <span className="text-ink-subtle">—</span>
                )}
              </dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt className="text-[11px] font-medium text-ink-muted">Per night</dt>
              <dd className="tabular-nums text-ink">
                <MoneyCell
                  client={clientPerNight}
                  team={teamPerNight}
                  currency={room.currency}
                  showTeam={showTeam}
                />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-ink-muted">Stay total</dt>
              <dd className="tabular-nums text-ink">
                <MoneyCell
                  client={clientTotal}
                  team={teamTotal}
                  currency={room.currency}
                  showTeam={showTeam}
                />
              </dd>
            </div>
          </>
        )}
      </dl>
    </article>
  );
}

function HotelNotes({
  hotel,
  packageMode,
}: {
  hotel: RateCompareHotel;
  packageMode: boolean;
}) {
  const notes = hotel.notes ?? { cancellation: null, markup: null, inclusions: [] };
  const cancellation = notes.cancellation ?? null;
  const markup = notes.markup ?? null;
  const inclusions = notes.inclusions ?? [];
  if (!cancellation && !markup && inclusions.length === 0 && !packageMode) {
    return null;
  }

  return (
    <dl className="space-y-1 text-[13.5px] text-ink-muted">
      {packageMode ? (
        <div>
          <dt className="inline font-medium text-ink">Pricing: </dt>
          <dd className="inline">
            Package total is for this stay. Extra night applies when the stay is longer than the
            package.
          </dd>
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
