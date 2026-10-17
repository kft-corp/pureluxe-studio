/**
 * What an advisor message asks for. Pure string parsing, safe on client and server.
 * Import from this path, not from `@/lib/trip-builder`, which pulls in server code.
 */
export { clientNameFromMessage, wantsAssignClient } from "./client";
export {
  isPriceSkip,
  looksLikeOptionsPdfEdit,
  parseMoneyReply,
  parseOptionClientPrice,
  parseOptionsWording,
  splitTrailingPrice,
  wantsOptionsPreview,
  type MoneyReply,
} from "./options-quote";
export {
  classifyPartyIntent,
  parseLeadChange,
  parseTravellerCommand,
  type PartyIntent,
} from "./party";
export {
  isClientQuestion,
  isFollowUpFragment,
  isPlaceQuestion,
  isTripQuestion,
  mightNamePlace,
  wantsHotelSearch,
} from "./questions";
export { parseQuoteEdit, type QuoteEdit } from "./quote-edit";
export {
  isOptionsAdd,
  isSupplierPaste,
  matchRateChoice,
  parseSellMessage,
  wantsRateSearch,
  type RateChoice,
} from "./rates";
export { isConfirmReply, isDeclineReply } from "./replies";
export {
  looksLikeHotelPlan,
  parseAddStay,
  parseCityOnly,
  parseListedStayEdit,
  parseRemoveStay,
  parseTripDates,
  parseTripShift,
  wantsAddStay,
  wantsChangeTripDates,
} from "./stay";
export {
  mergeStayDraft,
  parseStayMessage,
  partyReady,
  stayDraftReady,
  type StayDraft,
} from "./stay-draft";
