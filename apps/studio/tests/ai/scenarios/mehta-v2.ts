import type { AgentScenario, ScenarioStep } from "../scenario-types";

import { EVERY_REPLY_MUST_NOT } from "./mehta-maldives";

/**
 * Feedback v2 (Keshav, Oct 21): the Mehta family, Maldives 15–20 Dec 2026.
 * Redesign §2.3 lists the 21 notes; golden tests #14–#20 in §10.
 */

const KANUHURA = "Six Senses Kanuhura";
const KIHAVAH = "Anantara Kihavah";
const VAKKARU = "Vakkaru Maldives";
const SONEVA = "Soneva Fushi";
const CORAL_BAY = "Coral Bay Resort";

const FAMILY = ["Ravi Mehta", "Anika Mehta", "Aarav Mehta", "Kiara Mehta"];
const MALDIVES_STAY = [{ destination: "Maldives", checkIn: "2026-12-15", checkOut: "2026-12-20" }];

/** Old-flow phrases from the Oct 21 run, on top of the shared list. */
const V2_MUST_NOT = [...EVERY_REPLY_MUST_NOT, "Save trip dates", "tap Save stay", "may be typos", "single digit"];

/** Notes 1, 2, 4: one line from the home chat sets up the whole trip. */
const familyRequest: ScenarioStep = {
  id: "family-request",
  flowStages: [1, 2, 3],
  buildStage: "stage-2b",
  chat: "home",
  title: "From the home chat, the household, dates and stay in one line",
  advisor: {
    kind: "say",
    text: "Mehta family, Maldives 15–20 Dec",
    variants: [
      "Create a trip for the Mehta family, all 4 of them, Maldives 15 to 20 December this year",
      "New trip: the Mehtas, all four, Maldives, Dec 15-20",
      "mehta family maldives 15-20 dec",
    ],
  },
  expect: {
    tools: { called: ["client_search", "trip_create"] },
    trip: {
      client: { lead: "Ravi Mehta", travellers: FAMILY, adults: 2, children: 2 },
      dates: { start: "2026-12-15", end: "2026-12-20" },
      stays: MALDIVES_STAY,
    },
    cards: ["trip_opened"],
    reply: {
      mentions: ["Ravi", "2 adults", "2 children", "2026"],
      mustNot: ["which one", "Who should lead", "just them", "can't create", "one at a time"],
      asksQuestion: true,
    },
    confirmations: 0,
  },
  note:
    "Golden test #15. Every Mehta match is one household, so Ravi (the household's primary) leads without asking and all four travel. The new trip opens and the next steps run in its chat.",
};

