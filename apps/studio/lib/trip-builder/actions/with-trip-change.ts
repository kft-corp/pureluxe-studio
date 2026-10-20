import { findTripChangeResult, recordTripChange } from "@pureluxe/db";

import { getTripDetail } from "../trip/get-trip-detail";
import type { TripDetail } from "../trip/trip-detail";

import { applyTripShape } from "./apply-trip-shape";
import { sameShape, tripShapeOf, type TripShape } from "./trip-shape";

/** Who is changing which trip, and the key that makes a retry safe. */
export type TripChangeContext = {
  tripId: string;
  actor: { memberId: string };
  tool: string;
  args: Record<string, unknown>;
  /** The agent's tool-call id: the same call never applies twice. */
  idempotencyKey: string;
  /** Receives the trip after a change, so the caller doesn't load it again. */
  onChanged?: (after: TripDetail) => void;
};

export type TripChangeResult = {
  ok: true;
  summary: string;
  /** True when this change can be undone. */
  undo: boolean;
  /** Nothing needed to change (or the same request already ran). */
  unchanged?: true;
};

type ChangeOutcome = {
  summary: string;
  undoable: boolean;
  /** The trip after the change. Null when nothing changed. */
  after: TripDetail | null;
};

/**
 * Run one agent change with duplicate protection, then record it in one transaction:
 * version + 1, the "before" copy for Undo (only when undoable), the duplicate record.
 */
export async function withTripChange(
  context: TripChangeContext,
  change: (before: TripDetail) => Promise<ChangeOutcome>,
): Promise<TripChangeResult> {
  const { tripId, actor } = context;
  const [done, before] = await Promise.all([
    findTripChangeResult({ tripId, memberId: actor.memberId, idempotencyKey: context.idempotencyKey }),
    getTripDetail(tripId, actor),
  ]);
  if (done) return { ok: true, summary: String(done.summary ?? ""), undo: false, unchanged: true };

  const { summary, undoable, after } = await change(before);
  if (!after) return { ok: true, summary, undo: false, unchanged: true };

  const version = await recordTripChange({
    tripId,
    memberId: actor.memberId,
    tool: context.tool,
    args: context.args,
    summary,
    before: undoable ? tripShapeOf(before) : null,
    after: undoable ? tripShapeOf(after) : null,
    idempotencyKey: context.idempotencyKey,
  });
  context.onChanged?.({ ...after, trip: { ...after.trip, version } });
  return { ok: true, summary, undo: undoable };
}

/** A change described as the trip it should become. Undo puts the earlier shape back. */
export function changeTripShape(
  context: TripChangeContext,
  plan: (before: TripDetail) => { target: TripShape; summary: string },
): Promise<TripChangeResult> {
  return withTripChange(context, async (before) => {
    const { target, summary } = plan(before);
    if (sameShape(tripShapeOf(before), target)) return { summary, undoable: false, after: null };
    return {
      summary,
      undoable: true,
      after: await applyTripShape(context.tripId, target, context.actor, before),
    };
  });
}
