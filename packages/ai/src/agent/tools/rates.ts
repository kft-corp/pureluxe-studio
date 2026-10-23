import { z } from "zod";

import { defineAgentTool } from "./define-tool";

export const ratesGetSnapshotTool = defineAgentTool({
  name: "rates_get_snapshot",
  description: [
    "Read the last rate search on this trip: the rooms found with team cost, inclusions, cancellation and payment, plus the hotel rules for those dates.",
    "Use for follow-up questions about rooms, prices, what is included, cancellation, offers or which room suits the client.",
    "Do not use for rooms already saved on the trip (they are in the trip facts) or for hotels never searched (use hotel_get).",
    "Returns status none when there is no recent search: tell the advisor to search rates first. Team cost is the advisor's cost, never the client price. Call these the current rates when you speak to the advisor.",
  ].join(" "),
  schema: z.object({}).strict(),
  risk: "read",
  progress: () => "Reviewing current rates…",
  run: (_input, handlers) => handlers.getRateSnapshot(),
});
