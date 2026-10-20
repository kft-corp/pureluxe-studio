import {
  createMemoryCheckpointer,
  createTurnMeter,
  errorCodeOf,
  readAgentMemory,
  streamTripAgentTurn,
  userMessageOf,
  type AgentTurnMetrics,
  type AgentTurnRequest,
  type TripAgentHandlers,
} from "@pureluxe/ai";

import type {
  AdvisorInput,
  AgentScenario,
  BuildStage,
  CardKind,
  Interruption,
  ScenarioSeed,
  ScenarioStep,
  StepExpect,
} from "../scenario-types";

import { checkStep } from "./checks";
import { fastForwardTrip, newEvalTrip, type EvalTrip } from "./eval-trip";
import { createSeedHandlers } from "./seed-handlers";

type Checkpointer = ReturnType<typeof createMemoryCheckpointer>;

export function stageNumber(stage: BuildStage): number {
  return Number(stage.replace("stage-", ""));
}

/** One entry in the order a scenario is played. */
export type PlannedStep = {
  id: string;
  title: string;
  advisor: AdvisorInput;
  expect: StepExpect;
  /** Null when it runs; otherwise why it is skipped. Skipped steps still apply their expected trip. */
  skip: string | null;
};

function playable(advisor: AdvisorInput): string | null {
  if (advisor.kind === "event") return "outside-chat event (not simulated yet)";
  if (advisor.kind === "check") return "system check (not simulated yet)";
  return null;
}

/**
 * Steps in play order, with each interruption right after the step it follows.
 * A step from a later build stage is skipped and fast-forwarded.
 */
export function planScenario(scenario: AgentScenario, stage: number): PlannedStep[] {
  const interruptions = new Map<string, Interruption[]>();
  for (const item of scenario.interruptions ?? []) {
    interruptions.set(item.afterStep, [...(interruptions.get(item.afterStep) ?? []), item]);
  }

  const toPlanned = (item: ScenarioStep | Interruption, title: string): PlannedStep => {
    const later = stageNumber(item.buildStage) > stage ? `${item.buildStage} (not built yet)` : null;
    return {
      id: item.id,
      title,
      advisor: item.advisor,
      expect: item.expect,
      skip: later ?? playable(item.advisor),
    };
  };

  return scenario.steps.flatMap((step) => [
    toPlanned(step, step.title),
    ...(interruptions.get(step.id) ?? []).map((item) => toPlanned(item, `Question: ${item.advisor.text}`)),
  ]);
}

function toRequest(advisor: AdvisorInput, variant: number): AgentTurnRequest {
  switch (advisor.kind) {
    case "say":
      return { kind: "message", text: variant > 0 ? advisor.variants?.[variant - 1] ?? advisor.text : advisor.text };
    case "tap":
      if (advisor.action === "approve" || advisor.action === "cancel") {
        return { kind: "resume", decision: advisor.action };
      }
      return { kind: "action", action: { tool: advisor.action, args: advisor.args ?? {}, label: advisor.label } };
    default:
      throw new Error(`Advisor input "${advisor.kind}" can't be sent to the agent.`);
  }
}

/** Everything one scenario run shares across steps. */
export type EvalRun = {
  scenario: AgentScenario;
  seed: ScenarioSeed;
  variant: number;
  trip: EvalTrip;
  handlers: TripAgentHandlers;
  checkpointer: Checkpointer;
  today: string;
};

export function startEvalRun(
  scenario: AgentScenario,
  seed: ScenarioSeed,
  options: { variant: number; runId: string },
): EvalRun {
  const today = scenario.now.slice(0, 10);
  const trip = newEvalTrip(`eval-${scenario.id}-${options.runId}`);
  return {
    scenario,
    seed,
    variant: options.variant,
    trip,
    handlers: createSeedHandlers(seed, trip, today),
    checkpointer: createMemoryCheckpointer(),
    today,
  };
}

export type StepOutcome = {
  id: string;
  status: "pass" | "fail" | "skip";
  /** What the advisor sent. */
  sent: string;
  reply: string;
  tools: string[];
  failures: string[];
  notChecked: string[];
  metrics: AgentTurnMetrics | null;
};

/** Apply a skipped step's expected result, so the steps after it have the right trip. */
export function skipStep(run: EvalRun, planned: PlannedStep): StepOutcome {
  fastForwardTrip(run.trip, planned.expect.trip, run.seed);
  return {
    id: planned.id,
    status: "skip",
    sent: "",
    reply: "",
    tools: [],
    failures: [],
    notChecked: [],
    metrics: null,
  };
}

/** Send one step to the real agent and check the result. */
export async function playStep(run: EvalRun, planned: PlannedStep): Promise<StepOutcome> {
  const request = toRequest(planned.advisor, run.variant);
  const sent =
    planned.advisor.kind === "tap"
      ? `[tap] ${planned.advisor.label}`
      : request.kind === "message"
        ? request.text
        : "";
  const meter = createTurnMeter();
  let reply = "";
  let undo = false;
  const cards = new Set<CardKind>();
  let error: string | null = null;

  try {
    for await (const chunk of streamTripAgentTurn({
      tripId: run.trip.tripId,
      request,
      handlers: run.handlers,
      checkpointer: run.checkpointer,
      today: run.today,
      meter,
    })) {
      if (chunk.kind === "delta") reply += chunk.text;
      if (chunk.kind === "changed") undo = chunk.undo;
      if (chunk.kind === "choices") cards.add("client_picker");
      if (chunk.kind === "approval") {
        cards.add("approval");
        reply ||= chunk.approval.summary;
      }
    }
    if (undo) cards.add("undo");
  } catch (cause) {
    error = userMessageOf(cause) ?? errorCodeOf(cause);
  }

  const metrics = meter.read();
  const tools = metrics.toolCalls.map((call) => call.name);
  const memory = (await readAgentMemory(run.checkpointer, run.trip.tripId))
    .map((line) => line.text)
    .join("\n");
  const check = checkStep(
    planned.expect,
    { reply, tools, memory, trip: run.trip, cards: [...cards], seed: run.seed },
    run.scenario.everyReply.mustNot,
  );
  const failures = error ? [`agent failed: ${error}`, ...check.failures] : check.failures;

  return {
    id: planned.id,
    status: failures.length > 0 ? "fail" : "pass",
    sent,
    reply,
    tools,
    failures,
    notChecked: check.notChecked,
    metrics,
  };
}
