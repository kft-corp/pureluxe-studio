import type { ReactNode } from "react";
import type { IconType } from "react-icons";

import { cn } from "@/lib/utils/cn";

const EMPTY_VALUE = "—";

type DetailFieldProps = {
  icon: IconType;
  label: string;
  value: string;
  /** Optional link (mailto:, tel:, https://wa.me/…). */
  href?: string | null;
  /** Small chip next to the label (e.g. Preferred). */
  badge?: string;
  mono?: boolean;
  className?: string;
};

export function DetailField({
  icon: Icon,
  label,
  value,
  href,
  badge,
  mono = false,
  className,
}: DetailFieldProps) {
  const isEmpty = !value.trim() || value === EMPTY_VALUE;
  const displayValue = isEmpty ? EMPTY_VALUE : value;

  let valueNode: ReactNode = displayValue;
  if (!isEmpty && href) {
    valueNode = (
      <a
        href={href}
        className="text-ink underline-offset-2 transition hover:underline"
      >
        {displayValue}
      </a>
    );
  }

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
        <dt className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
          <span>{label}</span>
          {badge ? (
            <span className="rounded-full bg-brand-dark/8 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ink uppercase">
              {badge}
            </span>
          ) : null}
        </dt>
        <dd
          className={cn(
            "mt-1 wrap-break-word text-sm font-medium leading-relaxed",
            isEmpty ? "text-ink-subtle" : "text-ink",
            mono && !isEmpty && "font-mono text-[13px] tracking-tight",
          )}
        >
          {valueNode}
        </dd>
      </div>
    </div>
  );
}

export { EMPTY_VALUE as DETAIL_EMPTY_VALUE };
