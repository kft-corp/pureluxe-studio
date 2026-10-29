/** A room the advisor can ask a price question about. */
export type PricedRoom = {
  title: string;
  teamCost: number;
  clientPrice: number | null;
  currency: string | null;
};

export type TripSell = {
  amount: number | null;
  currency: string | null;
  /** Hotel net plus tax, same currency as amount. */
  teamCost?: number | null;
};

/** "Minimum markup 25%." → 25. Null when no percent is written. */
export function markupPercentFromNotes(markup: string | null | undefined): number | null {
  const match = markup?.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Advisor-facing money with a currency symbol when the code is known (e.g. $5,580.00). */
export function formatRoomMoney(amount: number, currency: string | null): string {
  const value = roundMoney(amount);
  const code = currency?.trim().toUpperCase() || "";
  const moneyDigits = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  } as const;
  if (!code) {
    return new Intl.NumberFormat("en-US", moneyDigits).format(value);
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      ...moneyDigits,
    }).format(value);
  } catch {
    const formatted = new Intl.NumberFormat("en-US", moneyDigits).format(value);
    return `${code} ${formatted}`;
  }
}

/** Team cost plus the markup percent already on file. */
export function clientPriceAtMarkup(teamCost: number, percent: number): number {
  return roundMoney(teamCost * (1 + percent / 100));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function percentIn(message: string): number | null {
  const match = message.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)\b/i);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function directionOf(message: string): "up" | "down" | "of" {
  if (/\b(\d+(?:\.\d+)?)\s*(?:%|percent)\s+of\b/i.test(message)) return "of";
  if (/\b(?:decrease|reduce|lower|discount|less|off|minus|below)\b/i.test(message)) return "down";
  return "up";
}

function applyPercent(amount: number, percent: number, direction: "up" | "down" | "of"): number {
  const share = amount * (percent / 100);
  if (direction === "of") return roundMoney(share);
  if (direction === "down") return roundMoney(amount - share);
  return roundMoney(amount + share);
}

