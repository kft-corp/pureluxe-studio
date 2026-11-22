/**
 * Adapter orchestration — plan execution + offline adapters.
 * Live suppliers (Sabre / Hotelbeds / wholesale) live under `src/suppliers/`.
 */

export { runAdapterPlan, type RunAdapterPlanResult } from "./run-adapter-plan";
export { searchOfflineContracted } from "./offline-contracted";
export { searchOfflineManual } from "./offline-manual";
export type {
  AdapterContext,
  AdapterResult,
  AdapterResultStatus,
  RateAdapter,
} from "./types";

export {
  searchHotelbeds,
  searchSabre,
  searchWholesale,
} from "../suppliers";
