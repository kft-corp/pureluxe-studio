"use client";

import { useState } from "react";

import type { RateCompareCard, RateCompareHotel, RateCompareRoom } from "@pureluxe/ai/chat-stream";
import { rateMessages } from "@pureluxe/shared";

import { formatRoomMoney, roundMoney } from "@/lib/rates/price-math";
import { cn } from "@/lib/utils/cn";

/** First rooms shown per hotel; advisor expands for the rest. */
const INITIAL_ROOMS_VISIBLE = 5;

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
  if (
    key === "bb" ||
    key === "bed & breakfast" ||
    key === "bed and breakfast" ||
    key === "breakfast" ||
    key === "room with breakfast" ||
    key.includes("breakfast")
  ) {
    return "Room with breakfast";
  }
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

/** Cost-only figures for the rates table (markup / sell stay in chat). */
function roomCosts(room: RateCompareRoom, nights: number | null) {
  const teamTotal = Number.isFinite(room.team_cost) ? room.team_cost : 0;
  const nightCount = nights != null && nights > 0 ? nights : 1;
  const teamPerNight =
    typeof room.team_per_night === "number" && Number.isFinite(room.team_per_night)
      ? room.team_per_night
      : roundMoney(teamTotal / nightCount);
  /** DMC sheet package amount (before extra nights); fall back to stay total. */
  const packageTeam =
    typeof room.package_team === "number" && Number.isFinite(room.package_team)
      ? room.package_team
      : teamTotal;
  const extraTeam =
    typeof room.extra_night_team === "number" && Number.isFinite(room.extra_night_team)
      ? room.extra_night_team
      : null;
  return {
    teamTotal,
    teamPerNight,
    packageTeam,
    extraTeam,
  };
}

