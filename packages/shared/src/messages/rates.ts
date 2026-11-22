/** Rate Layer / Trip Builder rates API copy. */
export const rateMessages = {
  success: {
    searched: "Rate search completed.",
    priceChecked: "Today's hotel price checked.",
    pasteCreated: "Paste saved for review.",
    rateAdded: "Rate saved on the trip.",
    rateSelected: "Rate selected for this stay.",
    approved: "Line item approved.",
    rejected: "Line item rejected.",
    settingsLoaded: "Rate source settings loaded.",
    settingsSaved: "Rate source settings saved.",
    destinationsLoaded: "Destination routing settings loaded.",
    negotiatedCodesLoaded: "Negotiated rate codes loaded.",
  },
  /** Advisor-facing rate source labels (never name a supplier brand). */
  source: {
    offline_contracted: "Contracted",
    gds_negotiated: "Special GDS",
    gds_public: "Public GDS",
    ota_bedbank: "Bedbank",
    wholesale: "Wholesale",
    offline_manual: "Pasted",
    unknown: "Rate",
  },
  error: {
    tripNotFound: "We couldn't find that trip.",
    legNotFound: "We couldn't find that trip leg.",
    lineItemNotFound: "We couldn't find that line item.",
    pasteEmpty: "Paste some quote text before saving.",
    pasteDisabled:
      "Offline paste is turned off in Rate sources settings. Ask an admin to enable it.",
    pasteParseFailed:
      "We couldn't read a clear amount from that paste. Check the text and try again.",
    notPendingReview: "Only items pending review can be approved or rejected.",
    notSelectable:
      "Only a priced accommodation rate on this trip can be selected.",
    searchFailed: "Rate search failed. Try again.",
    liveRatesUnavailable:
      "Live rates aren't available right now. Paste a supplier quote, or try a hotel I can price.",
    sabreNoHotelCode:
      "I don't have live rates for this hotel yet. Paste a supplier quote, or try another hotel I can price.",
    sabreBadHotelCode:
      "I can't pull live rates for this hotel right now. Paste a supplier quote, or try another hotel.",
    sabreNoAvailability:
      "No rates for these dates. Try different dates or paste a quote.",
    sabreNoAvailabilityCrowded:
      "No rates for this party in one room — many hotels only sleep up to three. Try two rooms (confirm the guest split if there are children), a larger room type, different dates, or paste a quote.",
    roomCountRequired:
      "How many rooms for this stay (e.g. 1 or 2)? Set rooms before searching rates — same as dates and party. Do not assume or invent a room count.",
    /** Used when party has kids / 4+ guests — suggest 2 without inventing. */
    roomCountSuggestFamily:
      "Families often need 2 rooms for live rates (many hotels only sleep about 3 in one room).",
    /** Used for odd/crowded adults-only parties. */
    roomCountSuggestCrowded:
      "With this party I'd often suggest 2 rooms — confirm 1 or 2.",
    sabreTimeout:
      "The rate search timed out. Try again, or paste a supplier quote.",
    sabreAuthFailed:
      "Live rates aren't signing in right now. Ask an admin to check credentials, or paste a supplier quote.",
    sabreUnavailable:
      "Live rates are temporarily unavailable. Try again shortly, or paste a supplier quote.",
    sabreBadRequest:
      "That rate search didn't go through. Check dates and party, or paste a supplier quote.",
    sabreRequestFailed:
      "The rate search failed. Try again, or paste a supplier quote.",
    sabreNoNegotiatedCodes:
      "No negotiated rate codes are set up yet, so special rates aren't available. Public rates may still show.",
    sabreNoNegotiatedAvailability:
      "No special negotiated rates for these dates. Public rates may still be available.",
    sabrePriceCheckNoRateKey:
      "I can't recheck today's price for this room automatically. Search rates again for this hotel, or paste a quote.",
    sabrePriceCheckFailed:
      "Today's price check failed. Try again, search rates for this hotel, or paste a quote.",
    sabrePriceCheckRateGone:
      "This rate is no longer available at the price on file. Search rates again for this hotel and pick a room, or paste a quote.",
    noRatesFound: "No rates found for these dates. Try different dates or paste a quote.",
    priceCheckRoomNotFound:
      "No matching hotel room was found on this trip to recheck. Name the hotel and room, or choose the client's room first.",
    priceCheckAmbiguous:
      "Several rooms match that hotel and room. Include free cancel / non-refundable in the name, or pick the option id.",
    offlineQuoteRequired:
      "An offline quote is required for this destination. Paste the hotel email to continue.",
    roomOccupancySplitRequired:
      "Two or more rooms with children — confirm who sleeps in each room before searching (adults, children, and ages per room). Matching layouts (same counts in every room) or mixed layouts (e.g. 2 adults + child in one room, 1 adult in the other) both work once confirmed. Do not invent a split — or paste a hotel quote.",
    roomOccupancyUneven:
      "Confirm the guests in each room (adults and children per room). Live rates price mixed layouts as separate rooms and combine the totals. Or paste a hotel quote.",
    roomOccupancyInvalid:
      "That room split doesn't match the party. Each room needs at least one adult, and adults/children across rooms must add up to the trip party.",
    roomAdultsPerRoom:
      "Each room needs at least one adult. Adjust rooms or party, then search rates again.",
    roomOccupancyNotDivisible:
      "This party doesn't divide evenly across those rooms. Confirm who sleeps in each room (e.g. 2 adults + child in one room and 1 adult in the other), change the room count, or paste a hotel quote — do not invent a split.",
    sabreMultiOccupancyPartial:
      "No live rates for one of the room setups in this split. Try different room types, change who sleeps where, or paste a hotel quote.",
    contractedOccupancyNoFit:
      "No contracted room fits this party for the rooms requested. Try more rooms, a larger room type, different dates, or paste a quote.",
    contractedOccupancyNoFitCrowded:
      "No contracted room fits this party in one room. Try two rooms, a larger category, or paste a quote.",
  },
  /** Short UI / chat cues after a rates table. */
  hint: {
    askRoomOrFullInfo:
      "Ask about any room — cancellation policy, deposit or guarantee amounts, amenities, meal plan, or other rate detail — if you need more than the table.",
    /** When footer Payment lists only a few labeled rooms. */
    paymentVariesAskRoom:
      "Other rooms vary — ask for that room's payment detail.",
    /** Contracted nightly table: Cost / night is sheet, not stay÷nights. */
    contractedPricingSheet:
      "Cost / night is the contracted sheet for this search (villa × rooms). Stay cost is all-in, including required extras below when listed.",
  },
  /** Advisor heads-ups when rates still return (not hard failures). */
  warn: {
    sabreChildPricingLimited:
      "Child ages were sent, but child pricing can be limited — confirm the child rate with the hotel before quoting.",
    sabreChildPricingIgnored:
      "Child pricing may not have been applied. Rates shown are likely adult-priced — confirm with the hotel before quoting. Use the returned room price as cost (do not invent a child add-on).",
    sabreMultiOccupancyShopped:
      "Mixed guest setups were priced as separate rooms and combined below — booking may be two room reservations on one trip.",
    contractedOccupancyUnknown:
      "Occupancy limits are not on file for some room categories — confirm max guests with the hotel before quoting.",
  },
  /** hotel_find shortlist notes (Trip Builder) — advisor-facing, no systems jargon. */
  find: {
    openGdsFilled:
      "Preferred hotels first; live options fill when coverage is thin (listed after preferred). Open picks can be priced with rates_search when a hotel code is on the shortlist.",
    openGdsEmpty:
      "Nothing strong enough live for this place/dates — name a hotel or paste a quote.",
    /** Silent coverage_check: preferred empty — invite live suggest without saying none exist at all. */
    coverageNoPreferred:
      "No preferred hotels loaded yet for this place. Live options may still be available — ask if they want live suggestions, a hotel name, or a paste quote. Do not list hotel names on this turn.",
    atlasOnly:
      "Preferred hotels from the destination guide — none have rates loaded yet. Suggest names now; when they ask for prices, paste a quote or pick a hotel I can price.",
    mixed:
      "Contracted hotels first; preferred guide hotels fill the rest. Only call rates for shoppable picks, or paste a quote.",
  },
} as const;

