import { cn } from "@/lib/utils/cn";

/** Compact label / value / optional hint card — used on detail heroes. */
export function SnapshotCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border/80 bg-surface-subtle px-4 py-3 shadow-[0_4px_16px_rgba(22,26,31,0.03)]",
        className,
      )}
    >
      <p className="studio-type-eyebrow text-ink-subtle">{label}</p>
      <p
        className="studio-type-label mt-1 line-clamp-2 wrap-break-word text-ink"
        title={value}
      >
        {value}
      </p>
      {hint ? (
        <p
          className="studio-type-meta mt-0.5 line-clamp-2 wrap-break-word text-ink-muted"
          title={hint}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
