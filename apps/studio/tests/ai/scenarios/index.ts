import { MEHTA_MALDIVES_SEED } from "../fixtures/mehta-maldives";
import type { AgentScenario, ScenarioSeed } from "../scenario-types";

import { MEHTA_MALDIVES, MEHTA_MALDIVES_NEXT_YEAR, MEHTA_MALDIVES_SUGGEST } from "./mehta-maldives";
import { MEHTA_QUESTIONS } from "./mehta-questions";

/** Every golden scenario with the seed it runs on. */
export const AGENT_SCENARIOS: Array<{ scenario: AgentScenario; seed: ScenarioSeed }> = [
  { scenario: MEHTA_MALDIVES, seed: MEHTA_MALDIVES_SEED },
  { scenario: MEHTA_MALDIVES_SUGGEST, seed: MEHTA_MALDIVES_SEED },
  { scenario: MEHTA_MALDIVES_NEXT_YEAR, seed: MEHTA_MALDIVES_SEED },
  { scenario: MEHTA_QUESTIONS, seed: MEHTA_MALDIVES_SEED },
];
