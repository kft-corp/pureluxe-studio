import { z } from "zod";

import type { TripFacts } from "../../types";

import { defineAgentTool } from "./define-tool";
import { clientId, leadChoice, looseDate, stayInput, toStayRequest } from "./trip-inputs";

function sameCity(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/** Stays whose booking a change would cancel: those with the client's room. */
function bookedStays(trip: TripFacts | null): string[] {
  return (trip?.stays ?? []).flatMap((stay) => (stay.rate_selected ? [stay.city] : []));
}

export const tripGetTool = defineAgentTool({
  name: "trip_get",
  description: [
    "Load the saved facts for the open trip: lead client and travellers, trip dates, stays, saved rooms and rates, the quote, price lines and before-booking checks.",
    "Use when the advisor asks what is missing before booking, or about passports, visas, travel documents or travel prep for this trip — then summarise the Before booking lines.",
    "Use only when you need a fresher copy than the trip facts in your instructions, which are reloaded after every change.",
    "Do not use for other trips (use history_search_trips).",
    "Returns the trip facts object.",
  ].join(" "),
  schema: z.object({}).strict(),
  risk: "read",
  progress: () => "Reviewing the trip…",
  run: (_input, handlers) => handlers.getTrip(),
});

export const tripSetClientTool = defineAgentTool({
  name: "trip_set_client",
  description: [
    "Set the trip's lead client. By default their household travels too and the party is set.",
    "Use when the advisor names or picks one client, when exactly one client matches, or when every match is one household (the same household_id). Also to change the lead.",
    "Do not use when several different people match: list them and ask which one (buttons appear for each).",
    "Returns a summary of the change; the advisor gets Undo.",
  ].join(" "),
  schema: z
    .object({
      client_id: clientId,
      lead: leadChoice,
      with_household: z
        .boolean()
        .default(true)
        .describe("false when the advisor says the lead travels alone or names a different party."),
    })
    .strict(),
  risk: "undo",
  progress: () => "Updating the client…",
  run: (input, handlers, call) =>
    handlers.setClient(
      { clientId: input.client_id, withHousehold: input.with_household, lead: input.lead },
      call,
    ),
});

export const tripSetTravellersTool = defineAgentTool({
  name: "trip_set_travellers",
  description: [
    "Add or remove travellers, or change someone between adult and child. The lead always stays.",
    "Use when the advisor adds or drops a person, or says someone is a child. Find a new person's id with client_search first.",
    "When ages are stated (e.g. kids are 16): pass age on add — age 12+ becomes adult for pricing; pass child_ages on rates_search the same turn.",
    "Do not use to change the lead (use trip_set_client).",
    "Returns a summary of the change; the advisor gets Undo.",
  ].join(" "),
  schema: z
    .object({
      add: z
        .array(
          z
            .object({
              client_id: clientId,
              child: z.boolean().default(false),
              age: z
                .number()
                .int()
                .min(0)
                .max(120)
                .optional()
                .describe("Stated age; 12+ is treated as adult for party role."),
            })
            .strict(),
        )
        .max(20)
        .default([])
        .describe("People to add, or to change between adult and child."),
      remove: z.array(clientId).max(20).default([]).describe("Travellers to take off the trip."),
    })
    .strict(),
  risk: "undo",
  progress: () => "Updating travellers…",
  run: async (input, handlers, call) => {
    if (input.add.length + input.remove.length === 0) return { error: "Add or remove at least one person." };
    return handlers.setTravellers(
      {
        add: input.add.map((person) => {
          const age = person.age;
          const asAdult = age != null ? age >= 12 : !person.child;
          return {
            clientId: person.client_id,
            partyRole: asAdult ? ("adult" as const) : ("child" as const),
            age,
          };
        }),
        remove: input.remove,
      },
      call,
    );
  },
});

export const tripSetDatesTool = defineAgentTool({
  name: "trip_set_dates",
  description: [
    "Set the whole trip's start and end dates from what the advisor said. Pass MM-DD when they gave no year: Studio picks the next occurrence and shows the year as assumed. The result has the exact dates.",
    "A single stay that covered the trip moves with the new dates. If other stays would fall outside, set the stays together with the dates using trip_set_stays.",
    "Do not use to move every date by the same number of days (use trip_shift_dates).",
    "Returns a summary of the change; the advisor gets Undo.",
  ].join(" "),
  schema: z
    .object({
      start: looseDate.describe("First day of the trip. MM-DD when the advisor gave no year."),
      end: looseDate.describe("Last day of the trip (check-out morning). MM-DD when the advisor gave no year."),
    })
    .strict(),
  risk: "undo",
  progress: () => "Updating travel dates…",
  run: (input, handlers, call) => handlers.setDates(input, call),
});

export const tripSetStaysTool = defineAgentTool({
  name: "trip_set_stays",
  description: [
    "Set every stay on the trip at once, in order, with an optional hotel and rooms for each. One stay without dates covers the whole trip.",
    "Use when the advisor names where they go, changes a stay's dates, city or hotel, or adds a stay. Pass the full list, existing stays included; stays left out are removed.",
    "Do not use for the first multi-city split proposal (Malé then Baa, etc.) — use trip_propose_split so Studio shows Accept. Use this after they tap Accept, or when they clearly say to apply the split, or when stays are already split and only need a hotel/date tweak.",
    "Pass hotel null to clear a hotel on a stay — quote rooms on that stay (and any rooms labelled with that hotel) are removed with it. Pass start and end too when the trip dates change at the same time; like all dates here, MM-DD when the advisor gave no year. Rooms default to one per two adults when a hotel is set.",
    "Do not use to remove a stay that has the client's room (use trip_remove_stay).",
    "Returns a summary of the change; the advisor gets Undo.",
  ].join(" "),
  schema: z
    .object({
      stays: z.array(stayInput).min(1).max(10),
      start: looseDate.optional().describe("New trip start, only when the trip dates change too."),
      end: looseDate.optional().describe("New trip end, only when the trip dates change too."),
    })
    .strict(),
  risk: "undo",
  progress: () => "Updating stays…",
  run: (input, handlers, call) =>
    handlers.setStays(
      { start: input.start, end: input.end, stays: input.stays.map(toStayRequest) },
      call,
    ),
});

export const tripRemoveStayTool = defineAgentTool({
  name: "trip_remove_stay",
  description: [
    "Remove one stay. If it has the client's room, its pending booking is cancelled, so the advisor confirms first and Undo is not offered.",
    "Use when the advisor drops a stay from the trip.",
    "Do not use to change a stay (use trip_set_stays).",
    "Returns a summary of the change.",
  ].join(" "),
  schema: z.object({ city: z.string().trim().min(1).max(200) }).strict(),
  risk: "undo",
  progress: () => "Removing the stay…",
  confirm: (input, trip) => {
    const city = bookedStays(trip).find((name) => sameCity(name, input.city));
    return city ? `Remove ${city}? It has the client's room, so its pending booking will be cancelled.` : null;
  },
  run: (input, handlers, call) => handlers.removeStay(input, call),
});

export const tripShiftDatesTool = defineAgentTool({
  name: "trip_shift_dates",
  description: [
    "Move the whole trip and every stay by the same number of days, for example when a flight moves. Hotels stay; selected rates clear and pending bookings are cancelled.",
    "Use when the advisor moves the whole trip earlier or later.",
    "Do not use to set new dates of a different length (use trip_set_dates).",
    "Runs at once with Undo; the advisor confirms first only when a stay has the client's room. Returns a summary of the change.",
  ].join(" "),
  schema: z
    .object({
      days: z.number().int().min(-90).max(90).refine((days) => days !== 0, "Move by at least one day."),
    })
    .strict(),
  risk: "undo",
  progress: () => "Adjusting travel dates…",
  confirm: (input, trip) => {
    const booked = bookedStays(trip);
    if (booked.length === 0) return null;
    const count = Math.abs(input.days);
    return `Move the whole trip ${count} day${count === 1 ? "" : "s"} ${input.days > 0 ? "later" : "earlier"}? The client's room in ${booked.join(", ")} is cleared and its pending booking cancelled.`;
  },
  run: (input, handlers, call) => handlers.shiftDates(input, call),
});

export const tripUndoTool = defineAgentTool({
  name: "trip_undo",
  description: [
    "Undo the latest change made to this trip (once, within 24 hours).",
    "Use when the advisor taps Undo or asks to undo or revert the last change.",
    "Do not use to make a different change (use the matching trip_ tool).",
    "Returns what was undone.",
  ].join(" "),
  schema: z.object({}).strict(),
  risk: "undo",
  progress: () => "Reverting the last change…",
  quickReply: true,
  repeatable: true,
  run: (_input, handlers, call) => handlers.undo(call),
});

function splitResultCard(result: unknown): import("../../tools").LegSplitCard | null {
  if (!result || typeof result !== "object") return null;
  const row = result as { split?: import("../../tools").LegSplitCard };
  return row.split?.stays?.length ? row.split : null;
}

export const tripProposeSplitTool = defineAgentTool({
  name: "trip_propose_split",
  description: [
    "Propose a multi-city date split once as a card the advisor can accept. Does not change the trip until they tap Accept (which runs trip_set_stays).",
    "Use when the advisor names two or more places for one trip (e.g. Malé then Baa Atoll, with or without per-city dates) and the stays are not already split that way — even if they spelled out the dates in the same message.",
    "Do not call trip_set_stays for that first split; the Accept card applies it. Ask only once — do not re-propose the same split once stays match.",
    "Do not use for a single destination (trip_set_stays covers the whole trip).",
    "Returns the proposed stays; Studio shows the split card with Accept.",
  ].join(" "),
  schema: z
    .object({
      stays: z.array(stayInput).min(2).max(10),
      start: looseDate.optional(),
      end: looseDate.optional(),
    })
    .strict(),
  risk: "read",
  progress: () => "Proposing the stay split…",
  legSplit: splitResultCard,
  choices: (result) => {
    const split = splitResultCard(result);
    if (!split) return [];
    return [
      {
        label: `Accept · ${split.summary.replace(/\?$/, "")}`,
        action: "trip_set_stays",
        args: {
          stays: split.stays.map((stay) => ({
            city: stay.city,
            check_in: stay.check_in,
            check_out: stay.check_out,
            ...(stay.hotel !== undefined ? { hotel: stay.hotel } : {}),
            ...(stay.rooms != null ? { rooms: stay.rooms } : {}),
          })),
        },
      },
    ];
  },
  run: (input, handlers) =>
    handlers.proposeSplit({
      start: input.start,
      end: input.end,
      stays: input.stays.map(toStayRequest),
    }),
});
