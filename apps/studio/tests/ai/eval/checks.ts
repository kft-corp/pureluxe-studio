import { findAgentTool } from "@pureluxe/ai";

import type { CardKind, ScenarioSeed, StepExpect } from "../scenario-types";

import type { EvalTrip } from "./eval-trip";

/** What the agent did in one step. */
export type ObservedStep = {
  reply: string;
  /** Tool names in call order (a tapped tool included). */
  tools: string[];
  /** Everything in agent memory after the step, as one text. */
  memory: string;
  trip: EvalTrip;
  /** Cards shown with the reply. */
  cards: CardKind[];
  seed: ScenarioSeed;
};

export type StepCheck = {
  failures: string[];
  /** Expectations this build stage can't check yet (rate cards, quote state). */
  notChecked: string[];
};

/** Cards the agent can show so far. */
const CHECKED_CARDS: readonly CardKind[] = ["undo", "client_picker", "approval", "trip_opened"];

/** Yes/no prompts the agent should never need; risky changes use an approval card. */
const CONFIRMATION_PROMPT =
  /\b(?:say|reply|type)\s+\**yes\**|\byes or no\b|\bare you sure\b|\bshall i (?:go ahead|proceed)\b/gi;

function lastParagraph(text: string): string {
  const paragraphs = text.trim().split(/\n\s*\n/).filter((part) => part.trim());
  return paragraphs.at(-1)?.trim() ?? "";
}

function checkTools(expect: StepExpect, tools: string[], failures: string[]) {
  const called = new Set(tools);
  for (const name of expect.tools?.called ?? []) {
    if (!called.has(name)) failures.push(`expected ${name} to be called (called: ${tools.join(", ") || "none"})`);
  }
  for (const name of expect.tools?.notCalled ?? []) {
    if (called.has(name)) failures.push(`${name} must not be called`);
  }
  for (const [name, max] of Object.entries(expect.tools?.maxCalls ?? {})) {
    const count = tools.filter((tool) => tool === name).length;
    if (count > max) failures.push(`${name} called ${count} times (max ${max})`);
  }
  if (expect.readOnly) {
    const writes = tools.filter((name) => findAgentTool(name)?.risk !== "read");
    if (writes.length > 0) failures.push(`read-only step changed something: ${writes.join(", ")}`);
  }
}

function checkReply(expect: StepExpect, reply: string, everyReply: string[], failures: string[]) {
  const text = reply.toLowerCase();
  if (!reply.trim()) failures.push("empty reply");
  for (const word of expect.reply?.mentions ?? []) {
    if (!text.includes(word.toLowerCase())) failures.push(`reply should mention "${word}"`);
  }
  for (const word of [...(expect.reply?.mustNot ?? []), ...everyReply]) {
    if (text.includes(word.toLowerCase())) failures.push(`reply must not contain "${word}"`);
  }
  const asks = lastParagraph(reply).includes("?");
  if (expect.reply?.asksQuestion === true && !asks) failures.push("reply should end by asking a question");
  if (expect.reply?.asksQuestion === false && asks) failures.push("reply should not end with a question");
  const confirmations = reply.match(CONFIRMATION_PROMPT)?.length ?? 0;
  if (confirmations > (expect.confirmations ?? 0)) {
    failures.push(`asked for ${confirmations} yes/no confirmation(s) (allowed ${expect.confirmations ?? 0})`);
  }
}

function checkTrip(expect: StepExpect, observed: ObservedStep, failures: string[], notChecked: string[]) {
  const expected = expect.trip;
  const { trip, seed } = observed;
  if (!expected) return;
  if (expected.dates) {
    if (trip.startsOn !== expected.dates.start || trip.endsOn !== expected.dates.end) {
      failures.push(
        `trip dates ${trip.startsOn ?? "none"} to ${trip.endsOn ?? "none"}, expected ${expected.dates.start} to ${expected.dates.end}`,
      );
    }
    for (const key of expected.dates.assumed ?? []) {
      if (!trip.assumed.includes(key)) failures.push(`trip should mark the ${key} as assumed`);
    }
  }
  if (expected.stays) {
    const seen = trip.stays.map((stay) => `${stay.destination} ${stay.checkIn}–${stay.checkOut}`).join("; ");
    const wanted = expected.stays.map((stay) => `${stay.destination} ${stay.checkIn}–${stay.checkOut}`).join("; ");
    if (seen.toLowerCase() !== wanted.toLowerCase()) failures.push(`stays "${seen || "none"}", expected "${wanted}"`);
  }
  if (expected.client) {
    const name = (id: string | null) => seed.clients.find((client) => client.id === id)?.displayName ?? "none";
    if (name(trip.leadClientId) !== expected.client.lead) {
      failures.push(`lead client ${name(trip.leadClientId)}, expected ${expected.client.lead}`);
    }
    const travellers = trip.travellerIds.map(name).sort().join(", ");
    const wanted = [...expected.client.travellers].sort().join(", ");
    if (travellers !== wanted) failures.push(`travellers "${travellers || "none"}", expected "${wanted}"`);
  }
  for (const key of ["quoteOptions", "quoteStatus", "chosenOption", "booking", "preArrival"] as const) {
    if (expected[key]) notChecked.push(`trip.${key}`);
  }
}

function checkCards(expect: StepExpect, cards: CardKind[], failures: string[], notChecked: string[]) {
  for (const card of expect.cards ?? []) {
    if (!CHECKED_CARDS.includes(card)) notChecked.push(`cards (${card})`);
    else if (!cards.includes(card)) failures.push(`expected a ${card} card`);
  }
  const approvals = cards.filter((card) => card === "approval").length;
  if (approvals > (expect.approvals ?? 0)) {
    failures.push(`showed ${approvals} approval card(s) (allowed ${expect.approvals ?? 0})`);
  }
}

/** Compare one step's expectations with what happened. Pure: no model, no database. */
export function checkStep(
  expect: StepExpect,
  observed: ObservedStep,
  everyReply: string[],
): StepCheck {
  const failures: string[] = [];
  const notChecked: string[] = [];

  checkTools(expect, observed.tools, failures);
  checkReply(expect, observed.reply, everyReply, failures);
  checkTrip(expect, observed, failures, notChecked);
  checkCards(expect, observed.cards, failures, notChecked);

  for (const word of expect.memoryMustNot ?? []) {
    if (observed.memory.includes(word)) failures.push(`agent memory must not contain "${word}"`);
  }
  if (expect.rateCompare) notChecked.push("rateCompare");

  return { failures, notChecked };
}
