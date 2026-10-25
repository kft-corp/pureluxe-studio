import type { AgentScenario, ScenarioStep } from "../scenario-types";

import { askForTrip, EVERY_REPLY_MUST_NOT, pickClient } from "./mehta-maldives";

/**
 * Golden test #2 (redesign §10): multi-city trip asks about the split only once.
 * Stage 4 — trip_propose_split card, then Accept applies trip_set_stays.
 */
const askForSplit: ScenarioStep = {
  id: "ask-multi-city",
  flowStages: [3],
  buildStage: "stage-4",
  title: "Two places for one trip → propose the split once",
  advisor: {
    kind: "say",
    text: "Maldives 10–15 Dec: first two nights in Malé, then Baa Atoll for the rest",
    variants: [
      "Split the Maldives trip: Malé 10–12 Dec, Baa Atoll 12–15 Dec",
      "They want Malé then Baa Atoll over 10–15 December",
    ],
  },
  expect: {
    tools: {
      called: ["trip_propose_split"],
      notCalled: ["trip_set_stays"],
      maxCalls: { trip_propose_split: 1 },
    },
    cards: ["leg_split"],
    confirmations: 0,
    approvals: 0,
  },
  note: "Golden test #2: the agent proposes the split once as a card; it does not apply stays yet.",
};

const acceptSplit: ScenarioStep = {
  id: "accept-split",
  flowStages: [3],
  buildStage: "stage-4",
  title: "Accept applies the proposed stays",
  advisor: {
    kind: "tap",
    label: "Accept · Malé 10–12, Baa Atoll 12–15",
    action: "trip_set_stays",
    args: {
      stays: [
        { city: "Malé", check_in: "2026-12-10", check_out: "2026-12-12" },
        { city: "Baa Atoll", check_in: "2026-12-12", check_out: "2026-12-15" },
      ],
    },
  },
  expect: {
    tools: { called: ["trip_set_stays"] },
    trip: {
      stays: [
        { destination: "Malé", checkIn: "2026-12-10", checkOut: "2026-12-12" },
        { destination: "Baa Atoll", checkIn: "2026-12-12", checkOut: "2026-12-15" },
      ],
    },
    cards: ["undo"],
    confirmations: 0,
  },
};

const noRepeat: ScenarioStep = {
  id: "no-repeat-split",
  flowStages: [3],
  buildStage: "stage-4",
  title: "Asking again after the split is set does not re-propose",
  advisor: {
    kind: "say",
    text: "Is the Maldives split still Malé then Baa?",
  },
  expect: {
    tools: { notCalled: ["trip_propose_split"] },
    trip: {
      stays: [
        { destination: "Malé", checkIn: "2026-12-10", checkOut: "2026-12-12" },
        { destination: "Baa Atoll", checkIn: "2026-12-12", checkOut: "2026-12-15" },
      ],
    },
    readOnly: true,
  },
  note: "Ask only once — once stays match the split, answer from trip facts.",
};

export const MULTI_CITY_SPLIT: AgentScenario = {
  id: "multi-city-split",
  title: "Multi-city — propose the stay split once (golden #2)",
  now: "2026-10-19T10:00:00+05:30",
  advisorMemberId: "member-vijay",
  steps: [askForTrip, pickClient, askForSplit, acceptSplit, noRepeat],
  budget: {
    maxAdvisorInputsToQuoteSent: 6,
    maxConfirmationsTotal: 0,
    maxApprovalsToQuoteSent: 0,
  },
  everyReply: { mustNot: EVERY_REPLY_MUST_NOT },
};
