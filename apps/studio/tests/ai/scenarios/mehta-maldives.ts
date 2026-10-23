import { MEHTA_CLIENT_IDS } from "../fixtures/mehta-maldives";
import type { AgentScenario, ScenarioStep } from "../scenario-types";

const AARAV = MEHTA_CLIENT_IDS.aarav;
const KANUHURA = "Six Senses Kanuhura";
const KIHAVAH = "Anantara Kihavah";
const SONEVA = "Soneva Fushi";
const CORAL_BAY = "Coral Bay Resort";

/** Old-flow phrases and internal words that must never reach the advisor. */
export const EVERY_REPLY_MUST_NOT = [
  "Say yes",
  "say **yes**",
  "tap Save",
  "Start: 20",
  "Check-in: 20",
  "2026-10-10",
  "database",
  "Atlas",
  "trip pack",
  // Replies stay neutral: no company name, and nothing about where answers are stored.
  "PureLuxe",
  "on file",
  "no notes",
  "in our records",
];

// ---------------------------------------------------------------------------
// Shared opening: client, overall dates, internal dates (flow stages 1–3)
// ---------------------------------------------------------------------------

export const askForTrip: ScenarioStep = {
  id: "trip-request",
  flowStages: [1, 2],
  buildStage: "stage-1",
  title: "One line names the client, destination and dates",
  advisor: {
    kind: "say",
    text: "Trip for Mehta, Maldives 10–15 Dec",
    variants: [
      "New trip for the Mehtas to the Maldives, 10 to 15 December",
      "Mehta family, Maldives, Dec 10-15",
      "Can you set up a Maldives trip for Mehta from 10th to 15th Dec?",
      "mehta maldives 10-15 dec",
    ],
  },
  expect: {
    tools: {
      called: ["client_search"],
      notCalled: ["quote_add_options", "quote_send", "trip_set_client"],
    },
    cards: ["client_picker"],
    reply: {
      mentions: ["Mehta"],
      mustNot: ["Start:", "End:", "YYYY"],
      asksQuestion: true,
    },
    confirmations: 0,
  },
  note:
    "Four Mehtas are on file, so the agent asks which one (a pick card, not a yes/no). It may already set the dates and the Maldives stay now, or right after the pick; step `pick-client` checks the result. It must not ask for the dates or the year again.",
};

export const pickClient: ScenarioStep = {
  id: "pick-client",
  flowStages: [1, 2, 3],
  buildStage: "stage-2",
  title: "Tap the client; trip is set with household, assumed year and one stay",
  advisor: {
    kind: "tap",
    label: "Aarav Mehta",
    action: "trip_set_client",
    args: { client_id: AARAV },
  },
  expect: {
    trip: {
      client: { lead: "Aarav Mehta", travellers: ["Aarav Mehta", "Anika Mehta"], adults: 2, children: 0 },
      dates: { start: "2026-12-10", end: "2026-12-15", assumed: ["year"] },
      stays: [{ destination: "Maldives", checkIn: "2026-12-10", checkOut: "2026-12-15" }],
    },
    cards: ["undo"],
    reply: {
      mentions: ["Aarav", "Anika", "2 adults", "Dec", "2026", "hotel"],
      mustNot: ["Check-in", "Rooms:", "how many adults", "which year"],
      asksQuestion: true,
    },
    confirmations: 0,
  },
  note:
    "Single destination: the stay uses the trip dates automatically (flow stage 3). The reply asks once: specific hotels in mind, or suggestions?",
};

// ---------------------------------------------------------------------------
// Main scenario: named hotels → options → send → client picks → book → pre-arrival
// ---------------------------------------------------------------------------