/** Golden test #14: Keshav's acceptance test, under 10 messages, the send is the only approval. */
export const MEHTA_V2_ACCEPTANCE: AgentScenario = {
  id: "mehta-v2-acceptance",
  title: "Feedback v2 acceptance — Mehta family, Maldives, three hotels, six options, quote sent",
  now: "2026-10-21T10:50:00+05:30",
  advisorMemberId: "member-vijay",
  steps: [
    familyRequest,
    {
      id: "hotels-same-tier",
      flowStages: [4],
      buildStage: "stage-3c",
      title: "Rates for the named hotel and two more in its tier, side by side, at once",
      advisor: {
        kind: "say",
        text: "Six Senses Kanuhura and two others in the same tier, 2 rooms",
        variants: [
          "Give me rates for Kanuhura and 2 similar hotels, 2 rooms",
          "rates for six senses kanuhura plus two more luxury options, two rooms",
          "Need rates first: Kanuhura and two others like it, 2 rooms",
        ],
      },
      expect: {
        tools: { called: ["hotel_find", "rates_search"], notCalled: ["quote_add_options"], maxCalls: { rates_search: 1 } },
        cards: ["rate_compare"],
        rateCompare: { hotels: [KANUHURA, KIHAVAH, VAKKARU], excludesHotels: [SONEVA, CORAL_BAY] },
        reply: {
          mentions: [KANUHURA, KIHAVAH, VAKKARU, "2 rooms", "2 adults", "2 children", "connecting"],
          mustNot: ["Save stay", "Search rates?", "no saved stay", "one hotel at a time"],
        },
        confirmations: 0,
      },
      note:
        "Notes 5, 12, 13, 15; golden test #17. No saved stay needed, no 'Search rates?' question; dates, party and rooms are stated with the results; Anika's connecting-rooms preference is surfaced.",
    },
    {
      id: "add-six-options",
      flowStages: [5],
      buildStage: "stage-3d",
      title: "Two rooms from each hotel added in one message, at the prices and markups given",
      advisor: {
        kind: "say",
        text: "Beach Villa and Water Villa from each. Kanuhura at USD 6,075 and USD 8,081.25, the other two at 25%",
        variants: [
          "Kanuhura Beach Villa with Pool quote USD 6,075 / Kanuhura Water Villa with Pool quote USD 8,081.25 / beach and water villas at Kihavah and Vakkaru at 25% markup",
          "add the beach villa + water villa for all 3 hotels; kanuhura prices 6075 and 8081.25 USD, the others 25%",
        ],
      },
      expect: {
        tools: { called: ["quote_add_options"], maxCalls: { quote_add_options: 1 } },
        trip: {
          quoteOptions: {
            count: 6,
            includes: [
              { hotel: KANUHURA, room: "Beach Villa with Pool", clientPrice: 6075 },
              { hotel: KANUHURA, room: "Water Villa with Pool", clientPrice: 8081.25 },
              { hotel: KIHAVAH, room: "Beach Pool Villa", markupPercent: 25 },
              { hotel: KIHAVAH, room: "Over Water Pool Villa", markupPercent: 25 },
              { hotel: VAKKARU, room: "Beach Villa with Pool", markupPercent: 25 },
              { hotel: VAKKARU, room: "Over Water Villa with Pool", markupPercent: 25 },
            ],
          },
        },
        cards: ["undo"],
        reply: {
          mentions: ["6", "minimum"],
          mustNot: ["typo", "What client price", "Save Beach Villa", "can't save", "one room at a time"],
        },
        confirmations: 0,
      },
      note:
        "Notes 16–19; golden test #19. Both Kanuhura prices sit below its 25% minimum markup (USD 6,975 and 8,881.25): flagged once, then applied as given.",
    },
    {
      id: "markup-percent",
      flowStages: [5],
      buildStage: "stage-3d",
      title: "A percentage markup is applied in that step",
      advisor: {
        kind: "say",
        text: "Make the Kihavah water villa 10% instead",
        variants: ["Kihavah Over Water Pool Villa at a 10% markup", "markup 10% on the kihavah water villa"],
      },
      expect: {
        trip: {
          quoteOptions: { count: 6, includes: [{ hotel: KIHAVAH, room: "Over Water Pool Villa", markupPercent: 10 }] },
        },
        cards: ["undo"],
        reply: { mentions: ["10%", "minimum"], mustNot: ["send that amount", "send 1"] },
        confirmations: 0,
      },
      note: "Note 20: the markup is applied and the price set, not returned as a number to send back.",
    },
    {
      id: "send-quote",
      flowStages: [5],
      buildStage: "stage-3d",
      title: "One labelled tap sends the quote",
      advisor: { kind: "tap", label: "Send 6 options to Ravi Mehta", action: "quote_send" },
      expect: {
        tools: { called: ["quote_send"] },
        trip: { quoteStatus: "sent" },
        reply: { mentions: ["sent", "Ravi"] },
        confirmations: 0,
        approvals: 0,
      },
      note: "Priority 3: the send is the only confirmation, and a labelled tap is that confirmation.",
    },
  ],
  interruptions: [
    {
      id: "per-room-or-total",
      afterStep: "hotels-same-tier",
      buildStage: "stage-3b",
      advisor: {
        kind: "say",
        text: "Is that price per room or for both rooms?",
        variants: ["per room or total?"],
      },
      expect: { readOnly: true, reply: { mentions: ["room"] } },
      note: "Note 14; golden test #18. Each price says what it covers. The price rule itself is unit-tested in packages/rates.",
    },
    {
      id: "below-minimum-question",
      afterStep: "add-six-options",
      buildStage: "stage-3d",
      advisor: {
        kind: "say",
        text: "Which options are below the minimum markup?",
        variants: ["anything under the hotel minimum?"],
      },
      expect: { readOnly: true, reply: { mentions: [KANUHURA] } },
    },
  ],
  budget: {
    maxAdvisorInputsToQuoteSent: 9,
    maxConfirmationsTotal: 0,
    maxApprovalsToQuoteSent: 0,
  },
  everyReply: { mustNot: V2_MUST_NOT },
};

