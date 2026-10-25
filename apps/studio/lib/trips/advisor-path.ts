import type { TripStatus } from "@pureluxe/db";

import { isQuoteAccepted, isQuoteWithClient } from "./trip-status";

export type AdvisorPathStepId =
  | "quote_sent"
  | "client_said_yes"
  | "their_room"
  | "confirm_hotel"
  | "payment"
  | "trip_ready";

export type AdvisorPathStep = {
  id: AdvisorPathStepId;
  label: string;
  done: boolean;
  current: boolean;
  hint: string;
  hrefKind: "trip_builder" | "bookings" | "trip_payment" | null;
};

export type AdvisorPath = {
  steps: AdvisorPathStep[];
  currentIndex: number | null;
  /** Short line for banners: "Step 3 of 6 · Record their room". */
  progressLabel: string | null;
  roomsChosen: boolean;
  staysConfirmed: boolean;
  travelPrepCount: number;
};

type PathInput = {
  status: TripStatus;
  quoteFile: boolean;
  quoteReady: boolean;
  roomsChosen: boolean;
  staysConfirmed: boolean;
  paymentStatus: string;
  travelPrepCount: number;
};

/**
 * One ordered advisor path after the plan is in place.
 * Used on the trip page and (short form) in Trip Builder.
 */
export function buildAdvisorPath(input: PathInput): AdvisorPath {
  const {
    status,
    quoteFile,
    roomsChosen,
    staysConfirmed,
    paymentStatus,
    travelPrepCount,
  } = input;

  if (status === "cancelled") {
    return {
      steps: [],
      currentIndex: null,
      progressLabel: null,
      roomsChosen,
      staysConfirmed,
      travelPrepCount,
    };
  }

  const sent = isQuoteWithClient(status) || isQuoteAccepted(status);
  const accepted = isQuoteAccepted(status);
  const tripReady = status === "confirmed" || status === "completed";
  const paymentDone =
    paymentStatus === "paid" || paymentStatus === "partial";

  const prepHint =
    travelPrepCount > 0
      ? `Check today's price in Trip Builder, clear travel prep (${travelPrepCount} item${travelPrepCount === 1 ? "" : "s"}), book the hotel offline, then confirm each stay in Bookings with the PNR.`
      : "Check today's price in Trip Builder, book the hotel offline, then confirm each stay in Bookings with the PNR.";

  const steps: AdvisorPathStep[] = [
    {
      id: "quote_sent",
      label: "Quote sent",
      done: sent,
      current: false,
      hint: "Mark Quote sent on this page after you deliver the PDF.",
      hrefKind: null,
    },
    {
      id: "client_said_yes",
      label: "Client said yes",
      done: accepted,
      current: false,
      hint: "When they agree, mark Client said yes here — then record their room.",
      hrefKind: null,
    },
    {
      id: "their_room",
      label: "Record their room",
      done: roomsChosen,
      current: false,
      hint: "In Trip Builder, tap This is their room for each stay.",
      hrefKind: "trip_builder",
    },
    {
      id: "confirm_hotel",
      label: "Book offline & confirm hotel",
      done: staysConfirmed,
      current: false,
      hint: prepHint,
      hrefKind: "bookings",
    },
    {
      id: "payment",
      label: "Record payment",
      done: paymentDone || tripReady,
      current: false,
      hint: "Collection is offline. Enter what you took and what’s still due on this trip.",
      hrefKind: "trip_payment",
    },
    {
      id: "trip_ready",
      label: "Trip ready for travel",
      done: tripReady,
      current: false,
      hint: "Available when every hotel stay is confirmed in Bookings.",
      hrefKind: null,
    },
  ];

  if (tripReady) {
    // Trip confirmed/completed — no step is "current"; progressLabel is "Trip ready for travel".
  } else if (!sent) {
    if (quoteFile || input.quoteReady) steps[0]!.current = true;
  } else if (!accepted) {
    steps[1]!.current = true;
  } else if (!roomsChosen) {
    steps[2]!.current = true;
  } else if (!staysConfirmed) {
    steps[3]!.current = true;
  } else if (!paymentDone) {
    steps[4]!.current = true;
  } else {
    steps[5]!.current = true;
  }

  const currentIndex = steps.findIndex((step) => step.current);
  const progressLabel =
    currentIndex >= 0
      ? `Step ${currentIndex + 1} of ${steps.length} · ${steps[currentIndex]!.label}`
      : tripReady
        ? "Trip ready for travel"
        : null;

  return {
    steps,
    currentIndex: currentIndex >= 0 ? currentIndex : null,
    progressLabel,
    roomsChosen,
    staysConfirmed,
    travelPrepCount,
  };
}