const mainSteps: ScenarioStep[] = [
  askForTrip,
  pickClient,
  {
    id: "hotels-and-similar",
    flowStages: [4],
    buildStage: "stage-3c",
    title: "Named hotel plus similar ones, rates side by side",
    advisor: {
      kind: "say",
      text: "Six Senses Kanuhura and 2-3 others in a similar price range",
      variants: [
        "Kanuhura plus a couple of similar ones",
        "Start with Six Senses Kanuhura and suggest 2 or 3 alternatives at that price",
        "Six Senses Kanuhura, and whatever else is in the same bracket",
      ],
    },
    expect: {
      tools: { called: ["hotel_find", "rates_search"], maxCalls: { rates_search: 1 } },
      cards: ["rate_compare"],
      rateCompare: { hotels: [KANUHURA, KIHAVAH, SONEVA], excludesHotels: [CORAL_BAY] },
      reply: { mentions: [KANUHURA, KIHAVAH, SONEVA], mustNot: [CORAL_BAY] },
      readOnly: true,
      confirmations: 0,
    },
    note:
      "All hotels go in one rates_search call. The compare card shows one row per hotel with an all-in price, and the shared terms (30-day cancellation, breakfast) once.",
  },
  {
    id: "add-options",
    flowStages: [5],
    buildStage: "stage-3d",
    title: "Two rooms per hotel added to the quote in one go",
    advisor: {
      kind: "say",
      text: "Add the Beach Villa at 30%, and the Water Villa as a second option, for all 3 hotels",
      variants: [
        "For all three, add the beach villa at 30% and the water villa as a second choice",
        "Beach Villa at 30% markup as option 1 and Water Villa as option 2, for each hotel",
        "add beach villa 30% + water villa as 2nd option on all 3",
      ],
    },
    expect: {
      tools: { called: ["quote_add_options"], maxCalls: { quote_add_options: 1 } },
      trip: {
        quoteOptions: {
          count: 6,
          includes: [
            { hotel: KANUHURA, room: "Beach Villa", rank: 1, markupPercent: 30 },
            { hotel: KANUHURA, room: "Water Villa", rank: 2 },
            { hotel: KIHAVAH, room: "Beach Pool Villa", rank: 1, markupPercent: 30 },
            { hotel: KIHAVAH, room: "Over Water Pool Villa", rank: 2 },
            { hotel: SONEVA, room: "Beach Villa with Pool", rank: 1, markupPercent: 30 },
            { hotel: SONEVA, room: "Water Villa with Pool", rank: 2 },
          ],
        },
      },
      cards: ["undo"],
      reply: { mentions: ["added"], mustNot: ["Send the client price", "to be confirmed"] },
      confirmations: 0,
    },
    note:
      "Room names differ by hotel; 'Beach Villa' / 'Water Villa' must map to the closest room. The Water Villa markup is not stated: the agent applies 30% to it too and says so in one clause, instead of asking.",
  },
  {
    id: "review-quote",
    flowStages: [5],
    buildStage: "stage-3d",
    title: "Review the quote before it goes",
    advisor: {
      kind: "say",
      text: "Show me the quote",
      variants: ["Let me see the quote before it goes out", "Preview the quote", "what does the quote look like?"],
    },
    expect: {
      tools: { notCalled: ["quote_send", "quote_add_options", "quote_remove_option"] },
      reply: { mentions: [KANUHURA, KIHAVAH, SONEVA] },
      confirmations: 0,
    },
    note: "Opens the quote preview. Previewing is not sending.",
  },
  {
    id: "send-quote",
    flowStages: [5],
    buildStage: "stage-3d",
    title: "One labelled tap sends the quote",
    advisor: {
      kind: "tap",
      label: "Send 6 options to Aarav Mehta",
      action: "quote_send",
    },
    expect: {
      tools: { called: ["quote_send"] },
      trip: { quoteStatus: "sent" },
      reply: { mentions: ["sent", "Aarav"] },
      confirmations: 0,
      approvals: 0,
    },
    note: "A clearly labelled button tap is the approval (decision #3). No second Confirm card.",
  },
  {
    id: "client-picks",
    flowStages: [6],
    buildStage: "stage-4",
    title: "Advisor records the client's choice; it becomes a pending booking with Undo",
    advisor: {
      kind: "say",
      text: "Aarav picked the water villa at Kihavah",
      variants: [
        "Client went with the Kihavah over-water villa",
        "They chose option 2 at Anantara Kihavah",
        "Aarav wants the Over Water Pool Villa at Kihavah",
      ],
    },
    expect: {
      tools: { called: ["quote_select_final"], notCalled: ["quote_send", "quote_add_options"] },
      trip: {
        chosenOption: { hotel: KIHAVAH, room: "Over Water Pool Villa" },
        booking: { hotel: KIHAVAH, status: "pending" },
      },
      cards: ["undo"],
      reply: { mentions: ["Over Water Pool Villa", KIHAVAH, "booking"] },
      confirmations: 0,
      approvals: 0,
    },
    note:
      "Feedback v2: confirmation only when the quote is sent. Recording the choice runs with Undo (Undo cancels the pending booking). Pending Keshav's confirmation (redesign §2.3).",
  },
  {
    id: "booking-confirmed",
    flowStages: [6],
    buildStage: "stage-4",
    title: "Advisor books with the hotel (Bookings module)",
    advisor: {
      kind: "event",
      event: "booking_confirmed",
      args: { hotel: KIHAVAH, confirmation: "KIH-48213" },
    },
    expect: {
      trip: { booking: { hotel: KIHAVAH, status: "confirmed" } },
    },
    note: "Booking is confirmed outside the chat, as today.",
  },
  {
    id: "pre-arrival-starts",
    flowStages: [7],
    buildStage: "stage-5",
    title: "Pre-arrival starts from what the trip already has",
    advisor: { kind: "check" },
    expect: {
      trip: {
        preArrival: { started: true, prefilled: ["travellers", "dates", "stays", "preferences"] },
      },
    },
    note: "Nothing is re-entered: travellers, dates, the stay and preferences come from the trip.",
  },
];