/** Cheapest stay cost for the hotel header / summary strip. */
function hotelFromCost(hotel: RateCompareHotel): {
  amount: number;
  currency: string;
} | null {
  if (hotel.status !== "ok" || hotel.rooms.length === 0) return null;
  let best: { amount: number; currency: string } | null = null;
  for (const room of hotel.rooms) {
    const { teamTotal } = roomCosts(room, null);
    if (!best || teamTotal < best.amount) {
      best = { amount: teamTotal, currency: room.currency };
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

/** Cost amount only — markup / sell are set later in chat. */
function CostCell({ amount, currency }: { amount: number; currency: string }) {
  return <span className="tabular-nums text-ink">{formatRoomMoney(amount, currency)}</span>;
}

function RoomNameCell({ room }: { room: RateCompareRoom }) {
  const subtitle = [room.detail?.trim(), room.package_label?.trim()]
    .filter(Boolean)
    .filter((part, index, all) => {
      const key = part!.toLowerCase();
      return all.findIndex((row) => row!.toLowerCase() === key) === index;
    })
    .join(" · ");
  return (
    <>
      <span className="block">{room.room_name || "—"}</span>
      {subtitle ? (
        <span className="mt-0.5 block text-[12px] text-ink-subtle">{subtitle}</span>
      ) : null}
    </>
  );
}

function segmentRoomLine(
  segment: NonNullable<RateCompareRoom["segments"]>[number],
): string {
  return [segment.label, segment.room_name, segment.detail]
    .filter(Boolean)
    .join(" · ");
}

/** Party · rooms · nights for this rates_search (does not claim every cell is that total). */
function searchContextLine(compare: RateCompareCard): string | null {
  const parts: string[] = [];
  if (compare.adults > 0) {
    parts.push(compare.adults === 1 ? "1 adult" : `${compare.adults} adults`);
  }
  if (compare.children > 0) {
    parts.push(compare.children === 1 ? "1 child" : `${compare.children} children`);
  }
  if (compare.rooms > 0) {
    parts.push(compare.rooms === 1 ? "1 room" : `${compare.rooms} rooms`);
  }
  if (compare.nights != null && compare.nights > 0) {
    parts.push(compare.nights === 1 ? "1 night" : `${compare.nights} nights`);
  }
  if (parts.length === 0) return null;
  return `Search: ${parts.join(" · ")}`;
}

function stayCostColumnLabel(searchRooms: number): string {
  return searchRooms > 1 ? `Stay cost (${searchRooms} rooms)` : "Stay cost";
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
}) {
  const hotels = compare.hotels ?? [];
  const contextLine = searchContextLine(compare);
  const fromLines = hotels
    .map((hotel) => {
      const from = hotelFromCost(hotel);
      if (!from) return null;
      return `${hotel.hotel} from ${formatRoomMoney(from.amount, from.currency)}`;
    })
    .filter(Boolean);

  return (
    <div className="mt-3 space-y-4 text-[13.5px] leading-snug text-ink">
      {contextLine ? (
        <p className="text-[13px] font-medium text-ink-muted">{contextLine}</p>
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
            searchRooms={compare.rooms}
          />
        ))}
      </div>
      {hotels.some((hotel) => hotel.status === "ok" && (hotel.rooms?.length ?? 0) > 0) ? (
        <p className="text-[12.5px] text-ink-subtle">
          {rateMessages.hint.askRoomOrFullInfo}
        </p>
      ) : null}
    </div>
  );
}

function HotelRates({
  hotel,
  nights,
  searchRooms,
}: {
  hotel: RateCompareHotel;
  nights: number | null;
  /** Rooms used in this rates_search (party search), not table row count. */
  searchRooms: number;
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
  const searchRoomsLabel = searchRooms > 1 ? `${searchRooms} rooms` : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h4 className="text-[15px] font-medium text-ink">{hotel.hotel}</h4>
        {hotel.status === "ok" && sharedSource ? (
          <span className="text-[12px] text-ink-subtle">{sharedSource}</span>
        ) : null}
        {hotel.status === "ok" && packageMode ? (
          <span className="text-[12px] text-ink-subtle">Package rates</span>
        ) : null}
        {hotel.status === "ok" && searchRoomsLabel ? (
          <span className="text-[12px] text-ink-subtle">{searchRoomsLabel}</span>
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
                showSource={!hideSourceColumn}
                searchRooms={searchRooms}
              />
            ))}
          </div>
          <div className="hidden w-full max-w-full overflow-x-auto rounded-lg ring-1 ring-border md:block">
            <table
              className={cn(
                "w-full table-fixed border-collapse text-left text-[13.5px]",
                packageMode ? "min-w-[34rem]" : "min-w-[26rem]",
              )}
            >
              <thead>
                <tr className="border-b border-divider bg-surface-subtle text-ink-muted">
                  <th
                    className={cn(
                      "px-3 py-2 text-[12px] font-semibold",
                      packageMode
                        ? hideSourceColumn
                          ? "w-[28%]"
                          : "w-[24%]"
                        : hideSourceColumn
                          ? "w-[36%]"
                          : "w-[32%]",
                    )}
                  >
                    Room
                  </th>
                  <th className="w-[14%] px-3 py-2 text-[12px] font-semibold">Meal plan</th>
                  {packageMode ? (
                    <>
                      <th className="w-[18%] px-3 py-2 text-[12px] font-semibold tabular-nums">
                        Package total (per room)
                      </th>
                      <th className="w-[16%] px-3 py-2 text-[12px] font-semibold tabular-nums">
                        Extra night (per room)
                      </th>
                      <th className="w-[18%] px-3 py-2 text-[12px] font-semibold tabular-nums">
                        {stayCostColumnLabel(searchRooms)}
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="w-[20%] px-3 py-2 text-[12px] font-semibold tabular-nums">
                        Cost / night
                      </th>
                      <th className="w-[20%] px-3 py-2 text-[12px] font-semibold tabular-nums">
                        Stay cost
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
                  <RoomTableRows
                    key={room.rate_ref}
                    room={room}
                    nights={nights}
                    packageMode={packageMode}
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
          <HotelNotes hotel={hotel} packageMode={packageMode} searchRooms={searchRooms} />
        </>
      ) : null}
    </div>
  );
}