/**
 * Advisor-facing ask when stay.rooms is unset before rates_search.
 * Suggests a likely count for families/crowded parties — never invents a value.
 */
export function roomCountAskForParty(input: {
  adults: number;
  children?: number;
  destination?: string | null;
}): string {
  const adults = Math.max(0, Math.floor(input.adults || 0));
  const children = Math.max(0, Math.floor(input.children ?? 0));
  const place = input.destination?.trim() || "this stay";
  const guests = adults + children;
  const base = `How many rooms for ${place} — 1 or 2?`;

  if (children > 0 || guests >= 4) {
    return `${base} ${rateMessages.error.roomCountSuggestFamily}`;
  }
  if (adults >= 3 && adults % 2 !== 0) {
    return `${base} ${rateMessages.error.roomCountSuggestCrowded}`;
  }
  return `${base} Set rooms before searching rates — same as dates and party.`;
}

/** Map rate_source_code → advisor-facing label (supplier-agnostic). */
export function rateSourceLabel(
  code: string | null | undefined,
): string {
  switch (code) {
    case "offline_contracted":
      return rateMessages.source.offline_contracted;
    case "gds_negotiated":
      return rateMessages.source.gds_negotiated;
    case "gds_public":
      return rateMessages.source.gds_public;
    case "ota_bedbank":
      return rateMessages.source.ota_bedbank;
    case "wholesale":
      return rateMessages.source.wholesale;
    case "offline_manual":
      return rateMessages.source.offline_manual;
    default:
      return rateMessages.source.unknown;
  }
}
