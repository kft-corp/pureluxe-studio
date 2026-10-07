/**
 * @pureluxe/ai — Trip Builder AI (Claude + read-only tools).
 *
 *   trip-builder/ — run / stream a chat turn
 *   context/      — trip facts → stage + gaps
 *   prompts/      — system prompts (home + trip)
 *   providers/    — Claude API
 *   tools/        — domain tools (clients/, trip/) + agent loop
 */

export {
  buildModelMessages,
  streamPreTripTurn,
  streamTripTurn,
  type PreTripTurnInput,
} from "./trip-builder";

export {
  buildTripContext,
  listTripGaps,
  resolveNextStep,
  resolveTripStage,
} from "./context";

export { buildPreTripSystemPrompt, buildSystemPrompt } from "./prompts";

export {
  completeClaudeText,
  createClaudeMessage,
  streamClaudeMessage,
  streamClaudeText,
  textFromClaudeMessage,
  type ClaudeChatMessage,
  type CompleteClaudeTextInput,
  type CreateClaudeMessageInput,
} from "./providers";

export {
  AGENT_PHASE_LABEL,
  PRE_TRIP_READ_TOOLS,
  TRIP_BUILDER_READ_TOOLS,
  executeTool,
  streamAgentLoop,
  type AgentPhase,
  type AgentStreamChunk,
  type ClientBrief,
  type ClientLookupHandlers,
  type ClientSearchHit,
  type ClientToolHandlers,
  type RunAgentLoopInput,
  type TripToolHandlers,
} from "./tools";

export {
  aiError,
  aiNotConfiguredError,
  aiProviderFailedError,
} from "./errors";

export {
  TRIP_BUILDER_STAGES,
  TRIP_BUILDER_STAGE_LABELS,
  type TripBuilderStage,
  type TripRateFact,
  type TripFacts,
  type ChatHistoryMessage,
  type TripTurnInput,
} from "./types";