/** The household already has a confirmed trip on those dates: warn, and create only when asked. */
export const MEHTA_V2_UPCOMING_TRIP: AgentScenario = {
  id: "mehta-v2-upcoming-trip",
  title: "Feedback v2 duplicate check — an upcoming trip stops creation until the advisor chooses",
  now: "2026-10-21T10:50:00+05:30",
  advisorMemberId: "member-vijay",
  steps: [
    {
      id: "upcoming-trip-warning",
      flowStages: [1],
      buildStage: "stage-2b",
      chat: "home",
      title: "Lists the confirmed trip on the same dates and creates nothing",
      advisor: { kind: "say", text: "Mehta family, Maldives 15–20 Dec", variants: ["New trip for the Mehtas, Maldives, Dec 15-20"] },
      expect: {
        tools: { called: ["client_search", "trip_create"], notCalled: ["trip_open"] },
        reply: {
          mentions: ["Maldives", "confirmed", "2026"],
          mustNot: ["Trip created for", "I've created", "I have created", "is now open"],
          asksQuestion: true,
        },
        confirmations: 0,
      },
      note: "Nothing is created; buttons offer Open or Create a new trip.",
    },
    {
      id: "create-anyway",
      flowStages: [1, 2, 3],
      buildStage: "stage-2b",
      chat: "home",
      title: "Asked to create it anyway, it creates the trip with everything said before",
      advisor: { kind: "say", text: "Create a new trip anyway", variants: ["make a separate new trip"] },
      expect: {
        tools: { called: ["trip_create"] },
        trip: {
          client: { lead: "Ravi Mehta", travellers: FAMILY, adults: 2, children: 2 },
          dates: { start: "2026-12-15", end: "2026-12-20" },
          stays: MALDIVES_STAY,
        },
        cards: ["trip_opened"],
        confirmations: 0,
      },
    },
  ],
  budget: {
    maxAdvisorInputsToQuoteSent: 9,
    maxConfirmationsTotal: 0,
    maxApprovalsToQuoteSent: 0,
  },
  everyReply: { mustNot: V2_MUST_NOT },
};

/** Oct 22 local test: "past trips" found nothing travelled and said "none", though two trips were open. */
export const MEHTA_V2_PAST_TRIPS: AgentScenario = {
  id: "mehta-v2-past-trips",
  title: "Feedback v2 trip history — an empty filter never becomes \"no trips on file\"",
  now: "2026-10-21T10:50:00+05:30",
  advisorMemberId: "member-vijay",
  steps: [
    {
      id: "find-mehtas",
      flowStages: [1],
      buildStage: "stage-2b",
      chat: "home",
      title: "Finds the Mehta household",
      advisor: { kind: "say", text: "is there any mehta" },
      expect: {
        tools: { called: ["client_search"], notCalled: ["trip_create"] },
        reply: { mentions: ["Ravi"] },
        readOnly: true,
      },
    },
    {
      id: "past-trips",
      flowStages: [1],
      buildStage: "stage-2b",
      chat: "home",
      title: "Asked for past trips, it lists the open ones instead of saying none",
      advisor: {
        kind: "say",
        text: "there past trips ?",
        variants: ["any previous trips for them?", "have the Mehtas travelled with us before?"],
      },
      expect: {
        tools: { called: ["history_search_trips"], notCalled: ["trip_create"] },
        reply: {
          mentions: ["Dubai", "Maldives"],
          mustNot: ["no past trips on file", "no trips on file", "none of them has one", "no trips on record"],
        },
        readOnly: true,
      },
      note: "Nothing travelled yet, but a confirmed Maldives trip and a Dubai trip in building are on file.",
    },
  ],
  budget: {
    maxAdvisorInputsToQuoteSent: 9,
    maxConfirmationsTotal: 0,
    maxApprovalsToQuoteSent: 0,
  },
  everyReply: { mustNot: V2_MUST_NOT },
};

