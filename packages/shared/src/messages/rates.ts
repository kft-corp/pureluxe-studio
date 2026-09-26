/** Rate Layer / Trip Builder rates API copy. */
export const rateMessages = {
  success: {
    searched: "Rate search completed.",
    pasteCreated: "Paste saved for review.",
    approved: "Line item approved.",
    rejected: "Line item rejected.",
    settingsLoaded: "Rate source settings loaded.",
    settingsSaved: "Rate source settings saved.",
    destinationsLoaded: "Destination routing settings loaded.",
    negotiatedCodesLoaded: "Negotiated rate codes loaded.",
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
    searchFailed: "Rate search failed. Try again.",
    liveRatesUnavailable:
      "Live supplier rates aren't connected yet. Try offline paste or a contracted rate.",
    noRatesFound: "No rates found for these dates. Try different dates or paste a quote.",
    offlineQuoteRequired:
      "An offline quote is required for this destination. Paste the hotel email to continue.",
  },
} as const;
