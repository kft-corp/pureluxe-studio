import { CLIENT_BASE_SEED, MEHTA_FAMILY_SEED, MEHTA_FAMILY_WITH_TRIPS_SEED } from "../fixtures/mehta-family";
import { MEHTA_MALDIVES_SEED } from "../fixtures/mehta-maldives";
import type { AgentScenario, ScenarioSeed } from "../scenario-types";

import { MEHTA_MALDIVES, MEHTA_MALDIVES_NEXT_YEAR, MEHTA_MALDIVES_SUGGEST } from "./mehta-maldives";
import { MEHTA_QUESTIONS } from "./mehta-questions";
import { MULTI_CITY_SPLIT } from "./multi-city-split";
import {
  CLIENT_BASE_QUESTIONS,
  MEHTA_V2_ACCEPTANCE,
  MEHTA_V2_PAST_TRIPS,
  MEHTA_V2_SET_UP_CHECKS,
  MEHTA_V2_UPCOMING_TRIP,
  TRAVEL_EXPERTISE,
} from "./mehta-v2";

/** Every golden scenario with the seed it runs on. */
export const AGENT_SCENARIOS: Array<{ scenario: AgentScenario; seed: ScenarioSeed }> = [
  { scenario: MEHTA_MALDIVES, seed: MEHTA_MALDIVES_SEED },
  { scenario: MEHTA_MALDIVES_SUGGEST, seed: MEHTA_MALDIVES_SEED },
  { scenario: MEHTA_MALDIVES_NEXT_YEAR, seed: MEHTA_MALDIVES_SEED },
  { scenario: MEHTA_QUESTIONS, seed: MEHTA_MALDIVES_SEED },
  { scenario: MULTI_CITY_SPLIT, seed: MEHTA_MALDIVES_SEED },
  { scenario: MEHTA_V2_ACCEPTANCE, seed: MEHTA_FAMILY_SEED },
  { scenario: MEHTA_V2_SET_UP_CHECKS, seed: MEHTA_FAMILY_SEED },
  { scenario: MEHTA_V2_UPCOMING_TRIP, seed: MEHTA_FAMILY_WITH_TRIPS_SEED },
  { scenario: MEHTA_V2_PAST_TRIPS, seed: MEHTA_FAMILY_WITH_TRIPS_SEED },
  { scenario: CLIENT_BASE_QUESTIONS, seed: CLIENT_BASE_SEED },
  { scenario: TRAVEL_EXPERTISE, seed: MEHTA_FAMILY_SEED },
];
