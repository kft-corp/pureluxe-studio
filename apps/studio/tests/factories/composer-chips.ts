import { vi, type Mock } from "vitest";

import type {
  ComposerChipActions,
  ComposerChipsInput,
} from "@/components/trip-builder/build-composer-chips";
import type { StayDraft } from "@/lib/trip-builder/intents";

export type FakeChipActions = Record<keyof ComposerChipActions, Mock>;

export function makeChipActions(): FakeChipActions {
  return {
    promptCreateTrip: vi.fn(),
    createTrip: vi.fn(),
    changeLead: vi.fn(),
    setPartyRole: vi.fn(),
    addTraveller: vi.fn(),
    confirmTravellers: vi.fn(),
    sendTripChat: vi.fn(),
    assignClient: vi.fn(),
    chooseClient: vi.fn(),
    saveTripDates: vi.fn(),
    commitShift: vi.fn(),
    openTripPage: vi.fn(),
    commitAddLeg: vi.fn(),
    commitRevise: vi.fn(),
    commitRemove: vi.fn(),
    saveStayFromDraft: vi.fn(),
    updateStay: vi.fn(),
    confirmLegs: vi.fn(),
    pickAtlasHotel: vi.fn(),
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
    handleSend: vi.fn(),
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
    suggestedClients: [],
    clientHits: [],
    leadHits: [],
    roleHits: [],
    atlasHotels: [],
    quietChips: false,
    offer: null,
    offerReopen: false,
    pendingOptionDraft: null,
    pendingCostUpdate: null,
    ...overrides,
    actions: makeChipActions(),
  };
}
