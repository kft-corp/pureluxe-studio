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
    <div className="min-w-0 rounded-xl border border-border/80 bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
          Profile complete
        </p>
        <p className="shrink-0 text-sm font-semibold text-ink tabular-nums">
          {clamped}%
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-border/70">
        <div
          className="h-full rounded-full bg-brand-dark transition-[width]"
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
