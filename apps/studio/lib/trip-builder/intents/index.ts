/**
 * What an advisor message asks for, for the rate and quote chips. Pure string parsing,
 * safe on client and server. Client, traveller, date and stay changes go to the agent.
 * Import from this path, not from `@/lib/trip-builder`, which pulls in server code.
 */
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
  isClientQuestion,
  isPlaceQuestion,
  isTripQuestion,
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
  mergeStayDraft,
  parseStayMessage,
  partyReady,
  type StayDraft,
} from "./stay-draft";