/**
 * Single-room: one table row.
 * Dual-shop combo: two inner rows (Room 1 / Room 2) with stay total rowspan.
 */
function RoomTableRows({
  room,
  nights,
  packageMode,
  showSource,
}: {
  room: RateCompareRoom;
  nights: number | null;
  packageMode: boolean;
  showSource: boolean;
}) {
  const { teamTotal, teamPerNight, packageTeam, extraTeam } = roomCosts(room, nights);
  const showAsPackage = packageMode || isPackageRoom(room);
  const segments =
    room.segments && room.segments.length >= 2 ? room.segments : null;
  const cellTone = room.recommended ? "bg-accent-soft/40" : null;
  /** Contracted same-category stacks have no per-room money — rowspan sheet nightly. */
  const sharedNightly =
    segments != null &&
    segments.every((segment) => segment.team_per_night == null);

  if (!segments) {
    return (
      <tr className="border-b border-divider align-top">
        <td className={cn("break-words px-3 py-2 text-ink", cellTone)}>
          <RoomNameCell room={room} />
        </td>
        <td className={cn("break-words px-3 py-2 text-ink-muted", cellTone)}>
          {mealPlanLabel(room.board)}
        </td>
        {showAsPackage ? (
          <>
            <td className={cn("px-3 py-2", cellTone)}>
              <CostCell amount={packageTeam} currency={room.currency} />
            </td>
            <td className={cn("px-3 py-2", cellTone)}>
              {extraTeam != null ? (
                <CostCell amount={extraTeam} currency={room.currency} />
              ) : (
                <span className="text-ink-subtle">—</span>
              )}
            </td>
            <td className={cn("px-3 py-2 font-medium", cellTone)}>
              <CostCell amount={teamTotal} currency={room.currency} />
            </td>
          </>
        ) : (
          <>
            <td className={cn("px-3 py-2", cellTone)}>
              <CostCell amount={teamPerNight} currency={room.currency} />
            </td>
            <td className={cn("px-3 py-2 font-medium", cellTone)}>
              <CostCell amount={teamTotal} currency={room.currency} />
            </td>
          </>
        )}
        {showSource ? (
          <td className={cn("break-words px-3 py-2 text-ink-muted", cellTone)}>
            {room.source ?? "—"}
          </td>
        ) : null}
      </tr>
    );
  }

  const span = segments.length;
  return (
    <>
      {segments.map((segment, index) => {
        const isFirst = index === 0;
        const isLast = index === segments.length - 1;
        const padY = isFirst ? "pt-2.5 pb-1" : "pt-1 pb-2.5";
        // No line between Room 1/2; thick rule only after the whole combo.
        const edge = isLast ? "border-b-2 border-border" : "border-b-0";
        return (
          <tr key={`${room.rate_ref}-${segment.label}`} className="align-top">
            <td
              className={cn(
                "break-words px-3 text-ink",
                padY,
                edge,
                cellTone,
              )}
            >
              {isFirst ? (
                <span className="mb-1 block text-[13px] font-semibold text-ink">
                  {room.room_name || "—"}
                </span>
              ) : null}
              <span className="block text-[12.5px] text-ink-muted">
                {segmentRoomLine(segment)}
              </span>
            </td>
            <td
              className={cn(
                "break-words px-3 text-ink-muted",
                padY,
                edge,
                cellTone,
              )}
            >
              {mealPlanLabel(segment.board)}
            </td>
            {showAsPackage ? (
              <>
                {isFirst ? (
                  <>
                    <td
                      className={cn("px-3 py-2.5 border-b-2 border-border", cellTone)}
                      rowSpan={span}
                    >
                      <CostCell amount={packageTeam} currency={room.currency} />
                    </td>
                    <td
                      className={cn("px-3 py-2.5 border-b-2 border-border", cellTone)}
                      rowSpan={span}
                    >
                      {extraTeam != null ? (
                        <CostCell amount={extraTeam} currency={room.currency} />
                      ) : (
                        <span className="text-ink-subtle">—</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 font-medium border-b-2 border-border",
                        cellTone,
                      )}
                      rowSpan={span}
                    >
                      <CostCell amount={teamTotal} currency={room.currency} />
                    </td>
                  </>
                ) : null}
              </>
            ) : (
              <>
                {sharedNightly ? (
                  isFirst ? (
                    <td
                      className={cn(
                        "px-3 py-2.5 border-b-2 border-border",
                        cellTone,
                      )}
                      rowSpan={span}
                    >
                      <CostCell amount={teamPerNight} currency={room.currency} />
                    </td>
                  ) : null
                ) : (
                  <td className={cn("px-3", padY, edge, cellTone)}>
                    {segment.team_per_night != null ? (
                      <CostCell
                        amount={segment.team_per_night}
                        currency={room.currency}
                      />
                    ) : (
                      <span className="text-ink-subtle">—</span>
                    )}
                  </td>
                )}
                {isFirst ? (
                  <td
                    className={cn(
                      "px-3 py-2.5 font-medium border-b-2 border-border",
                      cellTone,
                    )}
                    rowSpan={span}
                  >
                    <CostCell amount={teamTotal} currency={room.currency} />
                  </td>
                ) : null}
              </>
            )}
            {showSource && isFirst ? (
              <td
                className={cn(
                  "break-words px-3 py-2.5 text-ink-muted border-b-2 border-border",
                  cellTone,
                )}
                rowSpan={span}
              >
                {room.source ?? "—"}
              </td>
            ) : null}
          </tr>
        );
      })}
    </>
  );
}

