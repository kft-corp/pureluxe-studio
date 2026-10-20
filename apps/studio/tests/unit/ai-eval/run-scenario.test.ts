import { describe, expect, it } from "vitest";

import { planScenario, skipStep, startEvalRun } from "@/tests/ai/eval/run-scenario";
import { MEHTA_CLIENT_IDS, MEHTA_MALDIVES_SEED } from "@/tests/ai/fixtures/mehta-maldives";
import { MEHTA_MALDIVES } from "@/tests/ai/scenarios/mehta-maldives";
import { MEHTA_QUESTIONS } from "@/tests/ai/scenarios/mehta-questions";

describe("planScenario", () => {
  it("runs only steps the current build stage can do, with questions after their step", () => {
    const plan = planScenario(MEHTA_MALDIVES, 1);
    const running = plan.filter((step) => !step.skip).map((step) => step.id);

    expect(running).toEqual(["trip-request", "visa-question"]);
    expect(plan.map((step) => step.id).slice(0, 4)).toEqual([
      "trip-request",
      "pick-client",
      "visa-question",
      "hotels-and-similar",
    ]);
    expect(plan.find((step) => step.id === "pick-client")?.skip).toBe("stage-2 (not built yet)");
  });

  it("runs more of the flow at a later stage", () => {
    const running = planScenario(MEHTA_MALDIVES, 2).filter((step) => !step.skip).map((step) => step.id);
    expect(running).toEqual(["trip-request", "pick-client", "visa-question"]);
  });

  it("gives the questions scenario a real set of questions", () => {
    const running = planScenario(MEHTA_QUESTIONS, 1).filter((step) => !step.skip);
    expect(running.length).toBeGreaterThanOrEqual(6);
  });
});

describe("skipStep", () => {
  it("fast-forwards the trip a later-stage step would have set up", () => {
    const run = startEvalRun(MEHTA_QUESTIONS, MEHTA_MALDIVES_SEED, { variant: 0, runId: "t" });
    const pick = planScenario(MEHTA_QUESTIONS, 1).find((step) => step.id === "pick-client")!;

    expect(skipStep(run, pick).status).toBe("skip");
    expect(run.trip).toMatchObject({
      leadClientId: MEHTA_CLIENT_IDS.aarav,
      travellerIds: [MEHTA_CLIENT_IDS.aarav, MEHTA_CLIENT_IDS.anika],
      startsOn: "2026-12-10",
      endsOn: "2026-12-15",
      stays: [{ destination: "Maldives", checkIn: "2026-12-10", checkOut: "2026-12-15", hotel: null }],
    });
  });
});
