import type { BuildStage } from "../scenario-types";

/** The build stage the agent has reached. Raise it as each stage of the redesign lands. */
export const CURRENT_BUILD_STAGE = "2b";

/**
 * Order of build stages: "2" < "2b" < "3" < "3a" < … < "3d" < "4".
 * Accepts "stage-3b" or "3b". A sub-stage sorts after its whole stage.
 */
export function stageNumber(stage: BuildStage | string): number {
  const match = /^(?:stage-)?(\d)([a-d])?$/.exec(stage.trim().toLowerCase());
  if (!match) throw new Error(`Unknown build stage "${stage}". Use a number with an optional letter, e.g. 2b.`);
  const letter = match[2] ? match[2].charCodeAt(0) - "a".charCodeAt(0) + 1 : 0;
  return Number(match[1]) + letter / 10;
}