function matchRoom(message: string, rooms: PricedRoom[]): PricedRoom | "ambiguous" | null {
  const numbered = message.match(/\b(?:room|option|rate|number|#)\s*(\d{1,2})\b/i);
  if (numbered?.[1]) {
    const index = Number(numbered[1]) - 1;
    return rooms[index] ?? null;
  }
  const text = normalize(message);
  const hits = rooms.filter((room) => {
    const title = normalize(room.title);
    if (title.length > 2 && text.includes(title)) return true;
    const words = title.split(" ").filter((word) => word.length > 2);
    const head = words.slice(0, 2).join(" ");
    const tail = words.slice(-2).join(" ");
    return (head.length > 2 && text.includes(head)) || (tail.length > 2 && text.includes(tail));
  });
  if (hits.length === 1) return hits[0]!;
  if (hits.length > 1) {
    const exact = hits.filter((room) => text.includes(normalize(room.title)));
    return exact.length === 1 ? exact[0]! : "ambiguous";
  }
  return null;
}

function wantsAll(message: string): boolean {
  return /\b(?:all|each|every)\b/i.test(message);
}

function wantsTrip(message: string): boolean {
  return /\b(?:whole\s+trip|trip\s+(?:price|total|sell)|sell\s+total|package\s+price|quote\s+total)\b/i.test(
    message,
  );
}

function isMathAsk(message: string): boolean {
  if (percentIn(message) != null) return true;
  return /\b(?:markup|margin|increase|decrease|discount|difference between|what should we|how much should we)\b/i.test(
    message,
  ) || /\b(?:total|sum)\b[\s\S]{0,40}\b(?:rooms?|villas?|options?|rates?)\b/i.test(message);
}

function roomLine(room: PricedRoom, percent: number, direction: "up" | "down" | "of"): string {
  const base = room.teamCost;
  const next = applyPercent(base, percent, direction);
  const team = formatRoomMoney(base, room.currency);
  const result = formatRoomMoney(next, room.currency);
  if (direction === "of") {
    return `**${room.title}** — ${percent}% of the cost ${team} is **${result}**.`;
  }
  const change = formatRoomMoney(Math.abs(roundMoney(next - base)), room.currency);
  const way = direction === "down" ? "less" : "more";
  return `**${room.title}** — cost ${team}. ${percent}% ${way} is ${change}. That figure is **${result}**.`;
}

/**
 * A calculated answer for a percent, markup, difference, or total question.
 * Null when the message is not a price calculation.
 */
export function answerPriceQuestion(
  message: string,
  rooms: PricedRoom[],
  markupPercent: number | null,
  trip: TripSell | null,
  focusRoom: string | null,
): string | null {
  if (!isMathAsk(message)) return null;
  const percent = percentIn(message);
  const direction = directionOf(message);
  const named = matchRoom(message, rooms);
  const focus = focusRoom ? rooms.find((room) => normalize(room.title) === normalize(focusRoom)) : null;
  const room = named && named !== "ambiguous" ? named : focus;

  if (/\bdifference between\b/i.test(message) && rooms.length >= 2) {
    const parts = message.split(/\bdifference between\b/i)[1]?.split(/\band\b/i) ?? [];
    const left = parts[0] ? matchRoom(parts[0], rooms) : null;
    const right = parts[1] ? matchRoom(parts[1], rooms) : null;
    if (left && left !== "ambiguous" && right && right !== "ambiguous") {
      if ((left.currency ?? "") !== (right.currency ?? "")) {
        return `**${left.title}** is ${formatRoomMoney(left.teamCost, left.currency)}. **${right.title}** is ${formatRoomMoney(right.teamCost, right.currency)}. Those are different currencies, so they are not subtracted.`;
      }
      const gap = roundMoney(Math.abs(left.teamCost - right.teamCost));
      return `**${left.title}** cost ${formatRoomMoney(left.teamCost, left.currency)}. **${right.title}** cost ${formatRoomMoney(right.teamCost, right.currency)}. The difference is **${formatRoomMoney(gap, left.currency)}**.`;
    }
  }

  if (
    percent == null &&
    /\b(?:total|sum)\b/i.test(message) &&
    rooms.length > 0
  ) {
    const currency = rooms[0]?.currency ?? null;
    if (rooms.some((item) => (item.currency ?? "") !== (currency ?? ""))) {
      return "Those rooms are not all in the same currency, so they are not added together.";
    }
    const total = roundMoney(rooms.reduce((sum, item) => sum + item.teamCost, 0));
    return `The cost total of these rooms is **${formatRoomMoney(total, currency)}**. That is not a saved sell.`;
  }

  if (percent == null && /\b(?:what should we|how much should we)\b/i.test(message)) {
    const targets = room ? [room] : rooms;
    if (targets.length === 0) return "Search rates first, then ask for a markup or sell.";
    const lines = targets.map(
      (item) =>
        `**${item.title}** — cost ${formatRoomMoney(item.teamCost, item.currency)}`,
    );
    return [
      "Give a markup % or sell — there is no hotel minimum markup to follow.",
      lines.join("\n"),
    ].join("\n\n");
  }

  if (percent == null) return null;

  if (wantsTrip(message) && !room) {
    if (trip?.amount == null) {
      return "The trip sell is not set yet. Set it with **sell 4500 USD**, or ask about a room on the list.";
    }
    const next = applyPercent(trip.amount, percent, direction);
    const current = formatRoomMoney(trip.amount, trip.currency);
    const result = formatRoomMoney(next, trip.currency);
    if (direction === "of") {
      return `${percent}% of the trip sell ${current} is **${result}**.`;
    }
    const way = direction === "down" ? "less" : "more";
    const margin =
      trip.teamCost != null && next > 0
        ? ` Margin at that price: ${formatRoomMoney(next - trip.teamCost, trip.currency)} (${(((next - trip.teamCost) / next) * 100).toFixed(1)}%).`
        : "";
    return `Trip sell ${current}. ${percent}% ${way} is **${result}**.${margin} That figure is not saved.`;
  }

  if (named === "ambiguous") {
    return "More than one room matches that. Name the full room, or say room 1.";
  }
  const useClient = /\b(?:client price|sell)\b/i.test(message);
  const targets = wantsAll(message) || (!room && rooms.length > 1) ? rooms : room ? [room] : rooms;
  if (targets.length === 0) {
    return "Search rates first, then ask for the percent on a room.";
  }
  if (useClient) {
    const missing = targets.filter((item) => item.clientPrice == null);
    if (missing.length === targets.length) {
      return "No sell is saved on that room yet. The figure below would need a saved sell. Ask from the cost, or send the sell first.";
    }
    const lines = targets
      .filter((item) => item.clientPrice != null)
      .map((item) => {
        const base = item.clientPrice ?? 0;
        const next = applyPercent(base, percent, direction);
        const current = formatRoomMoney(base, item.currency);
        const result = formatRoomMoney(next, item.currency);
        if (direction === "of") {
          return `**${item.title}** — ${percent}% of the sell ${current} is **${result}**.`;
        }
        const way = direction === "down" ? "less" : "more";
        return `**${item.title}** — sell ${current}. ${percent}% ${way} is **${result}**.`;
      });
    return [...lines, "That figure is not saved."].join("\n");
  }
  const lines = targets.map((item) => roomLine(item, percent, direction));
  return [lines.join("\n"), "This is from the cost. It is not saved."].join("\n\n");
}
