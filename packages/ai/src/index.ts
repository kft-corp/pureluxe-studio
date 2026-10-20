/**
 * @pureluxe/ai — Trip Builder AI (Claude + read-only tools).
 *
 *   agent/        — agent v2 on LangGraph (behind TRIP_AGENT_V2_MEMBER_IDS)
 *   trip-builder/ — agent v1: run / stream a chat turn
 *   context/      — trip facts → stage + gaps
 *   prompts/      — system prompts (home + trip v1, trip v2)
 *   providers/    — Claude API
 *   tools/        — domain tools (clients/, history/, hotels/, trip/) + agent loop
 */

export {
  AGENT_CHECKPOINT_SCHEMA,
  MAX_TOOL_ROUNDS,
  REDACTED,
  TRIP_AGENT_TOOLS,
  createMemoryCheckpointer,
  findAgentTool,
  getAgentCheckpointer,
  readAgentMemory,
  redactSensitive,
  redactText,
  streamTripAgentTurn,
  tripThreadId,
  type AgentAction,
  type AgentModelOptions,
  type AgentToolRisk,
  type AgentTurnRequest,
  type CheckpointPool,
  type PlaceNotes,
  type RateSnapshot,
  type TripAgentHandlers,
  type TripAgentTurnInput,
} from "./agent";

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

export {
  TRIP_PROMPT_V2_RULES,
  TRIP_PROMPT_V2_VERSION,
  buildPreTripSystemPrompt,
  buildSystemPrompt,
  buildTripFactsV2,
} from "./prompts";

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
  claudeRoundUsage,
  createTurnMeter,
  executeTool,
  streamAgentLoop,
  type AgentPhase,
  type AgentToolCallMetric,
  type AgentTurnMetrics,
  type ModelRoundUsage,
  type TurnMeter,
  type AgentStreamChunk,
  type BookingBrief,
  type BookingHistoryRow,
  type ClientBrief,
  type ClientLookupHandlers,
  type ClientSearchHit,
  type ClientToolHandlers,
  type DeskToolHandlers,
  type HistoryToolHandlers,
  type HotelBrief,
  type HotelToolHandlers,
  type RunAgentLoopInput,
  type SearchBookingsInput,
  type SearchTripsInput,
  type TripHistoryRow,
  type TripToolHandlers,
} from "./tools";

export {
  aiError,
  aiNotConfiguredError,
  aiProviderFailedError,
  errorCodeOf,
  userMessageOf,
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
