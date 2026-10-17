/** Shape the stay parser reads. Show this whenever asking for a stay. */
export const STAY_EXAMPLE = `Hotel: Soneva Fushi
City: Maldives
Check-in: 2026-10-10
Check-out: 2026-10-15
Adults: 2
Children: 0
Rooms: 1`;

export function stayAskText(lead: string): string {
  return `${lead}

Next, lock the stay: hotel, city, dates, and who is travelling. I use that to search rates and write the quote.

Paste this and swap in the real stay:

${STAY_EXAMPLE}

One line at a time is fine. I'll confirm what I heard and ask for anything still missing. When hotel, city, dates, adults, children, and rooms are in, tap **Save stay**.`;
}