/** Golden tests #16 and #20: words never become names; reversible changes never ask. */
export const MEHTA_V2_SET_UP_CHECKS: AgentScenario = {
  id: "mehta-v2-set-up-checks",
  title: "Feedback v2 set-up checks — command words, labels, and reversible changes without asking",
  now: "2026-10-21T10:50:00+05:30",
  advisorMemberId: "member-vijay",
  steps: [
    familyRequest,
    {
      id: "command-word",
      flowStages: [3],
      buildStage: "stage-2",
      title: "A command word never becomes a stay",
      advisor: { kind: "say", text: "completed", variants: ["done", "Plan these stays"] },
      expect: {
        tools: { notCalled: ["trip_remove_stay", "trip_set_dates", "trip_shift_dates"] },
        trip: { stays: MALDIVES_STAY },
        reply: { mustNot: ["Add completed", "completed for the whole trip"] },
        confirmations: 0,
      },
      note: "Note 7. The Maldives leg already covers the trip, so nothing changes.",
    },
    {
      id: "label-in-value",
      flowStages: [3],
      buildStage: "stage-2",
      title: "A field label never becomes part of a name",
      advisor: {
        kind: "say",
        text: "There is only one leg on the trip, all 5 days in the Maldives",
        variants: ["City maldives", "City: Maldives, check-in 15 Dec, check-out 20 Dec"],
      },
      expect: {
        tools: { notCalled: ["trip_remove_stay", "trip_shift_dates"] },
        trip: { stays: MALDIVES_STAY },
        confirmations: 0,
      },
      note: "Notes 9, 10. The stay stays 'Maldives' for the whole trip; no form, no confirm chip.",
    },
    {
      id: "move-trip-no-booking",
      flowStages: [2, 3],
      buildStage: "stage-2b",
      title: "Moving the whole trip with no booking runs at once, with Undo",
      advisor: {
        kind: "say",
        text: "Move the whole trip one day later",
        variants: ["Push everything by a day", "shift the trip +1 day"],
      },
      expect: {
        tools: { called: ["trip_shift_dates"] },
        trip: {
          dates: { start: "2026-12-16", end: "2026-12-21" },
          stays: [{ destination: "Maldives", checkIn: "2026-12-16", checkOut: "2026-12-21" }],
        },
        cards: ["undo"],
        approvals: 0,
        confirmations: 0,
      },
      note: "Golden test #20 and priority 3: a booking-free move is reversible, so it doesn't ask.",
    },
    {
      id: "undo-move",
      flowStages: [2, 3],
      buildStage: "stage-2b",
      title: "Undo puts the dates back",
      advisor: { kind: "tap", label: "Undo", action: "trip_undo" },
      expect: {
        tools: { called: ["trip_undo"] },
        trip: { dates: { start: "2026-12-15", end: "2026-12-20" }, stays: MALDIVES_STAY },
        reply: { mentions: ["Undone"] },
        approvals: 0,
      },
    },
    {
      id: "remove-stay-no-booking",
      flowStages: [3],
      buildStage: "stage-2b",
      title: "Removing a stay with no booking runs at once, with no booking warning",
      advisor: { kind: "say", text: "Remove the Maldives stay", variants: ["drop the maldives leg"] },
      expect: {
        tools: { called: ["trip_remove_stay"] },
        trip: { stays: [] },
        cards: ["undo"],
        reply: { mustNot: ["booking will be cancelled"] },
        approvals: 0,
        confirmations: 0,
      },
      note: "Note 8: booking warnings appear only when a booking exists.",
    },
  ],
  budget: {
    maxAdvisorInputsToQuoteSent: 9,
    maxConfirmationsTotal: 0,
    maxApprovalsToQuoteSent: 0,
  },
  everyReply: { mustNot: V2_MUST_NOT },
};
