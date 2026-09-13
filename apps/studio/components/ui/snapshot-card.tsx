/** Compact label / value / optional hint card — used on detail heroes. */
export function SnapshotCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border/80 bg-surface px-4 py-3">
      <p className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
        {label}
      </p>
      <p
        className="mt-1 line-clamp-2 wrap-break-word text-sm font-semibold leading-snug text-ink"
        title={value}
      >
        {value}
      </p>
      {hint ? (
        <p
          className="mt-0.5 line-clamp-2 wrap-break-word text-xs text-ink-muted"
          title={hint}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
