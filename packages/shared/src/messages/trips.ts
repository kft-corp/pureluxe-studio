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
    datesShifted: "Trip dates and stays moved.",
    quoteLoaded: "Quote loaded.",
    quoteSaved: "Quote draft saved.",
    quoteGenerated: "Quote PDF generated.",
    quoteSent: "Quote marked as sent.",
    waitingOnClient: "Trip marked waiting for a reply.",
    quoteReopened: "Quote reopened. The price is unlocked and the trip is back to building.",
    quoteAccepted:
      "Client said yes. The price is locked — record their room in Trip Builder.",
    tripConfirmed: "Trip ready for travel.",
    tripCancelled: "Trip cancelled.",
    paymentUpdated: "Client payment recorded.",
    chatListed: "Chat loaded.",
    chatSent: "Message sent.",
  },
  error: {
    notFound: "We couldn't find that trip.",
    listFailed: "We couldn't load trips. Refresh and try again.",
    forbidden: "You can only open trips assigned to you.",
    pricingLocked:
      "Pricing is locked on this trip. Reopen the quote on the trip page before changing it.",
    clientRequired: "Choose a client before setting the stay.",
    hotelRequired: "Choose a hotel (or enter a hotel name) for the stay.",
    dateRange: "Check-out must be after check-in.",
    tripDatesRequired: "Set the full trip dates before adding a stay.",
    shiftConfirmedBooking:
      "A stay on this trip has a confirmed hotel booking. Amend it in Bookings first, then shift the trip.",
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
    quoteSendBlocked:
      "Generate a current quote PDF before sending it to the client.",
    quoteAcceptBlocked:
      "Send the current quote to the client before marking it accepted.",
    statusNotEnabled:
      "This status isn't set up in the database yet. Ask an admin to apply the latest migration.",
    waitingBlocked:
      "Generate a current quote PDF before marking the trip waiting on the client.",
    tripClosed: "This trip is cancelled.",
    tripClosedEdit: "This trip is cancelled, so it can't be changed.",
    quoteAccepted:
      "The client accepted this quote. Reopen the quote on the trip page before changing it.",
    reopenBlocked: "Only an accepted quote can be reopened.",
    tripConfirmNeedsStays:
      "Confirm every hotel stay in Bookings (with the confirmation / PNR) before marking the trip ready for travel.",
    acceptedRoomOnly:
      "After the client accepts, only the client's chosen room can be re-priced. Reopen the quote on the trip page to change other rooms.",
    quoteGenerateFailed: "We couldn't generate the quote PDF. Try again.",
    optionsNotReady: "Add at least one room to the options quote first.",
    aiNotConfigured:
      "AI is not configured. Add ANTHROPIC_API_KEY to the environment.",
    aiFailed: "We couldn't get an AI reply. Try again.",
    replyInterrupted:
      "That reply was interrupted. Please try again.",
    chatListFailed: "We couldn't load chat. Refresh and try again.",
    chatSendFailed: "We couldn't send that message. Try again.",
    agentBusy: "Still working on your last message… This one sends when it finishes.",
    agentNoApproval: "Nothing is waiting for approval on this trip.",
    agentActionUnavailable: "That action isn't available yet. Type what you need instead.",
    agentMemoryNotConfigured:
      "The new agent needs DATABASE_URL. Add it to the environment.",
  },
} as const;
