import {
  createMemoryCheckpointer,
  createTurnMeter,
  errorCodeOf,
  readAgentMemory,
  streamHomeAgentTurn,
  streamTripAgentTurn,
  userMessageOf,
  type AgentStreamChunk,
  type AgentTurnMetrics,
  type AgentTurnRequest,
  type ChatHistoryMessage,
  type HomeAgentHandlers,
  type TripAgentHandlers,
  type TurnMeter,
} from "@pureluxe/ai";

import type {
  AdvisorInput,
  AgentScenario,
  CardKind,
  Interruption,
  ScenarioSeed,
  ScenarioStep,
  StepExpect,
} from "../scenario-types";

import { stageNumber } from "./build-stage";
import { checkStep } from "./checks";
import { fastForwardTrip, newEvalTrip, type EvalTrip } from "./eval-trip";
import { createSeedHandlers, createSeedHomeHandlers } from "./seed-handlers";

type Checkpointer = ReturnType<typeof createMemoryCheckpointer>;

/** One entry in the order a scenario is played. */
export type PlannedStep = {
  id: string;
  title: string;
  chat: "home" | "trip";
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
      chat: "chat" in item && item.chat === "home" ? "home" : "trip",
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
  homeHandlers: HomeAgentHandlers;
  /** The home conversation so far; Studio copies it into the trip it creates. */
  homeHistory: ChatHistoryMessage[];
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
    homeHandlers: createSeedHomeHandlers(seed, trip, today),
    homeHistory: [],
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

function streamStep(
  run: EvalRun,
  planned: PlannedStep,
  request: AgentTurnRequest,
  meter: TurnMeter,
): AsyncGenerator<AgentStreamChunk, void, unknown> {
  if (planned.chat === "trip") {
    return streamTripAgentTurn({
      tripId: run.trip.tripId,
      request,
      handlers: run.handlers,
      checkpointer: run.checkpointer,
      loadHistory: async () => run.homeHistory,
      today: run.today,
      meter,
    });
  }
  if (request.kind === "resume") throw new Error(`Step ${planned.id}: the home chat has no approvals.`);
  return streamHomeAgentTurn({
    request,
    handlers: run.homeHandlers,
    history: run.homeHistory,
    today: run.today,
    meter,
  });
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
    for await (const chunk of streamStep(run, planned, request, meter)) {
      if (chunk.kind === "delta") reply += chunk.text;
      if (chunk.kind === "changed") undo = chunk.undo;
      if (chunk.kind === "choices") cards.add("client_picker");
      if (chunk.kind === "opened") cards.add("trip_opened");
      if (chunk.kind === "approval") {
        cards.add("approval");
        reply ||= chunk.approval.summary;
      }
    }
    if (undo) cards.add("undo");
  } catch (cause) {
    error = userMessageOf(cause) ?? errorCodeOf(cause);
  }

  if (planned.chat === "home") {
    run.homeHistory.push({ role: "user", content: sent }, { role: "assistant", content: reply });
  }
  const metrics = meter.read();
  const tools = metrics.toolCalls.map((call) => call.name);
  const memory =
    planned.chat === "home"
      ? run.homeHistory.map((line) => line.content).join("\n")
      : (await readAgentMemory(run.checkpointer, run.trip.tripId)).map((line) => line.text).join("\n");
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
