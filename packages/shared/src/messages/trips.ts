/** Trip Builder trip shell + stay copy. */
export const tripMessages = {
  success: {
    listed: "Trips loaded.",
    created: "Trip created.",
    updated: "Trip saved.",
    staySaved: "Stay saved.",
    legAdded: "Stay added.",
    legUpdated: "Stay updated.",
    legRemoved: "Stay removed.",
    quoteLoaded: "Quote loaded.",
    quoteSaved: "Quote draft saved.",
    quoteGenerated: "Quote PDF generated.",
    chatListed: "Chat loaded.",
    chatSent: "Message sent.",
  },
  error: {
    notFound: "We couldn't find that trip.",
    listFailed: "We couldn't load trips. Refresh and try again.",
    forbidden: "You can only open trips assigned to you.",
    pricingLocked:
      "Pricing is locked on this trip. Unlock before changing the stay.",
    clientRequired: "Choose a client before setting the stay.",
    hotelRequired: "Choose a hotel (or enter a hotel name) for the stay.",
    dateRange: "Check-out must be after check-in.",
    tripDatesRequired: "Set the full trip dates before adding a stay.",
    legOutsideTrip:
      "That stay sits outside the trip dates. Keep every stay inside the trip.",
    stayOverlap:
      "Those nights overlap another stay. Confirm if that is intentional.",
    legsNotConfirmed:
      "List every stay first. Hotels are planned after the stay list is set.",
    legsAlreadySet: "The stays are already set. Plan the open stay.",
    legsRequired: "Add at least one stay before planning hotels.",
    propertyNotFound: "We couldn't find that hotel property.",
    quoteNotReady:
      "Finish client, stay, and a selected rate before generating the quote PDF.",
    quoteFileMissing: "No quote PDF is ready yet. Generate one first.",
    quoteStale:
      "The quote PDF is out of date. Generate it again before locking pricing.",
    quoteGenerateFailed: "We couldn't generate the quote PDF. Try again.",
    optionsNotReady: "Add at least one room to the options quote first.",
    aiNotConfigured:
      "AI is not configured. Add ANTHROPIC_API_KEY to the environment.",
    aiFailed: "We couldn't get an AI reply. Try again.",
    chatListFailed: "We couldn't load chat. Refresh and try again.",
    chatSendFailed: "We couldn't send that message. Try again.",
  },
} as const;