export const MEHTA_MALDIVES: AgentScenario = {
  id: "mehta-maldives",
  title: "Mehta / Maldives — ideal flow from one line to pre-arrival",
  now: "2026-10-19T10:00:00+05:30",
  advisorMemberId: "member-vijay",
  steps: mainSteps,
  interruptions: [
    {
      id: "visa-question",
      afterStep: "pick-client",
      buildStage: "stage-1",
      advisor: {
        kind: "say",
        text: "What's the visa situation for Indian passport holders in the Maldives?",
        variants: ["Do they need a visa?", "visa for the Maldives?"],
      },
      expect: {
        readOnly: true,
        reply: { mentions: ["visa on arrival"], mustNot: ["2026-10-10"] },
      },
      note: "Answered from the Atlas notes: looked up now, or reused from earlier in the chat (no second lookup needed).",
    },
    {
      id: "cancellation-question",
      afterStep: "hotels-and-similar",
      buildStage: "stage-3c",
      advisor: {
        kind: "say",
        text: "What's the cancellation on these?",
        variants: ["Can they cancel for free?", "cancellation terms?"],
      },
      expect: {
        readOnly: true,
        reply: { mentions: ["30 days"] },
      },
    },
    {
      id: "margin-question",
      afterStep: "add-options",
      buildStage: "stage-3d",
      advisor: {
        kind: "say",
        text: "What's our margin on the Kanuhura beach villa option?",
        variants: ["How much do we make on option 1 at Kanuhura?"],
      },
      expect: {
        readOnly: true,
        reply: { mentions: ["30%"] },
      },
    },
    {
      id: "free-cancel-deadline",
      afterStep: "send-quote",
      buildStage: "stage-3d",
      advisor: {
        kind: "say",
        text: "Until when can they cancel for free?",
        variants: ["Free cancellation deadline?"],
      },
      expect: {
        readOnly: true,
        reply: { mentions: ["30 days"] },
      },
    },
  ],
  budget: {
    maxAdvisorInputsToQuoteSent: 6,
    maxConfirmationsTotal: 0,
    maxApprovalsToQuoteSent: 0,
  },
  everyReply: { mustNot: EVERY_REPLY_MUST_NOT },
};

// ---------------------------------------------------------------------------
// Branch: advisor wants suggestions instead of naming hotels
// ---------------------------------------------------------------------------

export const MEHTA_MALDIVES_SUGGEST: AgentScenario = {
  id: "mehta-maldives-suggest",
  title: "Mehta / Maldives — advisor asks for hotel suggestions",
  now: "2026-10-19T10:00:00+05:30",
  advisorMemberId: "member-vijay",
  steps: [
    askForTrip,
    pickClient,
    {
      id: "suggest-hotels",
      flowStages: [4],
      buildStage: "stage-3c",
      title: "Agent suggests hotels and shows their rates side by side",
      advisor: {
        kind: "say",
        text: "Suggest some",
        variants: ["You pick", "Suggest 3 good options for a couple", "no specific hotels, what do you recommend?"],
      },
      expect: {
        tools: { called: ["hotel_find", "rates_search"], maxCalls: { rates_search: 1 } },
        cards: ["rate_compare"],
        rateCompare: { minHotels: 2 },
        reply: { asksQuestion: false },
        readOnly: true,
        confirmations: 0,
      },
      note: "Suggestions come only from hotels PureLuxe has (seed), never invented.",
    },
  ],
  budget: {
    maxAdvisorInputsToQuoteSent: 6,
    maxConfirmationsTotal: 0,
    maxApprovalsToQuoteSent: 0,
  },
  everyReply: { mustNot: EVERY_REPLY_MUST_NOT },
};

// ---------------------------------------------------------------------------
// Branch: the dates have already passed this year, so the year rolls over
// ---------------------------------------------------------------------------

export const MEHTA_MALDIVES_NEXT_YEAR: AgentScenario = {
  id: "mehta-maldives-next-year",
  title: "Mehta / Maldives — '10–15 Dec' after mid-December means next year",
  now: "2026-12-20T10:00:00+05:30",
  advisorMemberId: "member-vijay",
  steps: [
    askForTrip,
    {
      ...pickClient,
      id: "pick-client-next-year",
      expect: {
        ...pickClient.expect,
        trip: {
          client: { lead: "Aarav Mehta", travellers: ["Aarav Mehta", "Anika Mehta"], adults: 2, children: 0 },
          dates: { start: "2027-12-10", end: "2027-12-15", assumed: ["year"] },
          stays: [{ destination: "Maldives", checkIn: "2027-12-10", checkOut: "2027-12-15" }],
        },
        reply: { ...pickClient.expect.reply, mentions: ["Aarav", "Anika", "2 adults", "Dec", "2027"] },
      },
      note: "Next occurrence of 10–15 December after 20 Dec 2026 is 2027.",
    },
  ],
  budget: {
    maxAdvisorInputsToQuoteSent: 6,
    maxConfirmationsTotal: 0,
    maxApprovalsToQuoteSent: 0,
  },
  everyReply: { mustNot: EVERY_REPLY_MUST_NOT },
};
