/**
 * @pureluxe/ai — Trip Builder AI.
 *
 *   agent/     — the LangGraph agent for the trip chat and the home chat
 *   context/   — trip facts → stage + gaps
 *   prompts/   — instructions (trip chat, home chat)
 *   providers/ — a plain Claude text completion for small helpers
 *   tools/     — lookup result shapes, stream chunks and the turn meter
 */

export {
  AGENT_CHECKPOINT_SCHEMA,
  HOME_AGENT_TOOLS,
  MAX_TOOL_ROUNDS,
  REDACTED,
  TRIP_AGENT_TOOLS,
  createMemoryCheckpointer,
  findAgentTool,
  getAgentCheckpointer,
  readAgentMemory,
  redactSensitive,
  redactText,
  streamHomeAgentTurn,
  streamTripAgentTurn,
  tripThreadId,
  type AgentAction,
  type AgentModelOptions,
  type AgentToolRisk,
  type AgentTurnRequest,
  type ApprovalDecision,
  type CheckpointPool,
  type DeskAgentHandlers,
  type HomeAgentHandlers,
  type HomeAgentTurnInput,
  type LeadChoice,
  type PartyRole,
  type PlaceNotes,
  type QuoteAddOptionsInput,
  type QuoteEditLinesInput,
  type QuoteListLinesResult,
  type QuoteOptionRequest,
  type QuotePdfLine,
  type QuotePreviewInput,
  type QuotePreviewResult,
  type QuoteRewriteSectionInput,
  type QuoteSelectFinalInput,
  type RateSnapshot,
  type RatesSearchInput,
  type StayRequest,
  type ToolCallRef,
  type TripAgentHandlers,
  type TripAgentTurnInput,
  type TripChange,
  type TripCreateRequest,
  type TripCreateResult,
  type TripProposeSplitInput,
  type TripProposeSplitResult,
  type UpcomingTripMatch,
} from "./agent";

export {
  buildTripContext,
  listTripGaps,
  resolveNextStep,
  resolveTripStage,
} from "./context";

export {
  HOME_PROMPT_RULES,
  HOME_PROMPT_VERSION,
  TRIP_PROMPT_V2_RULES,
  TRIP_PROMPT_V2_VERSION,
  buildTripFactsV2,
} from "./prompts";

export {
  completeClaudeText,
  type ClaudeChatMessage,
  type CompleteClaudeTextInput,
} from "./providers";

export {
  AGENT_PHASE_LABEL,
  createTurnMeter,
  type AgentApproval,
  type AgentChoice,
  type AgentPhase,
  type AgentToolCallMetric,
  type AgentTurnMetrics,
  type ModelRoundUsage,
  type TurnMeter,
  type AgentStreamChunk,
  type LegSplitCard,
  type LegSplitStay,
  type RateCompareCard,
  type RateCompareHotel,
  type RateCompareHotelNotes,
  type RateCompareRoom,
  type BookingBrief,
  type BookingHistoryRow,
  type ClientBrief,
  type ClientListInput,
  type ClientListRow,
  type ClientSearchHit,
  type ClientToolHandlers,
  type DeskToolHandlers,
  type HistoryToolHandlers,
  type HotelBrief,
  type HotelFindHit,
  type HotelFindResult,
  type HotelPriceTier,
  type HotelToolHandlers,
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
