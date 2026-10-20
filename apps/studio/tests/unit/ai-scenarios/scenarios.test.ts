import { describe, expect, it } from "vitest";

import { MEHTA_MALDIVES_SEED } from "@/tests/ai/fixtures/mehta-maldives";
import type { AgentScenario, ScenarioSeed, ScenarioStep } from "@/tests/ai/scenario-types";
import { AGENT_SCENARIOS } from "@/tests/ai/scenarios";
import { MEHTA_MALDIVES } from "@/tests/ai/scenarios/mehta-maldives";

function hotel(seed: ScenarioSeed, name: string) {
  return seed.hotels.find((row) => row.name === name);
}

function ageOn(dateOfBirth: string, onDate: string): number {
  const born = new Date(`${dateOfBirth}T00:00:00Z`);
  const on = new Date(`${onDate}T00:00:00Z`);
  let age = on.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < born.getUTCMonth() ||
    (on.getUTCMonth() === born.getUTCMonth() && on.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function isAdvisorInput(step: ScenarioStep): boolean {
  return step.advisor.kind === "say" || step.advisor.kind === "tap";
}

describe.each(AGENT_SCENARIOS.map(({ scenario, seed }) => [scenario.id, scenario, seed] as const))(
  "scenario %s",
  (_id, scenario: AgentScenario, seed: ScenarioSeed) => {
    it("has unique step ids, and interruptions follow a real step", () => {
      const ids = scenario.steps.map((step) => step.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const interruption of scenario.interruptions ?? []) {
        expect(ids).toContain(interruption.afterStep);
        expect(interruption.expect.readOnly).toBe(true);
      }
    });

    it("gives every typed step a text and distinct variants", () => {
      for (const step of scenario.steps) {
        if (step.advisor.kind !== "say") continue;
        const all = [step.advisor.text, ...(step.advisor.variants ?? [])].map((text) => text.trim().toLowerCase());
        expect(all.every((text) => text.length > 0)).toBe(true);
        expect(new Set(all).size).toBe(all.length);
      }
    });

    it("only refers to clients, hotels and rooms in the seed", () => {
      const clientNames = new Set(seed.clients.map((client) => client.displayName));
      for (const step of scenario.steps) {
        const { trip, rateCompare } = step.expect;
        if (trip?.client) {
          expect(clientNames).toContain(trip.client.lead);
          for (const name of trip.client.travellers) expect(clientNames).toContain(name);
        }
        for (const name of [...(rateCompare?.hotels ?? []), ...(rateCompare?.excludesHotels ?? [])]) {
          expect(hotel(seed, name), name).toBeDefined();
        }
        for (const option of trip?.quoteOptions?.includes ?? []) {
          const row = hotel(seed, option.hotel);
          expect(row, option.hotel).toBeDefined();
          expect(row?.rooms.map((room) => room.name), `${option.hotel} rooms`).toContain(option.room);
        }
        for (const pick of [trip?.chosenOption, trip?.booking]) {
          if (pick) expect(hotel(seed, pick.hotel), pick.hotel).toBeDefined();
        }
        if (trip?.chosenOption) {
          expect(hotel(seed, trip.chosenOption.hotel)?.rooms.map((room) => room.name)).toContain(
            trip.chosenOption.room,
          );
        }
      }
    });

    it("keeps dates in order, after 'now', with stays inside the trip and covered by rates", () => {
      const today = scenario.now.slice(0, 10);
      for (const step of scenario.steps) {
        const { dates, stays } = step.expect.trip ?? {};
        if (!dates) continue;
        expect(dates.start < dates.end).toBe(true);
        expect(dates.start > today).toBe(true);
        for (const stay of stays ?? []) {
          expect(stay.checkIn >= dates.start && stay.checkOut <= dates.end).toBe(true);
        }
      }
    });

    it("counts adults from the travellers' ages", () => {
      for (const step of scenario.steps) {
        const { client, dates } = step.expect.trip ?? {};
        if (!client || !dates) continue;
        const ages = client.travellers.map((name) => {
          const row = seed.clients.find((candidate) => candidate.displayName === name)!;
          return ageOn(row.dateOfBirth, dates.start);
        });
        expect(ages.filter((age) => age >= 18).length).toBe(client.adults);
        expect(ages.filter((age) => age < 18).length).toBe(client.children);
      }
    });

    it("stays within its own budget", () => {
      const sendIndex = scenario.steps.findIndex(
        (step) => step.advisor.kind === "tap" && step.advisor.action === "quote_send",
      );
      const confirmations = scenario.steps.reduce((sum, step) => sum + (step.expect.confirmations ?? 0), 0);
      expect(confirmations).toBeLessThanOrEqual(scenario.budget.maxConfirmationsTotal);
      if (sendIndex < 0) return;
      const toSend = scenario.steps.slice(0, sendIndex + 1);
      expect(toSend.filter(isAdvisorInput).length).toBeLessThanOrEqual(scenario.budget.maxAdvisorInputsToQuoteSent);
      const approvals = toSend.reduce((sum, step) => sum + (step.expect.approvals ?? 0), 0);
      expect(approvals).toBeLessThanOrEqual(scenario.budget.maxApprovalsToQuoteSent);
    });

    it("never requires a word it also forbids", () => {
      const forbidden = scenario.everyReply.mustNot.map((word) => word.toLowerCase());
      const steps = [...scenario.steps, ...(scenario.interruptions ?? [])];
      for (const step of steps) {
        for (const word of step.expect.reply?.mentions ?? []) {
          expect(forbidden.some((bad) => word.toLowerCase().includes(bad)), word).toBe(false);
        }
      }
    });
  },
);

describe("Mehta / Maldives main scenario", () => {
  it("covers all seven ideal-flow stages", () => {
    const covered = new Set(MEHTA_MALDIVES.steps.flatMap((step) => step.flowStages));
    expect([...covered].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("has a seed that makes 'similar price range' meaningful", () => {
    const fromPrice = (name: string) => Math.min(...hotel(MEHTA_MALDIVES_SEED, name)!.rooms.map((room) => room.nightlyCost));
    const anchor = fromPrice("Six Senses Kanuhura");
    for (const name of ["Anantara Kihavah", "Soneva Fushi"]) {
      expect(Math.abs(fromPrice(name) - anchor) / anchor).toBeLessThan(0.35);
    }
    expect(fromPrice("Coral Bay Resort")).toBeLessThan(anchor / 2);
  });

  it("gives the compared hotels the same cancellation but different required charges", () => {
    const compared = ["Six Senses Kanuhura", "Anantara Kihavah", "Soneva Fushi"].map(
      (name) => hotel(MEHTA_MALDIVES_SEED, name)!,
    );
    expect(new Set(compared.map((row) => row.cancellation)).size).toBe(1);
    const transfers = compared.map(
      (row) => row.requiredCharges.find((charge) => charge.unit === "per_person")?.amount,
    );
    expect(new Set(transfers).size).toBe(compared.length);
  });

  it("asks for approval only after the quote is sent, and only once", () => {
    const sendIndex = MEHTA_MALDIVES.steps.findIndex((step) => step.id === "send-quote");
    const approvalsBefore = MEHTA_MALDIVES.steps
      .slice(0, sendIndex + 1)
      .reduce((sum, step) => sum + (step.expect.approvals ?? 0), 0);
    const approvalsAfter = MEHTA_MALDIVES.steps
      .slice(sendIndex + 1)
      .reduce((sum, step) => sum + (step.expect.approvals ?? 0), 0);
    expect(approvalsBefore).toBe(0);
    expect(approvalsAfter).toBe(1);
  });
});
