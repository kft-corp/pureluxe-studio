import { vi, type Mock } from "vitest";

import type {
  ComposerChipActions,
  ComposerChipsInput,
} from "@/components/trip-builder/build-composer-chips";

export type FakeChipActions = Record<keyof ComposerChipActions, Mock>;

export function makeChipActions(): FakeChipActions {
  return {
    sendAction: vi.fn(),
    sendApproval: vi.fn(),
    openTripPage: vi.fn(),
  };
}

/** Nothing pending and no trip open. Override only what the test is about. */
export function makeChipInput(
  overrides: Partial<Omit<ComposerChipsInput, "actions">> = {},
): ComposerChipsInput & { actions: FakeChipActions } {
  return {
    detail: null,
    canWrite: true,
    replyCards: null,
    quietChips: false,
    ...overrides,
    actions: makeChipActions(),
  };
}
