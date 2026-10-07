/** Trip Builder trip shell + stay copy. */
export const tripMessages = {
  success: {
    listed: "Trips loaded.",
    created: "Trip created.",
    updated: "Trip saved.",
    staySaved: "Stay saved.",
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
    propertyNotFound: "We couldn't find that hotel property.",
    quoteNotReady:
      "Finish client, stay, and a selected rate before generating the quote PDF.",
    quoteFileMissing: "No quote PDF is ready yet. Generate one first.",
    quoteGenerateFailed: "We couldn't generate the quote PDF. Try again.",
    aiNotConfigured:
      "AI is not configured. Add ANTHROPIC_API_KEY to the environment.",
    aiFailed: "We couldn't get an AI reply. Try again.",
    chatListFailed: "We couldn't load chat. Refresh and try again.",
    chatSendFailed: "We couldn't send that message. Try again.",
  },
} as const;
