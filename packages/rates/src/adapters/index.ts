/**
 * Supplier adapters — execute the plan from resolve/buildAdapterPlan.
 * Offline = real (DB / paste). Sabre / Hotelbeds / wholesale = stubs for now.
 */

export {
  searchHotelbeds,
} from "./hotelbeds";
export {
  searchOfflineContracted,
} from "./offline-contracted";
export {
  searchOfflineManual,
} from "./offline-manual";
export {
  runAdapterPlan,
  type RunAdapterPlanResult,
} from "./run-adapter-plan";
export { searchSabre } from "./sabre";
export type {
  AdapterContext,
  AdapterResult,
  AdapterResultStatus,
  RateAdapter,
} from "./types";
export { searchWholesale } from "./wholesale";
