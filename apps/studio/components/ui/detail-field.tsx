import type { IconType } from "react-icons";

import { cn } from "@/lib/utils/cn";

const EMPTY_VALUE = "—";

type DetailFieldProps = {
  icon: IconType;
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
};

export function DetailField({
  icon: Icon,
  label,
  value,
  mono = false,
  className,
}: DetailFieldProps) {
  const isEmpty = !value.trim() || value === EMPTY_VALUE;
  const displayValue = isEmpty ? EMPTY_VALUE : value;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-5 py-4 transition-colors sm:px-6",
        className,
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-ink-muted">
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-ink-muted">{label}</dt>
        <dd
          className={cn(
            "mt-1 wrap-break-word text-sm font-medium leading-relaxed",
            isEmpty ? "text-ink-subtle" : "text-ink",
            mono && !isEmpty && "font-mono text-[13px] tracking-tight",
          )}
        >
          {displayValue}
        </dd>
      </div>
    </div>
  );
}

export { EMPTY_VALUE as DETAIL_EMPTY_VALUE };
