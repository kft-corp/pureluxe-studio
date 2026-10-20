import { z } from "zod";

import { defineAgentTool } from "./define-tool";

export const tripGetTool = defineAgentTool({
  name: "trip_get",
  description: [
    "Load the saved facts for the open trip: lead client and travellers, trip dates, stays, saved rooms and rates, the quote, price lines and before-booking checks.",
    "Use only when you need a fresher copy than the trip facts in your instructions, which are loaded at the start of every message.",
    "Do not use for other trips (use history_search_trips).",
    "Returns the trip facts object.",
  ].join(" "),
  schema: z.object({}).strict(),
  risk: "read",
  progress: () => "Loading the trip…",
  run: (_input, handlers) => handlers.getTrip(),
});
