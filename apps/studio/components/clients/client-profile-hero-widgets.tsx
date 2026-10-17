"use client";

export { SnapshotCard } from "@/components/ui";

export function CompletenessMeter({
  value,
  hint,
  onHintClick,
}: {
  value: number;
  hint?: string | null;
  onHintClick?: () => void;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface-subtle px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">
          Profile complete
        </p>
        <p className="shrink-0 text-sm font-semibold text-ink tabular-nums">
          {clamped}%
        </p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-divider ring-1 ring-inset ring-border"
        role="progressbar"
        aria-label="Profile completeness"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {hint && clamped < 100 ? (
        onHintClick ? (
          <button
            type="button"
            onClick={onHintClick}
            className="mt-2 wrap-break-word text-left text-xs font-medium text-ink-muted underline-offset-2 transition hover:text-ink hover:underline"
          >
            Next: {hint}
          </button>
        ) : (
          <p className="mt-2 wrap-break-word text-xs text-ink-muted">
            Next: {hint}
          </p>
        )
      ) : null}
    </div>
  );
}