/** Phone / narrow chat: same facts as the table, stacked so nothing needs sideways scroll. */
function RoomMobileCard({
  room,
  nights,
  packageMode,
  showSource,
  searchRooms,
}: {
  room: RateCompareRoom;
  nights: number | null;
  packageMode: boolean;
  showSource: boolean;
  searchRooms: number;
}) {
  const { teamTotal, teamPerNight, packageTeam, extraTeam } = roomCosts(room, nights);
  const showAsPackage = packageMode || isPackageRoom(room);

  return (
    <article
      className={cn(
        "rounded-lg px-3 py-2.5 ring-1 ring-border",
        room.recommended ? "bg-accent-soft/40 ring-accent-line" : "bg-surface-raised",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <h5
          className={cn(
            "min-w-0 break-words text-ink",
            room.segments && room.segments.length >= 2
              ? "text-[14px] font-semibold"
              : "text-[14px] font-medium",
          )}
        >
          {room.room_name || "—"}
        </h5>
        {showSource ? (
          <span className="shrink-0 text-[12px] text-ink-subtle">{room.source ?? "—"}</span>
        ) : null}
      </div>
      {room.segments && room.segments.length >= 2 ? (
        <ul className="mt-1.5 space-y-1 border-l-2 border-divider/70 pl-2.5">
          {room.segments.map((segment) => (
            <li key={segment.label} className="text-[12.5px] text-ink-muted">
              <span>{segmentRoomLine(segment)}</span>
              <span className="text-ink-subtle">
                {" · "}
                {mealPlanLabel(segment.board)}
                {segment.team_per_night != null
                  ? ` · ${formatRoomMoney(segment.team_per_night, room.currency)}/night`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-0.5 text-[12.5px] text-ink-muted">
          {[
            mealPlanLabel(room.board),
            room.detail?.trim(),
            room.package_label?.trim(),
          ]
            .filter(Boolean)
            .filter((part, index, all) => {
              const key = part!.toLowerCase();
              return all.findIndex((row) => row!.toLowerCase() === key) === index;
            })
            .join(" · ")}
        </p>
      )}
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
        {showAsPackage ? (
          <>
            <div>
              <dt className="text-[11px] font-medium text-ink-muted">Package total (per room)</dt>
              <dd>
                <CostCell amount={packageTeam} currency={room.currency} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-ink-muted">Extra night (per room)</dt>
              <dd>
                {extraTeam != null ? (
                  <CostCell amount={extraTeam} currency={room.currency} />
                ) : (
                  <span className="text-ink-subtle">—</span>
                )}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[11px] font-medium text-ink-muted">
                {stayCostColumnLabel(searchRooms)}
              </dt>
              <dd>
                <CostCell amount={teamTotal} currency={room.currency} />
              </dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt className="text-[11px] font-medium text-ink-muted">Cost / night</dt>
              <dd>
                <CostCell amount={teamPerNight} currency={room.currency} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-ink-muted">Stay cost</dt>
              <dd>
                <CostCell amount={teamTotal} currency={room.currency} />
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
  searchRooms,
}: {
  hotel: RateCompareHotel;
  packageMode: boolean;
  searchRooms: number;
}) {
  const notes = hotel.notes ?? {
    cancellation: null,
    payment: null,
    markup: null,
    inclusions: [],
    highlights: [],
    rate_terms: [],
    in_stay: null,
    extras: null,
    pricing: null,
  };
  const cancellation = notes.cancellation ?? null;
  const payment = notes.payment ?? null;
  const inclusions = notes.inclusions ?? [];
  const highlights = notes.highlights ?? [];
  const rateTerms = notes.rate_terms ?? [];
  const inStay = notes.in_stay?.trim() || null;
  const extras = notes.extras?.trim() || null;
  const pricing = notes.pricing?.trim() || null;
  const extrasLookRequired =
    Boolean(extras) &&
    /\b(green tax|christmas|new year|festive|supplement|seaplane|transfer)\b/i.test(
      extras!,
    );
  if (
    !cancellation &&
    !payment &&
    inclusions.length === 0 &&
    highlights.length === 0 &&
    rateTerms.length === 0 &&
    !inStay &&
    !extras &&
    !pricing &&
    !packageMode
  ) {
    return null;
  }
  const stayLabel = stayCostColumnLabel(searchRooms);

  return (
    <dl className="space-y-1 text-[13.5px] text-ink-muted">
      {packageMode ? (
        <div>
          <dt className="inline font-medium text-ink">Pricing: </dt>
          <dd className="inline">
            Package total and extra night are per room (sheet amounts). {stayLabel} is the
            all-in cost for this search. Say a markup % or sell in chat to add a room to the
            quote.
          </dd>
        </div>
      ) : null}
      {!packageMode && pricing ? (
        <div>
          <dt className="inline font-medium text-ink">Pricing: </dt>
          <dd className="inline">{pricing}</dd>
        </div>
      ) : null}
      {highlights.length > 0 ? (
        <div>
          <dt className="inline font-medium text-ink">Hotel: </dt>
          <dd className="inline">{highlights.join(" · ")}</dd>
        </div>
      ) : null}
      {rateTerms.length > 0 ? (
        <div>
          <dt className="inline font-medium text-ink">Rate terms: </dt>
          <dd className="inline">{rateTerms.join(" · ")}</dd>
        </div>
      ) : null}
      {cancellation ? (
        <div>
          <dt className="inline font-medium text-ink">Cancellation: </dt>
          <dd className="inline">{cancellation}</dd>
        </div>
      ) : null}
      {payment ? (
        <div>
          <dt className="inline font-medium text-ink">Payment: </dt>
          <dd className="inline">{payment}</dd>
        </div>
      ) : null}
      {inclusions.length > 0 ? (
        <div>
          <dt className="inline font-medium text-ink">Included: </dt>
          <dd className="inline">{inclusions.join(", ")}</dd>
        </div>
      ) : null}
      {inStay ? (
        <div>
          <dt className="inline font-medium text-ink">In stay: </dt>
          <dd className="inline">{inStay}</dd>
        </div>
      ) : null}
      {extras ? (
        <div>
          <dt className="inline font-medium text-ink">
            {extrasLookRequired ? "Required extras: " : "Extras: "}
          </dt>
          <dd className="inline">{extras}</dd>
        </div>
      ) : null}
    </dl>
  );
}
