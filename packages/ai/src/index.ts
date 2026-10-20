/**
 * @pureluxe/ai — Trip Builder AI.
 *
 *   agent/        — trip agent on LangGraph (reads and changes the open trip)
 *   trip-builder/ — home chat turn (no trip open)
 *   context/      — trip facts → stage + gaps
 *   prompts/      — system prompts (home, trip agent)
 *   providers/    — Claude API
 *   tools/        — home chat tools (clients/, history/, hotels/) + tool loop + stream chunks
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
  type ApprovalDecision,
  type CheckpointPool,
  type PartyRole,
  type PlaceNotes,
  type RateSnapshot,
  type StayRequest,
  type ToolCallRef,
  type TripAgentHandlers,
  type TripAgentTurnInput,
  type TripChange,
} from "./agent";

export {
  buildModelMessages,
  streamPreTripTurn,
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
  claudeRoundUsage,
  createTurnMeter,
  executeTool,
  streamAgentLoop,
  type AgentApproval,
  type AgentChoice,
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
} from "./types";
