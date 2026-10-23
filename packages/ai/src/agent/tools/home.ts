import { z } from "zod";

import type { AgentChoice } from "../../tools";
import type { UpcomingTripMatch } from "../types";

import { defineHomeTool } from "./define-tool";
import { clientId, leadChoice, looseDate, stayInput, toStayRequest } from "./trip-inputs";

const tripCreateInput = z
  .object({
    client_id: clientId.optional().describe("Lead, or any member of the household. Omit when the advisor named no client."),
    lead: leadChoice,
    with_household: z
      .boolean()
      .default(true)
      .describe("false when the advisor says the lead travels alone or names a different party."),
    start: looseDate.optional().describe("First day of the trip."),
    end: looseDate.optional().describe("Last day of the trip (check-out morning)."),
    stays: z.array(stayInput).max(10).default([]).describe("Every stay, in order. One stay without dates covers the whole trip."),
    create_anyway: z
      .boolean()
      .default(false)
      .describe("true only when the advisor, after seeing the client's upcoming trips, asked for a new trip anyway."),
  })
  .strict();

type TripCreateInput = z.infer<typeof tripCreateInput>;

type ExistingTrips = { status: "existing"; upcoming_trips: UpcomingTripMatch[]; request: TripCreateInput };

function isExisting(result: unknown): result is ExistingTrips {
  return (result as { status?: string } | null)?.status === "existing";
}

/** "5 Nov" or "10 Nov 2026". */
function shortDate(iso: string, withYear: boolean): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** "Maldives · 5 Nov – 10 Nov 2026", or the trip's title when it has no stays. */
function tripLabel(trip: UpcomingTripMatch): string {
  const place = trip.destinations.join(", ") || trip.title || "Untitled trip";
  const dates =
    trip.starts_on && trip.ends_on ? ` · ${shortDate(trip.starts_on, false)} – ${shortDate(trip.ends_on, true)}` : "";
  return `${place}${dates}`;
}

/** Open one of the advisor's own upcoming trips, or create the new one anyway. */
function existingTripChoices(result: unknown): AgentChoice[] {
  if (!isExisting(result)) return [];
  return [
    ...result.upcoming_trips
      .filter((trip) => trip.owner_name === null)
      .slice(0, 3)
      .map((trip) => ({ label: `Open ${tripLabel(trip)}`, action: "trip_open", args: { trip_id: trip.trip_id } })),
    { label: "Create a new trip", action: "trip_create", args: { ...result.request, create_anyway: true } },
  ];
}

export const tripCreateTool = defineHomeTool({
  name: "trip_create",
  description: [
    "Create a trip from the home chat with everything the advisor said: the client and their household, the dates, every stay with its hotel and rooms. The trip then opens for the advisor.",
    "Use when the advisor asks for a trip, or taps \"Create trip\" for a client. Call it once with everything; don't ask for a yes first.",
    "Do not use when several different people match the name (list them and ask which one), or to change a trip that exists (open it with trip_open).",
    "Returns status created with a summary, or status existing when anyone travelling already has an upcoming trip: nothing was created, and buttons let the advisor open one or create the new trip anyway.",
  ].join(" "),
  schema: tripCreateInput,
  risk: "undo",
  progress: () => "Creating the trip…",
  run: async (input, handlers, call) => {
    const result = await handlers.createTrip(
      {
        clientId: input.client_id,
        lead: input.lead,
        withHousehold: input.with_household,
        start: input.start,
        end: input.end,
        stays: input.stays.map(toStayRequest),
        createAnyway: input.create_anyway,
      },
      call,
    );
    return result.status === "existing" ? { ...result, request: input } : result;
  },
  choices: existingTripChoices,
  opens: (result) => {
    const created = result as { status?: string; trip_id?: string };
    return created.status === "created" && created.trip_id ? { tripId: created.trip_id, created: true } : null;
  },
});

export const tripOpenTool = defineHomeTool({
  name: "trip_open",
  description: [
    "Open an existing trip for the advisor, to keep working on it.",
    "Use when the advisor asks to open or continue a trip from history_search_trips or from trip_create's upcoming trips, or taps Open on one.",
    "Do not use to create a trip (use trip_create), or for another advisor's trip (owner_name set): say whose it is instead.",
    "Returns the trip that opens. Then reply in one line; there is nothing more to look up.",
  ].join(" "),
  schema: z.object({ trip_id: z.string().uuid().describe("Trip id from history_search_trips or trip_create.") }).strict(),
  risk: "read",
  progress: () => "Opening the trip…",
  run: (input, handlers) => handlers.openTrip({ tripId: input.trip_id }),
  opens: (result) => {
    const opened = result as { trip_id?: string };
    return opened.trip_id ? { tripId: opened.trip_id, created: false } : null;
  },
});
