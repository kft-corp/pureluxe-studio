import { vi, type Mock } from "vitest";

import type {
  ComposerChipActions,
  ComposerChipsInput,
} from "@/components/trip-builder/build-composer-chips";
import type { StayDraft } from "@/lib/trip-builder/intents";

export type FakeChipActions = Record<keyof ComposerChipActions, Mock>;

export function makeChipActions(): FakeChipActions {
  return {
    sendAction: vi.fn(),
    sendApproval: vi.fn(),
    openTripPage: vi.fn(),
    commitCostUpdate: vi.fn(),
    offerRoomPrice: vi.fn(),
    searchRates: vi.fn(),
    pasteQuote: vi.fn(),
    offerAddRoom: vi.fn(),
    offerSelectRoom: vi.fn(),
    applySell: vi.fn(),
    commitOption: vi.fn(),
    commitSelect: vi.fn(),
    commitOptionsText: vi.fn(),
    commitPdfEdits: vi.fn(),
    openOptionsQuote: vi.fn(),
    declineOffer: vi.fn(),
  };
}

export const EMPTY_STAY_DRAFT: StayDraft = {
  hotel: "",
  city: "",
  checkIn: "",
  checkOut: "",
  adults: null,
  children: null,
  rooms: null,
};

/** Nothing pending and no trip open. Override only what the test is about. */
export function makeChipInput(
  overrides: Partial<Omit<ComposerChipsInput, "actions">> = {},
): ComposerChipsInput & { actions: FakeChipActions } {
  return {
    detail: null,
    canWrite: true,
    quoteFrozen: false,
    activeLegId: null,
    stayDraft: EMPTY_STAY_DRAFT,
    rateOptions: [],
    replyCards: null,
    quietChips: false,
    offer: null,
    pendingOptionDraft: null,
    pendingCostUpdate: null,
    ...overrides,
    actions: makeChipActions(),
  };
}
